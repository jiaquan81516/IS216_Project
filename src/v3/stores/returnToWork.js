import { defineStore } from "pinia";
import { reactive, toRefs, watch } from "vue";
import { isIsoDate } from "@/v3/api/rotaHelpers";
import { PUMPING_ITEMS, PUMPING_SESSIONS, PUMPING_TIMES, RESPONSIBILITY_AREAS, TASK_GROUPS } from "@/v3/data/rtw";

export const RTW_KEY = "nt.v3.rtw";

const GROUP_VALUES = TASK_GROUPS.map((g) => g.value);
const OWNERS = ["me", "partner", "both"];
const TIME_VALUES = PUMPING_TIMES.map((t) => t.value);

function blankPumping() {
  return {
    items: PUMPING_ITEMS.map((i) => ({ key: i.key, label: i.label, done: false })),
    sessions: null,
    times: [],
  };
}

function defaults() {
  return { returnDate: null, tasks: [], responsibilities: {}, pumping: blankPumping() };
}

function cleanTask(t) {
  if (!t || typeof t !== "object" || typeof t.title !== "string" || !t.title.trim()) return null;
  return {
    id: String(t.id ?? makeId()),
    title: t.title.trim(),
    group: GROUP_VALUES.includes(t.group) ? t.group : "home",
    due: isIsoDate(t.due) ? t.due : null,
    owner: OWNERS.includes(t.owner) ? t.owner : "both",
    done: Boolean(t.done),
    notes: typeof t.notes === "string" ? t.notes : "",
  };
}

function load() {
  const base = defaults();
  try {
    const data = JSON.parse(localStorage.getItem(RTW_KEY) || "null");
    if (!data || typeof data !== "object") return base;
    const doneKeys = new Set(
      Array.isArray(data.pumping?.items) ? data.pumping.items.filter((i) => i && i.done).map((i) => i.key) : [],
    );
    const responsibilities = {};
    for (const area of RESPONSIBILITY_AREAS) {
      const who = data.responsibilities?.[area.key];
      responsibilities[area.key] = OWNERS.includes(who) ? who : null;
    }
    return {
      returnDate: isIsoDate(data.returnDate) ? data.returnDate : null,
      tasks: Array.isArray(data.tasks) ? data.tasks.map(cleanTask).filter(Boolean) : [],
      responsibilities,
      pumping: {
        items: base.pumping.items.map((i) => ({ ...i, done: doneKeys.has(i.key) })),
        sessions: PUMPING_SESSIONS.includes(data.pumping?.sessions) ? data.pumping.sessions : null,
        times: Array.isArray(data.pumping?.times) ? data.pumping.times.filter((t) => TIME_VALUES.includes(t)) : [],
      },
    };
  } catch {
    return base;
  }
}

function makeId() {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Local only until the database is connected. Persisted to localStorage under nt.v3.rtw.
export const useReturnToWorkStore = defineStore("v3-return-to-work", () => {
  const state = reactive(load());

  watch(
    state,
    (value) => {
      try {
        localStorage.setItem(RTW_KEY, JSON.stringify(value));
      } catch {
        // Storage can be blocked; the plan then lives in memory only.
      }
    },
    { deep: true, flush: "sync" },
  );

  function setReturnDate(iso) {
    state.returnDate = isIsoDate(iso) ? iso : null;
  }

  function addTask({ title, group = "home", owner = "both", due = null, notes = "" }) {
    const task = cleanTask({ id: makeId(), title, group, owner, due, done: false, notes });
    if (!task) return null;
    state.tasks.push(task);
    return task;
  }
  function updateTask(id, patch) {
    const index = state.tasks.findIndex((t) => t.id === id);
    if (index === -1) return;
    const next = cleanTask({ ...state.tasks[index], ...patch, id });
    if (next) state.tasks[index] = next;
  }
  function toggleTask(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (task) task.done = !task.done;
  }
  function removeTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
  }

  function setResponsibility(key, who) {
    if (!RESPONSIBILITY_AREAS.some((a) => a.key === key)) return;
    state.responsibilities[key] = OWNERS.includes(who) ? who : null;
  }

  function togglePumpingItem(key) {
    const item = state.pumping.items.find((i) => i.key === key);
    if (item) item.done = !item.done;
  }
  function setSessions(count) {
    state.pumping.sessions = PUMPING_SESSIONS.includes(count) ? count : null;
  }
  function togglePumpingTime(time) {
    if (!TIME_VALUES.includes(time)) return;
    const has = state.pumping.times.includes(time);
    state.pumping.times = has ? state.pumping.times.filter((t) => t !== time) : [...state.pumping.times, time];
  }

  function reset() {
    Object.assign(state, defaults());
  }

  return {
    ...toRefs(state),
    setReturnDate,
    addTask,
    updateTask,
    toggleTask,
    removeTask,
    setResponsibility,
    togglePumpingItem,
    setSessions,
    togglePumpingTime,
    reset,
  };
});
