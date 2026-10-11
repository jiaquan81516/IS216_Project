import { defineStore } from "pinia";
import { reactive, toRefs, watch } from "vue";

export const CHECKINS_KEY = "nt.v3.checkins";

export function dateKey(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

const clamp = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(CHECKINS_KEY) || "null");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const out = {};
    for (const [key, value] of Object.entries(data)) {
      const mood = clamp(value?.mood);
      const stress = clamp(value?.stress);
      if (mood && stress) out[key] = { date: key, mood, stress, savedAt: String(value.savedAt ?? "") };
    }
    return out;
  } catch {
    return {};
  }
}

// Private to this device. One check-in per day; saving again the same day replaces it.
export const useCheckinsStore = defineStore("v3-checkins", () => {
  const state = reactive({ items: load() });

  watch(
    () => state.items,
    (value) => {
      try {
        localStorage.setItem(CHECKINS_KEY, JSON.stringify(value));
      } catch {
        // Storage can be blocked; the check-in then lives in memory only.
      }
    },
    { deep: true, flush: "sync" },
  );

  function save({ mood, stress }, now = new Date()) {
    const date = dateKey(now);
    state.items[date] = { date, mood, stress, savedAt: now.toISOString() };
    return state.items[date];
  }

  function forDate(date) {
    return state.items[date] ?? null;
  }

  // Six days before `now`, then today, oldest first.
  function lastSeven(now = new Date()) {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      const date = dateKey(d);
      return { date, weekday: d.toLocaleDateString("en-GB", { weekday: "short" }), entry: state.items[date] ?? null };
    });
  }

  return { ...toRefs(state), save, forDate, lastSeven };
});
