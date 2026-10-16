// Firestore for the chat between the two parents.
//
// households/{hid}/chat/{messageId}
//   { from: uid, text (1 to 200 characters), kind: "text" | "thanks", createdAt }
//   Written once and never edited or deleted. "thanks" marks a thank you, so the weekly
//   summary can count them.
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "./db";
import { withTimeout } from "@/app/utils/timeout";

const TAG = "[app chat]";
export const CHAT_MAX = 100;
export const CHAT_TEXT_MAX = 200;
export const CHAT_KINDS = Object.freeze(["text", "thanks"]);

const chatRef = (hid) => collection(db, "households", hid, "chat");

// Live newest-first list. Orders by createdAt only, so no composite index is needed.
export function subscribeChat(hid, onData, onError, { max = CHAT_MAX } = {}) {
  const q = query(chatRef(hid), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error(TAG, error?.code, error);
      onError?.(error);
    },
  );
}

export async function sendChat(hid, { from, text, kind = "text" }) {
  const clean = String(text ?? "").trim().slice(0, CHAT_TEXT_MAX);
  if (!from || !clean || !CHAT_KINDS.includes(kind)) {
    const error = new Error("There is nothing to send.");
    error.code = "chat/empty";
    throw error;
  }
  const ref = await withTimeout(addDoc(chatRef(hid), { from, text: clean, kind, createdAt: serverTimestamp() }));
  return ref.id;
}
