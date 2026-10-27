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
  startAfter,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./db";
import { withTimeout } from "@/app/utils/timeout";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";
const { selectedBabyId } = useSelectedBaby();

export { ENTRY_TYPES, groupByDay, lastOfType, summariseEntry, todayStats } from "@/app/utils/entryHelpers";

function entriesRef(householdId) {
  return collection(db, "households", householdId, "entries");
}

function stamp(value) {
  if (value instanceof Date) return Timestamp.fromDate(value);
  return value ?? null;
}

function fromSnap(snap) {
  return { id: snap.id, ...snap.data() };
}

export async function addEntry(user, householdId, { type, at, endedAt = null, details = {}, byName = "", babyId = selectedBabyId.value }) {
  const ref = await addDoc(entriesRef(householdId), {
    type,
    babyId,
    at: stamp(at),
    endedAt: stamp(endedAt),
    by: user.uid,
    byName,
    details,
    seenBy: { [user.uid]: serverTimestamp() },
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEntry(householdId, entryId, patch) {
  const next = { ...patch };
  if ("at" in next) next.at = stamp(next.at);
  if ("endedAt" in next) next.endedAt = stamp(next.endedAt);
  await updateDoc(doc(db, "households", householdId, "entries", entryId), next);
}

export async function deleteEntry(householdId, entryId) {
  await deleteDoc(doc(db, "households", householdId, "entries", entryId));
}

// Marks entries as seen by this user. Only the caller's own key in seenBy is written.
export async function markSeen(householdId, entryIds, uid) {
  if (!entryIds.length) return;
  const batch = writeBatch(db);
  for (const id of entryIds) {
    batch.update(doc(db, "households", householdId, "entries", id), {
      [`seenBy.${uid}`]: serverTimestamp(),
    });
  }
  await batch.commit();
}

// Live newest-first list. Returns the unsubscribe function.
export function subscribeEntries(householdId, onData, onError, { max = 50 } = {}) {
  const q = query(entriesRef(householdId), orderBy("at", "desc"), limit(max));
  // An empty collection is a normal snapshot with no docs, not an error. Local writes fire
  // the listener at once, so a saved entry shows up without waiting for the server.
  return onSnapshot(
    q,
    { includeMetadataChanges: false },
    (snap) => onData(snap.docs.map(fromSnap)),
    (error) => {
      console.error("[app care log]", error?.code, error);
      onError?.(error);
    },
  );
}

export async function loadOlder(householdId, beforeAt, max = 50) {
  const q = query(entriesRef(householdId), orderBy("at", "desc"), startAfter(stamp(beforeAt)), limit(max));
  const snap = await withTimeout(getDocs(q));
  return snap.docs.map(fromSnap);
}
