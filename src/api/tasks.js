// Firestore for the shared checklist tasks.
//
// households/{hid}/tasks/{taskId}
//   { title, group, due, owner, done, doneAt, doneBy, notes, createdBy, createdAt, updatedAt }
import {
  addDoc,
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

const TAG = "[app tasks]";
export const TASKS_MAX = 200;

const tasksRef = (hid) => collection(db, "households", hid, "tasks");
const taskRef = (hid, taskId) => doc(db, "households", hid, "tasks", taskId);

function report(onError, error) {
  console.error(TAG, error?.code, error);
  onError?.(error);
}

// Live task list, ordered by due date (tasks without one come first). One field, so there is
// no composite index. The pages regroup and resort it.
export function subscribeTasks(hid, onData, onError, { max = TASKS_MAX } = {}) {
  const q = query(tasksRef(hid), orderBy("due"), limit(max));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => report(onError, error),
  );
}

export async function addTask(hid, uid, { title, group = "home", owner = "both", due = null, notes = "", done = false }) {
  const ref = await addDoc(tasksRef(hid), {
    title,
    group,
    due,
    owner,
    done,
    doneAt: done ? serverTimestamp() : null,
    doneBy: done ? uid : null,
    notes,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// Either parent may edit a shared task.
export async function updateTask(hid, taskId, patch) {
  await updateDoc(taskRef(hid, taskId), { ...patch, updatedAt: serverTimestamp() });
}

// Ticking a task records who finished it, so the list can say so.
export async function toggleTask(hid, taskId, done, uid) {
  await updateDoc(taskRef(hid, taskId), {
    done,
    doneAt: done ? serverTimestamp() : null,
    doneBy: done ? uid : null,
    updatedAt: serverTimestamp(),
  });
}

// Either parent may delete a shared task.
export async function deleteTask(hid, taskId) {
  await deleteDoc(taskRef(hid, taskId));
}
