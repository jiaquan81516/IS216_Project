// Firestore for the wellness check-ins. Both parents can read them, so the app can show the
// week as a pair and the summary can tell you when your partner is having a hard time.
//
// households/{hid}/checkins/{uid}_{yyyy-mm-dd}
//   { uid, date, mood, stress, energy, closeness, concerns, body, lifts, savedAt, updatedAt }
//   One document per person per day. Saving again the same day replaces it. Only its owner writes.
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./db";
import { withTimeout } from "@/app/utils/timeout";

const TAG = "[app checkins]";

const checkinsRef = (hid) => collection(db, "households", hid, "checkins");
export const checkinId = (uid, date) => `${uid}_${date}`;

// Live check-ins, as a list of { uid, date, ...answers }.
export function subscribeCheckins(hid, onData, onError) {
  return onSnapshot(
    checkinsRef(hid),
    (snap) => onData(snap.docs.map((d) => d.data()).filter((d) => d?.uid && d?.date)),
    (error) => {
      console.error(TAG, error?.code, error);
      onError?.(error);
    },
  );
}

export async function saveCheckin(hid, uid, entry) {
  const { date, mood, stress, energy, closeness, concerns, body, lifts, savedAt } = entry;
  await withTimeout(
    setDoc(doc(db, "households", hid, "checkins", checkinId(uid, date)), {
      uid,
      date,
      mood,
      stress,
      energy: energy ?? null,
      closeness: closeness ?? null,
      concerns: concerns ?? [],
      body: body ?? [],
      lifts: lifts ?? [],
      savedAt,
      updatedAt: serverTimestamp(),
    }),
  );
}
