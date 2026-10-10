// POST /api/google/sync   body { householdId }
//
// Two way sync between households/{hid}/events and the secondary Google calendar called
// NurtureTrack. Answers { pushed, pulled, deleted, errors }.
//
// Push. Every event changed since the last run is inserted or patched in Google, and the
// Google event id is written back on the Firestore document so a later run patches instead of
// making a second copy. The first run, when there is no lastSyncedAt, pushes everything.
//
// Deletes. There is no tombstone collection. The server keeps its own map of what it pushed
// in googleSync/{uid}.pushed, which is { firestoreEventId: googleEventId }. Any id in that map
// with no Firestore document behind it any more is deleted from Google and dropped from the
// map. That way the browser never has to write a tombstone, and the three server only
// collections stay denied to every client in firestore.rules.
//
// Pull. Google's events.list is called with the stored syncToken when there is one, so only
// what changed comes back. A 410 from Google means the token is too old; the token is thrown
// away and the window is read in full. An event that NurtureTrack pushed is recognised by the
// private extended property ntEventId and is never written back in as a second copy.
//
// Conflict rule. Whichever side was updated later wins (resolveConflict in
// api/_lib/calendarMap.js). A tie goes to NurtureTrack, so a second run with the same data
// changes nothing. Firestore keeps the Google "updated" stamp on the document as
// googleUpdatedAt, which is what the next run compares against.
import { db, hasAdminConfig, notConfigured } from "../_lib/admin.js";
import { requireUser } from "../_lib/auth.js";
import { BATCH_MAX, chunk } from "../_lib/batch.js";
import { fromGoogleEvent, resolveConflict, toGoogleEvent, toMillis } from "../_lib/calendarMap.js";
import {
  calendarClient,
  ensureCalendar,
  hasGoogleConfig,
  notConfigured as googleNotConfigured,
  syncRef,
  tokenRef,
} from "../_lib/google.js";
import { guardLimit } from "../_lib/rateLimit.js";
import { allowMethod, fail, logLine, readBody, sendJson } from "../_lib/respond.js";

const EVENTS_MAX = 500;
const PULL_PAGE = 250;
// How far back a full read goes. Old appointments are history, not something to sync.
const PULL_DAYS_BACK = 60;

// Commits a list of { ref, data } sets and { ref } deletes in chunks of at most 400.
async function commit(writes) {
  for (const group of chunk(writes, BATCH_MAX)) {
    const batch = db.batch();
    for (const write of group) {
      if (write.remove) batch.delete(write.ref);
      else batch.set(write.ref, write.data, { merge: true });
    }
    await batch.commit();
  }
}

function fieldsFromDoc(doc) {
  const data = doc.data() || {};
  return {
    title: data.title ?? "",
    date: data.date ?? "",
    endDate: data.endDate ?? data.date ?? "",
    allDay: Boolean(data.allDay),
    start: data.start ?? null,
    end: data.end ?? null,
    owner: data.owner ?? "both",
    type: data.type ?? "family",
    notes: typeof data.notes === "string" ? data.notes : "",
  };
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  if (!hasAdminConfig() || !hasGoogleConfig()) {
    const error = hasAdminConfig() ? googleNotConfigured() : notConfigured();
    return fail(res, 500, error.code, error.message);
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (error) {
    return fail(res, 401, error.code || "auth/invalid-token", error.message);
  }

  const householdId = String(readBody(req).householdId || "").trim();
  if (!householdId) return fail(res, 400, "sync/no-household", "That request did not say which household to sync.");
  if (!(await guardLimit(res, user.uid, "googleSync"))) return;

  try {
    const household = await db.collection("households").doc(householdId).get();
    const memberIds = household.exists ? household.data()?.memberIds || [] : [];
    if (!memberIds.includes(user.uid)) {
      return fail(res, 403, "sync/not-a-member", "That is not your household.");
    }

    const { calendar, stored } = await calendarClient(user.uid);
    const calendarId = await ensureCalendar(calendar, stored?.calendarId || "");
    if (calendarId !== stored?.calendarId) await tokenRef(user.uid).set({ calendarId }, { merge: true });

    const syncSnap = await syncRef(user.uid).get();
    const syncState = syncSnap.exists ? syncSnap.data() || {} : {};
    const pushedMap = { ...(syncState.pushed || {}) };
    const lastSyncedAt = toMillis(syncState.lastSyncedAt);

    const errors = [];
    const eventsCol = db.collection("households").doc(householdId).collection("events");
    const snap = await eventsCol.orderBy("date").limit(EVENTS_MAX).get();
    const byId = new Map(snap.docs.map((doc) => [doc.id, doc]));
    const writes = [];
    const runAt = new Date();

    // ---------- Push ----------
    let pushed = 0;
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const changed = lastSyncedAt === null || (toMillis(data.updatedAt) ?? 0) > lastSyncedAt;
      const known = Boolean(data.googleEventId);
      if (!changed && known) continue;
      // Google changed this one more recently, so the pull below owns it.
      if (known && resolveConflict(data.updatedAt, data.googleUpdatedAt) === "remote") continue;

      let body;
      try {
        body = toGoogleEvent(fieldsFromDoc(doc), doc.id);
      } catch {
        errors.push("One event could not be read, so it was left alone.");
        continue;
      }
      try {
        const answer = data.googleEventId
          ? await calendar.events.patch({ calendarId, eventId: data.googleEventId, requestBody: body })
          : await calendar.events.insert({ calendarId, requestBody: body });
        const googleEventId = answer.data.id;
        pushedMap[doc.id] = googleEventId;
        writes.push({
          ref: doc.ref,
          data: { googleEventId, googleUpdatedAt: answer.data.updated || null, googleSyncedAt: runAt },
        });
        pushed += 1;
      } catch (cause) {
        if (cause?.code === 404 || cause?.response?.status === 404) {
          // The Google copy is gone. Clear the id so the next run inserts a fresh one.
          delete pushedMap[doc.id];
          writes.push({ ref: doc.ref, data: { googleEventId: null } });
        }
        errors.push("One event could not be sent to Google. It will be tried again next time.");
        console.error("[google sync push]", cause?.code, cause?.message);
      }
    }

    // ---------- Deletes ----------
    let deleted = 0;
    for (const [eventId, googleEventId] of Object.entries(syncState.pushed || {})) {
      if (byId.has(eventId)) continue;
      try {
        await calendar.events.delete({ calendarId, eventId: googleEventId });
        deleted += 1;
      } catch (cause) {
        const status = cause?.code || cause?.response?.status;
        // 404 and 410 both mean it is already gone, which is the outcome we wanted.
        if (status !== 404 && status !== 410) {
          errors.push("One deleted event could not be removed from Google.");
          console.error("[google sync delete]", status, cause?.message);
          continue;
        }
      }
      delete pushedMap[eventId];
    }

    // ---------- Pull ----------
    let pulled = 0;
    let syncToken = syncState.syncToken || null;
    let nextSyncToken = null;
    const byGoogleId = new Map();
    for (const doc of snap.docs) {
      const googleEventId = doc.data()?.googleEventId;
      if (googleEventId) byGoogleId.set(googleEventId, doc);
    }

    async function listPage(pageToken, useToken) {
      const params = { calendarId, maxResults: PULL_PAGE, singleEvents: true, showDeleted: true, pageToken };
      if (useToken) params.syncToken = useToken;
      else params.timeMin = new Date(Date.now() - PULL_DAYS_BACK * 86400000).toISOString();
      return calendar.events.list(params);
    }

    let items = [];
    try {
      let pageToken;
      do {
        const page = await listPage(pageToken, syncToken);
        items = items.concat(page.data.items || []);
        pageToken = page.data.nextPageToken || undefined;
        nextSyncToken = page.data.nextSyncToken || nextSyncToken;
      } while (pageToken);
    } catch (cause) {
      const status = cause?.code || cause?.response?.status;
      if (status === 410 && syncToken) {
        // The sync token expired. Read the window in full and start a new token.
        syncToken = null;
        items = [];
        nextSyncToken = null;
        let pageToken;
        do {
          const page = await listPage(pageToken, null);
          items = items.concat(page.data.items || []);
          pageToken = page.data.nextPageToken || undefined;
          nextSyncToken = page.data.nextSyncToken || nextSyncToken;
        } while (pageToken);
      } else {
        errors.push("We could not read your Google calendar this time. Try again in a moment.");
        console.error("[google sync pull]", status, cause?.message);
        items = [];
      }
    }

    for (const item of items) {
      const ownId = item.extendedProperties?.private?.ntEventId || "";
      const local = (ownId && byId.get(ownId)) || (item.id && byGoogleId.get(item.id)) || null;

      if (item.status === "cancelled") {
        if (local) {
          writes.push({ ref: local.ref, remove: true });
          delete pushedMap[local.id];
          pulled += 1;
        }
        continue;
      }

      const mapped = fromGoogleEvent(item);
      if (!mapped) continue;

      if (local) {
        const data = local.data() || {};
        if (resolveConflict(data.updatedAt, item.updated) !== "remote") continue;
        writes.push({
          ref: local.ref,
          data: {
            title: mapped.title,
            date: mapped.date,
            endDate: mapped.endDate,
            allDay: mapped.allDay,
            start: mapped.start,
            end: mapped.end,
            notes: mapped.notes,
            googleEventId: item.id,
            googleUpdatedAt: item.updated || null,
            source: "google",
            updatedAt: runAt,
          },
        });
        pulled += 1;
        continue;
      }

      const ref = eventsCol.doc();
      writes.push({
        ref,
        data: {
          ...mapped,
          source: "google",
          createdBy: user.uid,
          createdAt: runAt,
          updatedAt: runAt,
          googleUpdatedAt: item.updated || null,
          googleSyncedAt: runAt,
        },
      });
      pulled += 1;
    }

    await commit(writes);
    await syncRef(user.uid).set(
      { syncToken: nextSyncToken || syncToken || null, pushed: pushedMap, lastSyncedAt: runAt },
      { merge: true },
    );
    await db
      .collection("users")
      .doc(user.uid)
      .set({ settings: { calendar: { connected: true, calendarId, lastSyncedAt: runAt } } }, { merge: true });

    logLine("google sync", { uid: user.uid, household: householdId, pushed, pulled, deleted, errors: errors.length });
    return sendJson(res, 200, { ok: true, pushed, pulled, deleted, errors });
  } catch (cause) {
    console.error("[google sync]", cause?.code, cause?.message);
    const status = cause?.status || 500;
    return fail(res, status, cause?.code || "calendar/sync-failed", cause?.message || "We could not sync the calendar. Try again.");
  }
}
