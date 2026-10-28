// Admin review of pumping rooms.
//
// A new room waits as approval "pending" until an administrator accepts it (it goes live) or
// rejects it (it is kept, with an optional note, and never goes live). Rooms from before this
// feature have no approval field and count as approved.
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./db";
import { notifyRoomRejected } from "./push";

export const REVIEW_NOTE_MAX = 200;

const roomsRef = () => collection(db, "pumpingRooms");
const millis = (value) => value?.toMillis?.() ?? 0;

function listen(q, pick, onData, onError) {
  return onSnapshot(
    q,
    (snap) => onData(pick(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (error) => {
      console.error("[app room review]", error?.code, error);
      onError?.({ code: error?.code ?? "unknown" });
    },
  );
}

// Rooms waiting for review, oldest first.
export function subscribePendingRooms(onData, onError) {
  return listen(
    query(roomsRef(), where("approval", "==", "pending")),
    (rooms) => rooms.sort((a, b) => millis(a.createdAt) - millis(b.createdAt)),
    onData,
    onError,
  );
}

// Rooms an administrator has decided on, newest decision first.
export function subscribeReviewedRooms(onData, onError) {
  return listen(
    query(roomsRef(), where("approval", "in", ["approved", "rejected"])),
    (rooms) => rooms.filter((room) => room.reviewedAt).sort((a, b) => millis(b.reviewedAt) - millis(a.reviewedAt)),
    onData,
    onError,
  );
}

export async function reviewRoom(uid, roomId, decision, note = "") {
  if (!uid || !roomId) throw new Error("A signed-in administrator and a room are required.");
  if (decision !== "approved" && decision !== "rejected") throw new Error("A review is either approved or rejected.");
  const data = { approval: decision, reviewedBy: uid, reviewedAt: serverTimestamp() };
  const cleanNote = String(note ?? "").trim().slice(0, REVIEW_NOTE_MAX);
  if (decision === "rejected" && cleanNote) data.reviewNote = cleanNote;
  await updateDoc(doc(roomsRef(), roomId), data);
  // Tell the parent who suggested it. A failed or skipped notification never undoes the review.
  if (decision === "rejected") notifyRoomRejected(roomId);
}
