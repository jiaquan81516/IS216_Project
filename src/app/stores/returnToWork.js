import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  addTask as apiAddTask,
  deleteTask as apiDeleteTask,
  migrateLegacyRtw,
  saveRtwPlan,
  setPumping,
  setResponsibility as apiSetResponsibility,
  subscribeRtwPlan,
  subscribeTasks,
  toggleTask as apiToggleTask,
  updateTask as apiUpdateTask,
} from "@/api/rtw";
import { isIsoDate } from "@/app/utils/rotaHelpers";
import { PUMPING_ITEMS, PUMPING_SESSIONS, PUMPING_TIMES, RESPONSIBILITY_AREAS, TASK_GROUPS } from "@/app/data/rtw";

const GROUP_VALUES = TASK_GROUPS.map((g) => g.value);
const TIME_VALUES = PUMPING_TIMES.map((t) => t.value);

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
    queued: Boolean(data.queued),
  };
}

// The shared return to work plan. Firestore is the only store: no localStorage.
export const useReturnToWorkStore = defineStore("app-return-to-work", () => {
  const plan = ref(null); // the raw plan document, or null before the first save
  const tasks = ref([]);
  const loading = ref(true);
  const error = ref(null); // { code } or null
  const writeError = ref("");
  const householdId = ref("");
  const meUid = ref("");
  const partnerUid = ref("");

  let stops = [];
  let seen = new Set();
  let migrating = false;
  let run = 0;

  function unbind() {
    run += 1;
    for (const stop of stops) stop();
    stops = [];
    seen = new Set();
    plan.value = null;
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

  function mark(name) {
    seen.add(name);
    if (seen.size === 2) loading.value = false;
  }

  async function migrate() {
    if (migrating || !householdId.value || !meUid.value) return;
    migrating = true;
    await migrateLegacyRtw(householdId.value, meUid.value, partnerUid.value);
  }

  function bind(id, uid = "", partner = "") {
    unbind();
    const current = run;
    meUid.value = uid;
    partnerUid.value = partner;
    if (!id) return;
    householdId.value = id;
    const guard = (fn) => (value) => {
      if (current !== run) return;
      fn(value);
    };
    const onError = guard((cause) => fail(cause));
    try {
      stops = [
        subscribeRtwPlan(
          id,
          guard((data) => {
            plan.value = data;
            error.value = null;
            mark("plan");
            migrate();
          }),
          onError,
        ),
        subscribeTasks(
          id,
          guard((list) => {
            tasks.value = list;
            mark("tasks");
          }),
          onError,
        ),
      ];
    } catch (cause) {
      console.error("[app return to work]", cause?.code, cause);
      fail(cause);
    }
  }

  function setPartnerUid(uid) {
    partnerUid.value = uid ?? "";
  }

  const returnDate = computed(() => (isIsoDate(plan.value?.returnDate) ? plan.value.returnDate : null));
  const responsibilities = computed(() => {
    const saved = plan.value?.responsibilities ?? {};
    const out = {};
    for (const area of RESPONSIBILITY_AREAS) out[area.key] = saved[area.key] ?? null;
    return out;
  });
  // The checklist as the page draws it: the fixed items plus what is ticked in Firestore.
  const pumpingItems = computed(() => {
    const done = plan.value?.pumping?.items ?? {};
    return PUMPING_ITEMS.map((item) => ({ key: item.key, label: item.label, done: Boolean(done[item.key]) }));
  });
  const pumping = computed(() => {
    const saved = plan.value?.pumping ?? {};
    return {
      items: pumpingItems.value,
      sessions: PUMPING_SESSIONS.includes(saved.sessions) ? saved.sessions : null,
      times: Array.isArray(saved.times) ? saved.times.filter((t) => TIME_VALUES.includes(t)) : [],
    };
  });
  const updatedAt = computed(() => plan.value?.updatedAt ?? null);
  const updatedBy = computed(() => plan.value?.updatedBy ?? null);

  async function attempt(action, message) {
    if (!householdId.value) return false;
    writeError.value = "";
    try {
      await action();
      return true;
    } catch (cause) {
      console.error("[app return to work]", cause?.code, cause);
      writeError.value = message;
      return false;
    }
  }

  const saveFailed = "We could not save the plan. Check your connection and try again.";

  function setReturnDate(iso) {
    return attempt(
      () => saveRtwPlan(householdId.value, meUid.value, { returnDate: isIsoDate(iso) ? iso : null }),
      saveFailed,
    );
  }

  async function addTask(data) {
    const task = cleanTask(data);
    if (!task) return null;
    const ok = await attempt(
      () => apiAddTask(householdId.value, meUid.value, task),
      "We could not add the task. Check your connection and try again.",
    );
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

  // owner is a uid, "both" or null for not decided.
  function setResponsibility(key, owner) {
    if (!RESPONSIBILITY_AREAS.some((a) => a.key === key)) return Promise.resolve(false);
    return attempt(() => apiSetResponsibility(householdId.value, meUid.value, key, owner ?? null), saveFailed);
  }

  function togglePumpingItem(key) {
    if (!PUMPING_ITEMS.some((i) => i.key === key)) return Promise.resolve(false);
    const done = pumpingItems.value.find((i) => i.key === key)?.done ?? false;
    return attempt(() => setPumping(householdId.value, meUid.value, { items: { [key]: !done } }), saveFailed);
  }

  function setSessions(count) {
    const sessions = PUMPING_SESSIONS.includes(count) ? count : null;
    return attempt(() => setPumping(householdId.value, meUid.value, { sessions }), saveFailed);
  }

  function togglePumpingTime(time) {
    if (!TIME_VALUES.includes(time)) return Promise.resolve(false);
    const current = pumping.value.times;
    const times = current.includes(time) ? current.filter((t) => t !== time) : [...current, time];
    return attempt(() => setPumping(householdId.value, meUid.value, { times }), saveFailed);
  }

  return {
    plan,
    tasks,
    loading,
    error,
    writeError,
    householdId,
    meUid,
    partnerUid,
    returnDate,
    responsibilities,
    pumping,
    pumpingItems,
    updatedAt,
    updatedBy,
    bind,
    unbind,
    setPartnerUid,
    setReturnDate,
    addTask,
    updateTask,
    toggleTask,
    removeTask,
    setResponsibility,
    togglePumpingItem,
    setSessions,
    togglePumpingTime,
  };
});
