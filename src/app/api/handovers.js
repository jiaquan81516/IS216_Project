// Firestore for the shared handover. Same shape as entries.js: live listeners that report
// { code } on failure, writes that always stamp who did them, and nothing kept locally.
//
// households/{hid}/handovers/{handoverId}
//   { from, to, sentAt, periodStart, note, needsAttention, attentionNote,
//     summary: { feeds, sleepMinutes, nappies }, nextUp, tasks: [{ id, text, ref }],
//     acceptedAt, acceptedBy, createdAt }
//
// sentAt is the sending device's clock rather than serverTimestamp(), so the shift window the
// sender just read on screen is exactly what is stored, the list is ordered the moment the
// write is made locally, and the next handover's periodStart can be read straight back.
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./db";
import { cleanTasks, TASKS_MAX } from "./handoverHelpers";

const TAG = "[app handover]";
export const HANDOVERS_MAX = 30;
export const NOTE_MAX = 400;
export const ATTENTION_MAX = 140;
export const NEXT_UP_MAX = 3;
export { TASKS_MAX };

const handoversRef = (hid) => collection(db, "households", hid, "handovers");
const handoverRef = (hid, id) => doc(db, "households", hid, "handovers", id);

function stamp(value) {
  if (value instanceof Date) return Timestamp.fromDate(value);
  return value ?? null;
}

function report(onError, error) {
  console.error(TAG, error?.code, error);
  onError?.(error);
}

// Live newest-first list. One listener serves Home, the care log dividers and the handover
// page, so nothing needs a second query. Orders by sentAt only, so no composite index.
export function subscribeHandovers(hid, onData, onError, { max = HANDOVERS_MAX } = {}) {
  const q = query(handoversRef(hid), orderBy("sentAt", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => report(onError, error),
  );
}

// The newest handover on its own. Kept for a page that needs nothing else; the app shell uses
// subscribeHandovers instead, because one list of 30 is cheaper than two listeners.
export function subscribeLatestHandover(hid, onData, onError) {
  const q = query(handoversRef(hid), orderBy("sentAt", "desc"), limit(1));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.length ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null),
    (error) => report(onError, error),
  );
}

// Sends the shift over. `summary` is a snapshot worked out from the care log at this moment,
// so it never changes again, even when an entry is edited later.
export async function sendHandover(
  user,
  hid,
  { to, note = "", needsAttention = false, attentionNote = "", nextUp = [], tasks = [], periodStart = null, summary = {} } = {},
) {
  const ref = await addDoc(handoversRef(hid), {
    from: user.uid,
    to: to ?? null,
    sentAt: stamp(new Date()),
    periodStart: stamp(periodStart),
    note: String(note).slice(0, NOTE_MAX),
    needsAttention: Boolean(needsAttention),
    attentionNote: needsAttention ? String(attentionNote).slice(0, ATTENTION_MAX) : "",
    summary: {
      feeds: Number(summary.feeds) || 0,
      sleepMinutes: Number(summary.sleepMinutes) || 0,
      nappies: Number(summary.nappies) || 0,
    },
    nextUp: (nextUp ?? []).slice(0, NEXT_UP_MAX).map((text) => String(text)),
    tasks: cleanTasks(tasks),
    acceptedAt: null,
    acceptedBy: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// The reader accepts it. The rules only let `to` write these two fields, and only once.
export async function acceptHandover(hid, id, uid) {
  await updateDoc(handoverRef(hid, id), { acceptedAt: serverTimestamp(), acceptedBy: uid });
}

// Fixing a handover you already sent. Only the four written fields can change, and the rules
// allow it only while acceptedAt is still null and only for `from`.
export async function updateHandover(hid, id, patch = {}) {
  const next = { updatedAt: serverTimestamp() };
  if ("note" in patch) next.note = String(patch.note).slice(0, NOTE_MAX);
  if ("needsAttention" in patch) next.needsAttention = Boolean(patch.needsAttention);
  if ("attentionNote" in patch) next.attentionNote = String(patch.attentionNote).slice(0, ATTENTION_MAX);
  if ("nextUp" in patch) next.nextUp = (patch.nextUp ?? []).slice(0, NEXT_UP_MAX).map((text) => String(text));
  await updateDoc(handoverRef(hid, id), next);
}
