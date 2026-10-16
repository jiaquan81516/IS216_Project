// Firestore for the one small thing partners can choose to share: how they feel today.
//
// households/{hid}/feelings/{uid}
//   { uid, level: "hard" | "okay" | "good", date: "yyyy-mm-dd", updatedAt }
//   One document per person, written only when that person chose to share how they feel.
//   Turning sharing off deletes it.
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./db";
import { withTimeout } from "@/app/utils/timeout";

const TAG = "[app team]";
export const FEELING_LEVELS = Object.freeze(["hard", "okay", "good"]);

const feelingsRef = (hid) => collection(db, "households", hid, "feelings");
const feelingRef = (hid, uid) => doc(db, "households", hid, "feelings", uid);

// Live feelings, as a map of uid to { level, date }.
export function subscribeFeelings(hid, onData, onError) {
  return onSnapshot(
    feelingsRef(hid),
    (snap) => {
      const map = {};
      for (const d of snap.docs) {
        const data = d.data();
        if (FEELING_LEVELS.includes(data?.level)) map[d.id] = { level: data.level, date: String(data.date ?? "") };
      }
      onData(map);
    },
    (error) => {
      console.error(TAG, error?.code, error);
      onError?.(error);
    },
  );
}

export async function setFeeling(hid, uid, { level, date }) {
  if (!FEELING_LEVELS.includes(level)) {
    const error = new Error("Choose how you feel first.");
    error.code = "team/bad-level";
    throw error;
  }
  await withTimeout(setDoc(feelingRef(hid, uid), { uid, level, date, updatedAt: serverTimestamp() }));
}

export async function clearFeeling(hid, uid) {
  await withTimeout(deleteDoc(feelingRef(hid, uid)));
}
