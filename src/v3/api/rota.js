// Firestore for the shared sleep rota. Live listeners, one shot reads with a timeout, and
// writes that always stamp who did them. The plan maths stays in rotaHelpers.js.
//
// households/{hid}/rota/settings  { pattern, firstOnDuty, startDate, handoverTime, updatedAt, updatedBy }
// households/{hid}/nights/{yyyy-mm-dd}  { date, onCall, setBy, setAt }
// households/{hid}/swaps/{swapId}  { date, withDate, from, to, status, message, createdAt, respondedAt }
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./db";
import { withTimeout } from "./timeout";
import { clearLegacy, legacyOwner, LEGACY_ROTA_KEY, readLegacy } from "./legacy";

const TAG = "[v3 rota]";
export const SWAPS_MAX = 50;

const settingsRef = (hid) => doc(db, "households", hid, "rota", "settings");
const nightsRef = (hid) => collection(db, "households", hid, "nights");
const nightRef = (hid, date) => doc(db, "households", hid, "nights", date);
const swapsRef = (hid) => collection(db, "households", hid, "swaps");
const swapRef = (hid, swapId) => doc(db, "households", hid, "swaps", swapId);

function report(onError, error) {
  console.error(TAG, error?.code, error);
  onError?.(error);
}

// Live plan settings. Calls onData with the document data, or null when nothing is saved yet.
export function subscribeRotaSettings(hid, onData, onError) {
  return onSnapshot(
    settingsRef(hid),
    (snap) => onData(snap.exists() ? snap.data() : null),
    (error) => report(onError, error),
  );
}

// Live per night overrides between two ISO dates, both ends included. The query ranges over
// one field, so it needs no composite index.
export function subscribeNights(hid, fromIso, toIso, onData, onError) {
  const q = query(nightsRef(hid), where("date", ">=", fromIso), where("date", "<=", toIso), orderBy("date"));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ date: d.id, ...d.data() }))),
    (error) => report(onError, error),
  );
}

// Live swap requests, newest first. Status is filtered in the page, so no composite index.
export function subscribeSwaps(hid, onData, onError, { max = SWAPS_MAX } = {}) {
  const q = query(swapsRef(hid), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => report(onError, error),
  );
}

// Creates the settings document on the first write.
export async function saveRotaSettings(hid, uid, patch) {
  await setDoc(settingsRef(hid), { ...patch, updatedAt: serverTimestamp(), updatedBy: uid }, { merge: true });
}

// onCall is a uid or the string "open".
export async function setNightOverride(hid, uid, date, onCall) {
  await setDoc(nightRef(hid, date), { date, onCall, setBy: uid, setAt: serverTimestamp() }, { merge: true });
}

export async function clearNightOverride(hid, date) {
  await deleteDoc(nightRef(hid, date));
}

export async function requestSwap(hid, { date, withDate = null, from, to = null, message = "" }) {
  const ref = await addDoc(swapsRef(hid), {
    date,
    withDate,
    from,
    to,
    status: "pending",
    message,
    createdAt: serverTimestamp(),
    respondedAt: null,
  });
  return ref.id;
}

// Accepting applies the night overrides in the same batch as the status change, so the plan
// and the answer never disagree. `nights` is [{ date, onCall }].
export async function respondToSwap(hid, swapId, accept, { uid, nights = [] } = {}) {
  const batch = writeBatch(db);
  batch.update(swapRef(hid, swapId), {
    status: accept ? "accepted" : "declined",
    respondedAt: serverTimestamp(),
  });
  if (accept) {
    for (const night of nights) {
      batch.set(
        nightRef(hid, night.date),
        { date: night.date, onCall: night.onCall, setBy: uid, setAt: serverTimestamp() },
        { merge: true },
      );
    }
  }
  await batch.commit();
}

export async function cancelSwap(hid, swapId) {
  await updateDoc(swapRef(hid, swapId), { status: "cancelled", respondedAt: serverTimestamp() });
}

// One time lift of an old browser only plan into the household. It runs only when nothing is
// saved in Firestore yet, and the key is removed either way so it never runs twice.
export async function migrateLegacyRota(hid, uid, partnerUid) {
  const legacy = readLegacy(LEGACY_ROTA_KEY);
  if (!legacy) return false;
  try {
    const existing = await withTimeout(getDoc(settingsRef(hid)));
    if (existing.exists()) {
      clearLegacy(LEGACY_ROTA_KEY);
      return false;
    }
    const patch = {};
    if (legacy.pattern) patch.pattern = legacy.pattern;
    if (legacy.startDate) patch.startDate = legacy.startDate;
    if (legacy.handoverTime) patch.handoverTime = legacy.handoverTime;
    const first = legacyOwner(legacy.firstOnDuty, uid, partnerUid);
    if (first) patch.firstOnDuty = first;
    await saveRotaSettings(hid, uid, patch);

    const overrides = legacy.overrides && typeof legacy.overrides === "object" ? legacy.overrides : {};
    for (const [date, who] of Object.entries(overrides)) {
      const onCall = legacyOwner(who, uid, partnerUid);
      if (onCall) await setNightOverride(hid, uid, date, onCall);
    }
    clearLegacy(LEGACY_ROTA_KEY);
    return true;
  } catch (error) {
    console.error(TAG, error?.code, error);
    return false;
  }
}
