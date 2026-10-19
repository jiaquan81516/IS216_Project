// POST /api/account/delete
//
// The procedure in docs/account-deletion.md, in that order. The caller is taken from the
// verified ID token and never from the body: a uid in a body is a request to delete somebody
// else's account.
//
// Decision on the last member, which docs/account-deletion.md asked the server to make and
// write down: when the leaving user is the only member, the household and everything under it
// is deleted with recursiveDelete. Nobody else can see it, keeping it costs storage, and the
// promise on the Settings page is that shared data stays only so the partner keeps it. With no
// partner there is nothing to keep. No 409 is ever returned, so the client needs no new case.
//
// Anonymising. The user's name is removed, never the row: entries, events and tasks
// keep their uid, which is what the rules and the seen markers work off, and gain
// byName "A parent" so no screen has to guess. The member document is gone by then, so the UI
// would fall back to "A parent" anyway; writing it down means the history cannot drift.
//
// Idempotent. A second call for a user who is already gone answers 200 with zero counts.
import { FieldValue } from "firebase-admin/firestore";
import { auth, db, hasAdminConfig, notConfigured } from "../_lib/admin.js";
import { requireUser } from "../_lib/auth.js";
import { BATCH_MAX, chunk } from "../_lib/batch.js";
import { revokeToken, syncRef, tokenRef } from "../_lib/google.js";
import { guardLimit } from "../_lib/rateLimit.js";
import { allowMethod, fail, logLine, sendJson } from "../_lib/respond.js";

export const ANON_NAME = "A parent";

// Sets byName on every document a query matches, in batches of at most 400.
async function anonymise(query) {
  const snap = await query.get();
  if (snap.empty) return 0;
  for (const group of chunk(snap.docs, BATCH_MAX)) {
    const batch = db.batch();
    for (const doc of group) batch.set(doc.ref, { byName: ANON_NAME }, { merge: true });
    await batch.commit();
  }
  return snap.size;
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  if (!hasAdminConfig()) {
    const error = notConfigured();
    return fail(res, 500, error.code, error.message);
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (error) {
    return fail(res, 401, error.code || "auth/invalid-token", error.message);
  }
  const uid = user.uid;
  if (!(await guardLimit(res, uid, "accountDelete"))) return;

  const summary = {
    anonymisedEntries: 0,
    anonymisedShared: 0,
    invitesRevoked: 0,
    householdLeft: false,
    householdDeleted: false,
    calendarDisconnected: false,
    userDeleted: false,
  };

  try {
    // 1 and 2. The verified uid, and the household it points at.
    const userSnap = await db.collection("users").doc(uid).get();
    const householdId = userSnap.exists ? userSnap.data()?.householdId || "" : "";

    // 3. Stop other devices writing while this runs.
    try {
      await auth.revokeRefreshTokens(uid);
    } catch (cause) {
      if (cause?.code !== "auth/user-not-found") throw cause;
    }

    // 4. Anonymise the shared household data. The rows stay, the name goes.
    if (householdId) {
      const household = db.collection("households").doc(householdId);
      summary.anonymisedEntries = await anonymise(household.collection("entries").where("by", "==", uid));
      for (const name of ["events", "tasks"]) {
        summary.anonymisedShared += await anonymise(household.collection(name).where("createdBy", "==", uid));
      }

      // 5. Out of the household.
      const snap = await household.get();
      const memberIds = snap.exists ? snap.data()?.memberIds || [] : [];
      const remaining = memberIds.filter((id) => id !== uid);
      if (snap.exists) {
        const batch = db.batch();
        batch.delete(household.collection("members").doc(uid));
        batch.update(household, { memberIds: FieldValue.arrayRemove(uid) });
        await batch.commit();
        summary.householdLeft = true;

        // The last member takes the household with them.
        if (remaining.length === 0) {
          await db.recursiveDelete(household);
          summary.householdDeleted = true;
        }
      }
    }

    // 6 and 7. The private data under the user, then the user document.
    await db.recursiveDelete(db.collection("users").doc(uid));

    // 8. An unused invite the user made is revoked, not deleted, so an old code still gets a
    // clear answer rather than "not found".
    const invites = await db.collection("invites").where("createdBy", "==", uid).get();
    const open = invites.docs.filter((doc) => !doc.data()?.usedAt);
    for (const group of chunk(open, BATCH_MAX)) {
      const batch = db.batch();
      for (const doc of group) batch.set(doc.ref, { revokedAt: new Date() }, { merge: true });
      await batch.commit();
    }
    summary.invitesRevoked = open.length;

    // 9. The Google Calendar grant, revoked at Google and deleted here.
    const tokenSnap = await tokenRef(uid).get();
    if (tokenSnap.exists) {
      await revokeToken(tokenSnap.data()?.refreshToken);
      await tokenRef(uid).delete();
      await syncRef(uid).delete();
      summary.calendarDisconnected = true;
    }
    await db.collection("serverLimits").doc(uid).delete();

    // 10. The sign in itself, last, because every step above is easier to retry while the
    // account still exists.
    try {
      await auth.deleteUser(uid);
      summary.userDeleted = true;
    } catch (cause) {
      if (cause?.code !== "auth/user-not-found") throw cause;
    }

    // 11. One log line: uids and counts, no email, no name, no check-in numbers.
    logLine("account delete", {
      uid,
      household: householdId || "none",
      entries: summary.anonymisedEntries,
      shared: summary.anonymisedShared,
      invites: summary.invitesRevoked,
      householdDeleted: summary.householdDeleted,
    });

    return sendJson(res, 200, { ok: true, ...summary });
  } catch (cause) {
    console.error("[account delete]", cause?.code, cause?.message);
    return fail(
      res,
      500,
      cause?.code || "account/delete-failed",
      "We could not finish deleting your account. Nothing was left half done that we cannot retry: try again in a moment.",
    );
  }
}
