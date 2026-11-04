import { collection, collectionGroup, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./db";

export function subscribeAdminRoomFeedback(roomId, onData, onError) {
  const source = roomId
    ? collection(db, "pumpingRooms", roomId, "feedback")
    : collectionGroup(db, "feedback");
  return onSnapshot(source, (snapshot) => {
    const items = snapshot.docs
      .filter((item) => item.ref.parent.parent?.parent.id === "pumpingRooms")
      .map((item) => ({ ...item.data(), id: item.id, roomId: item.ref.parent.parent.id }));
    onData(items.sort((a, b) => (b.at?.toMillis?.() || 0) - (a.at?.toMillis?.() || 0)));
  }, onError);
}

export async function editRoomFeedback(uid, roomId, feedbackId, text) {
  const clean = String(text ?? "").trim();
  if (!uid || !roomId || !feedbackId || !clean || clean.length > 400) {
    throw new Error("Enter feedback of 1 to 400 characters and sign in again if needed.");
  }
  await updateDoc(doc(db, "pumpingRooms", roomId, "feedback", feedbackId), {
    text: clean,
    editedBy: uid,
    editedAt: serverTimestamp(),
  });
}
