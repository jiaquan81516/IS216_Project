// Firestore for the shared return to work plan. Pure helpers stay in rtwHelpers.js.
//
// households/{hid}/tasks/{taskId}
//   { title, group, due, owner, queued, done, doneAt, doneBy, notes, createdBy, createdAt, updatedAt }
//   queued: the owner has marked it to pass on at the next handover
// households/{hid}/rtw/plan
//   { returnDate, responsibilities: { areaKey: uid|"both"|null },
//     pumping: { items: { key: bool }, sessions, times }, updatedAt, updatedBy }
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./db";
import { withTimeout } from "@/app/utils/timeout";
import { clearLegacy, legacyOwner, LEGACY_RTW_KEY, readLegacy } from "@/app/utils/legacy";

const TAG = "[app return to work]";
export const TASKS_MAX = 200;

const planRef = (hid) => doc(db, "households", hid, "rtw", "plan");
const tasksRef = (hid) => collection(db, "households", hid, "tasks");
const taskRef = (hid, taskId) => doc(db, "households", hid, "tasks", taskId);

function report(onError, error) {
  console.error(TAG, error?.code, error);
  onError?.(error);
}

// Live task list, ordered by due date (tasks without one come first). One field, so there is
// no composite index. The page regroups and resorts with groupTasks.
export function subscribeTasks(hid, onData, onError, { max = TASKS_MAX } = {}) {
  const q = query(tasksRef(hid), orderBy("due"), limit(max));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => report(onError, error),
  );
}

// Live plan document. onData gets null until the first write creates it.
export function subscribeRtwPlan(hid, onData, onError) {
  return onSnapshot(
    planRef(hid),
    (snap) => onData(snap.exists() ? snap.data() : null),
    (error) => report(onError, error),
  );
}

export async function addTask(hid, uid, { title, group = "home", owner = "both", due = null, notes = "", queued = false, done = false }) {
  const ref = await addDoc(tasksRef(hid), {
    title,
    group,
    due,
    owner,
    queued: Boolean(queued),
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

// Creates the plan document on the first write.
export async function saveRtwPlan(hid, uid, patch) {
  await setDoc(planRef(hid), { ...patch, updatedAt: serverTimestamp(), updatedBy: uid }, { merge: true });
}

// owner is a uid, "both" or null. Merging a nested map leaves the other areas alone.
export async function setResponsibility(hid, uid, areaKey, owner) {
  await saveRtwPlan(hid, uid, { responsibilities: { [areaKey]: owner } });
}

// patch is any part of { items: { key: bool }, sessions, times }.
export async function setPumping(hid, uid, patch) {
  await saveRtwPlan(hid, uid, { pumping: patch });
}

// One time lift of a browser only plan into the household, only when nothing is saved yet.
export async function migrateLegacyRtw(hid, uid, partnerUid) {
  const legacy = readLegacy(LEGACY_RTW_KEY);
  if (!legacy) return false;
  try {
    const [plan, tasks] = await Promise.all([
      withTimeout(getDoc(planRef(hid))),
      withTimeout(getDocs(query(tasksRef(hid), limit(1)))),
    ]);
    if (plan.exists() || !tasks.empty) {
      clearLegacy(LEGACY_RTW_KEY);
      return false;
    }

    const patch = {};
    if (legacy.returnDate) patch.returnDate = legacy.returnDate;
    const responsibilities = {};
    for (const [key, who] of Object.entries(legacy.responsibilities ?? {})) {
      const owner = legacyOwner(who, uid, partnerUid);
      if (owner) responsibilities[key] = owner;
    }
    if (Object.keys(responsibilities).length) patch.responsibilities = responsibilities;
    const items = {};
    for (const item of legacy.pumping?.items ?? []) {
      if (item?.key && item.done) items[item.key] = true;
    }
    const pumping = {};
    if (Object.keys(items).length) pumping.items = items;
    if (legacy.pumping?.sessions) pumping.sessions = legacy.pumping.sessions;
    if (Array.isArray(legacy.pumping?.times) && legacy.pumping.times.length) pumping.times = legacy.pumping.times;
    if (Object.keys(pumping).length) patch.pumping = pumping;
    if (Object.keys(patch).length) await saveRtwPlan(hid, uid, patch);

    for (const task of legacy.tasks ?? []) {
      if (!task || typeof task.title !== "string" || !task.title.trim()) continue;
      await addTask(hid, uid, {
        title: task.title.trim(),
        group: task.group || "home",
        owner: legacyOwner(task.owner, uid, partnerUid) ?? "both",
        due: task.due ?? null,
        notes: typeof task.notes === "string" ? task.notes : "",
        done: Boolean(task.done),
      });
    }
    clearLegacy(LEGACY_RTW_KEY);
    return true;
  } catch (error) {
    console.error(TAG, error?.code, error);
    return false;
  }
}
