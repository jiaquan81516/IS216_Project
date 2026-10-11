// Firestore for the shared calendar. Pure date and layout helpers stay in calendarHelpers.js.
//
// households/{hid}/events/{eventId}
//   { title, date, endDate, allDay, start, end, owner, type, notes,
//     createdBy, createdAt, updatedAt, googleEventId }
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./db";
import { withTimeout } from "./timeout";
import { clearLegacy, legacyOwner, LEGACY_CALENDAR_KEY, readLegacy } from "./legacy";

const TAG = "[v3 calendar]";
export const EVENTS_MAX = 500;

const eventsRef = (hid) => collection(db, "households", hid, "events");
const eventRef = (hid, eventId) => doc(db, "households", hid, "events", eventId);

function report(onError, error) {
  console.error(TAG, error?.code, error);
  onError?.(error);
}

// Live events in date order. Without a window it is the whole calendar, capped at EVENTS_MAX,
// so the month view can move to any month. A window ranges over one field, so neither shape
// needs a composite index.
export function subscribeEvents(hid, onData, onError, { fromIso = "", toIso = "", max = EVENTS_MAX } = {}) {
  const parts = [];
  if (fromIso) parts.push(where("date", ">=", fromIso));
  if (toIso) parts.push(where("date", "<=", toIso));
  const q = query(eventsRef(hid), ...parts, orderBy("date"), limit(max));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => report(onError, error),
  );
}

export async function addEvent(hid, uid, data) {
  const ref = await addDoc(eventsRef(hid), {
    ...data,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    googleEventId: null,
  });
  return ref.id;
}

// Either parent may edit a shared event.
export async function updateEvent(hid, eventId, patch) {
  await updateDoc(eventRef(hid, eventId), { ...patch, updatedAt: serverTimestamp() });
}

// Either parent may delete a shared event.
export async function deleteEvent(hid, eventId) {
  await deleteDoc(eventRef(hid, eventId));
}

// One time lift of browser only events into the household, only when the calendar is empty.
export async function migrateLegacyCalendar(hid, uid, partnerUid) {
  const legacy = readLegacy(LEGACY_CALENDAR_KEY);
  const events = Array.isArray(legacy) ? legacy : null;
  if (!events) {
    if (legacy) clearLegacy(LEGACY_CALENDAR_KEY);
    return false;
  }
  try {
    const existing = await withTimeout(getDocs(query(eventsRef(hid), limit(1))));
    if (!existing.empty) {
      clearLegacy(LEGACY_CALENDAR_KEY);
      return false;
    }
    for (const event of events) {
      if (!event || typeof event.title !== "string" || !event.title.trim() || !event.date) continue;
      await addEvent(hid, uid, {
        title: event.title.trim(),
        date: event.date,
        endDate: event.endDate || event.date,
        allDay: Boolean(event.allDay),
        start: event.allDay ? null : (event.start ?? null),
        end: event.allDay ? null : (event.end ?? null),
        owner: legacyOwner(event.owner, uid, partnerUid) ?? "both",
        type: event.type || "family",
        notes: typeof event.notes === "string" ? event.notes : "",
      });
    }
    clearLegacy(LEGACY_CALENDAR_KEY);
    return true;
  } catch (error) {
    console.error(TAG, error?.code, error);
    return false;
  }
}
