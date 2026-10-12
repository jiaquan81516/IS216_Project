// Firestore for the household stream's plain messages. Same shape as entries.js.
//
// households/{hid}/posts/{postId}
//   { text (1 to 500 characters), authorUid, createdAt, ackedBy: [uid], ackedAt }
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./db";
import { withTimeout } from "@/app/utils/timeout";

const TAG = "[app posts]";
export const POSTS_MAX = 50;
export const POST_TEXT_MAX = 500;

const postsRef = (hid) => collection(db, "households", hid, "posts");
const postRef = (hid, id) => doc(db, "households", hid, "posts", id);

// Live newest-first list. Orders by createdAt only, so no composite index is needed.
export function subscribePosts(hid, onData, onError, { max = POSTS_MAX } = {}) {
  const q = query(postsRef(hid), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error(TAG, error?.code, error);
      onError?.(error);
    },
  );
}

export async function addPost(hid, uid, text) {
  const ref = await withTimeout(
    addDoc(postsRef(hid), {
      text: String(text).trim().slice(0, POST_TEXT_MAX),
      authorUid: uid,
      createdAt: serverTimestamp(),
      ackedBy: [],
    }),
  );
  return ref.id;
}

// The reader acknowledges. The rules let a member who is not the author add their own uid.
export async function ackPost(hid, id, uid) {
  await withTimeout(updateDoc(postRef(hid, id), { ackedBy: arrayUnion(uid), ackedAt: serverTimestamp() }));
}

// Only the author may delete.
export async function deletePost(hid, id) {
  await withTimeout(deleteDoc(postRef(hid, id)));
}
