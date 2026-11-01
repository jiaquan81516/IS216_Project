// Firestore for the family photo frame on Home. One photo per household, shared by both parents.
//
// households/{hid}/photo/frame
//   { image: "data:image/jpeg;base64,...", caption (up to 40 characters), updatedBy, updatedAt }
//   The photo is shrunk in the browser before it is saved, so it stays well under the 1 MB
//   document limit and no Firebase Storage is needed.
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./db";
import { withTimeout } from "@/app/utils/timeout";

const TAG = "[app photo]";
export const PHOTO_MAX_CHARS = 380000; // the rules allow up to 400000
export const CAPTION_MAX = 40;

const frameRef = (hid) => doc(db, "households", hid, "photo", "frame");

// Live photo, or null when there is none.
export function subscribeFamilyPhoto(hid, onData, onError) {
  return onSnapshot(
    frameRef(hid),
    (snap) => {
      const data = snap.data();
      onData(data && typeof data.image === "string" ? { image: data.image, caption: String(data.caption ?? "") } : null);
    },
    (error) => {
      console.error(TAG, error?.code, error);
      onError?.(error);
    },
  );
}

export async function saveFamilyPhoto(hid, uid, { image, caption = "" }) {
  const text = String(caption).trim().slice(0, CAPTION_MAX);
  if (typeof image !== "string" || image.length > PHOTO_MAX_CHARS) {
    const error = new Error("That photo is too large.");
    error.code = "photo/too-large";
    throw error;
  }
  await withTimeout(setDoc(frameRef(hid), { image, caption: text, updatedBy: uid, updatedAt: serverTimestamp() }));
}

export async function removeFamilyPhoto(hid) {
  await withTimeout(deleteDoc(frameRef(hid)));
}
