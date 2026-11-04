import { defineStore } from "pinia";
import { ref } from "vue";
import {
  addTask as apiAddTask,
  deleteTask as apiDeleteTask,
  subscribeTasks,
  toggleTask as apiToggleTask,
  updateTask as apiUpdateTask,
} from "@/api/tasks";
import { notifyPartner } from "@/api/push";
import { isIsoDate } from "@/app/utils/rotaHelpers";
import { TASK_GROUPS } from "@/app/data/tasks";

const GROUP_VALUES = TASK_GROUPS.map((g) => g.value);

// Keeps a task draft inside the shapes the page and the rules expect. Returns null when the
// task has no title. `owner` is already a uid or "both".
export function cleanTask(data, fallbackOwner = "both") {
  if (!data || typeof data !== "object" || typeof data.title !== "string" || !data.title.trim()) return null;
  return {
    title: data.title.trim().slice(0, 120),
    group: GROUP_VALUES.includes(data.group) ? data.group : "home",
    due: isIsoDate(data.due) ? data.due : null,
    owner: data.owner || fallbackOwner,
    notes: typeof data.notes === "string" ? data.notes : "",
  };
}

// The shared task list (the checklist). Firestore is the only store: no localStorage.
export const useTasksStore = defineStore("app-tasks", () => {
  const tasks = ref([]);
  const loading = ref(true);
  const error = ref(null); // { code } or null
  const writeError = ref("");
  const householdId = ref("");
  const meUid = ref("");
  const partnerUid = ref("");

  let stop = null;
  let run = 0;

  function unbind() {
    run += 1;
    if (stop) stop();
    stop = null;
    tasks.value = [];
    loading.value = true;
    error.value = null;
    writeError.value = "";
    householdId.value = "";
  }

  function fail(cause) {
    loading.value = false;
    error.value = { code: cause?.code ?? "unknown" };
  }

  function bind(id, uid = "", partner = "") {
    unbind();
    const current = run;
    meUid.value = uid;
    partnerUid.value = partner;
    if (!id) return;
    householdId.value = id;
    try {
      stop = subscribeTasks(
        id,
        (list) => {
          if (current !== run) return;
          tasks.value = list;
          error.value = null;
          loading.value = false;
        },
        (cause) => {
          if (current === run) fail(cause);
        },
      );
    } catch (cause) {
      console.error("[app tasks]", cause?.code, cause);
      fail(cause);
    }
  }

  function setPartnerUid(uid) {
    partnerUid.value = uid ?? "";
  }

  async function attempt(action, message) {
    if (!householdId.value) return false;
    writeError.value = "";
    try {
      await action();
      return true;
    } catch (cause) {
      console.error("[app tasks]", cause?.code, cause);
      writeError.value = message;
      return false;
    }
  }

  // A task given to the other parent gets a system notification. "both" and your own tasks
  // do not. Fire and forget: the server re-reads the task and checks everything itself.
  function announce(taskId, owner) {
    if (!taskId || !owner || owner === "both" || owner === meUid.value) return;
    notifyPartner(householdId.value, "task", taskId);
  }

  async function addTask(data) {
    const task = cleanTask(data);
    if (!task) return null;
    // Captured locally (not in a variable shared across calls) so two addTask calls racing
    // each other can never announce the wrong task's id.
    let newId;
    const ok = await attempt(
      async () => {
        newId = await apiAddTask(householdId.value, meUid.value, task);
      },
      "We could not add the task. Check your connection and try again.",
    );
    if (ok) announce(newId, task.owner);
    return ok ? task : null;
  }

  async function updateTask(id, patch) {
    const existing = tasks.value.find((t) => t.id === id);
    if (!existing) return null;
    const task = cleanTask({ ...existing, ...patch });
    if (!task) return null;
    const ok = await attempt(
      () => apiUpdateTask(householdId.value, id, task),
      "We could not save the task. Check your connection and try again.",
    );
    if (ok && task.owner !== existing.owner) announce(id, task.owner);
    return ok ? { id, ...task } : null;
  }

  function toggleTask(id) {
    const task = tasks.value.find((t) => t.id === id);
    if (!task) return Promise.resolve(false);
    return attempt(
      () => apiToggleTask(householdId.value, id, !task.done, meUid.value),
      "We could not save the task. Check your connection and try again.",
    );
  }

  function removeTask(id) {
    return attempt(
      () => apiDeleteTask(householdId.value, id),
      "We could not delete the task. Check your connection and try again.",
    );
  }

  return {
    tasks,
    loading,
    error,
    writeError,
    householdId,
    meUid,
    partnerUid,
    bind,
    unbind,
    setPartnerUid,
    addTask,
    updateTask,
    toggleTask,
    removeTask,
  };
});
