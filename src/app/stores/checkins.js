import { defineStore } from "pinia";
import { reactive, toRefs, watch } from "vue";
import { saveCheckin, subscribeCheckins } from "@/api/checkins";

export const CHECKINS_KEY = "nt.app.checkins";
const OWNER_KEY = "nt.app.checkins-owner";

export function dateKey(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

const clamp = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);
// Short keys such as "exhausted". Older check-ins have none of the optional fields.
const cleanList = (list, max) =>
  Array.isArray(list) ? [...new Set(list.filter((c) => typeof c === "string" && c.length <= 40))].slice(0, max) : [];

function clean(date, value) {
  return {
    date,
    mood: clamp(value.mood),
    stress: clamp(value.stress),
    energy: clamp(value.energy),
    closeness: clamp(value.closeness),
    concerns: cleanList(value.concerns, 3),
    body: cleanList(value.body, 8),
    lifts: cleanList(value.lifts, 8),
    savedAt: String(value.savedAt ?? ""),
  };
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(CHECKINS_KEY) || "null");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const out = {};
    for (const [key, value] of Object.entries(data)) {
      const mood = clamp(value?.mood);
      const stress = clamp(value?.stress);
      if (mood && stress) out[key] = clean(key, value);
    }
    return out;
  } catch {
    return {};
  }
}

export const DAY_MS = 24 * 60 * 60 * 1000;

function lastSevenOf(items, now) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    const date = dateKey(d);
    return { date, weekday: d.toLocaleDateString("en-GB", { weekday: "short" }), entry: items[date] ?? null };
  });
}

// The newest check-in saved in the last 24 hours, or null.
function newestWithin(items, now) {
  let best = null;
  for (const entry of Object.values(items)) {
    const at = new Date(entry.savedAt).getTime();
    if (Number.isNaN(at) || at > now.getTime() + 60000 || now.getTime() - at >= DAY_MS) continue;
    if (!best || at > new Date(best.savedAt).getTime()) best = entry;
  }
  return best;
}

// Check-ins are shared by the two parents: they live under the household in Firestore, one per
// person per day, and both read them. A copy of your own stays on this device so the page still
// works before the household loads. Saving again the same day replaces the check-in.
export const useCheckinsStore = defineStore("app-checkins", () => {
  const state = reactive({ items: load(), partnerItems: {}, loaded: false, error: "" });
  let householdId = "";
  let meUid = "";
  let stop = null;
  let run = 0;

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

  function unbind() {
    run += 1;
    stop?.();
    stop = null;
    householdId = "";
    state.partnerItems = {};
    state.loaded = false;
  }

  function bind(id, uid = "") {
    unbind();
    const current = run;
    meUid = uid;
    if (!id || !uid) return;
    householdId = id;
    // The device copy belongs to whoever last used it, so a second account never inherits it.
    try {
      const owner = localStorage.getItem(OWNER_KEY);
      if (owner && owner !== uid) state.items = {};
      localStorage.setItem(OWNER_KEY, uid);
    } catch {
      // Storage can be blocked. Nothing else depends on it.
    }
    try {
      stop = subscribeCheckins(
        id,
        (docs) => {
          if (current !== run) return;
          const mine = {};
          const theirs = {};
          for (const d of docs) {
            if (!clamp(d.mood) || !clamp(d.stress)) continue;
            const entry = clean(d.date, d);
            (d.uid === uid ? mine : theirs)[d.date] = entry;
          }
          // Anything saved here before the household loaded goes up once, so it is not lost.
          const first = !state.loaded;
          state.items = { ...state.items, ...mine };
          state.partnerItems = theirs;
          state.loaded = true;
          if (first) {
            for (const [date, entry] of Object.entries(state.items)) {
              if (!mine[date]) saveCheckin(id, uid, entry).catch(() => {});
            }
          }
        },
        () => {
          if (current === run) state.loaded = true;
        },
      );
    } catch (cause) {
      console.error("[app checkins]", cause?.code, cause);
      state.loaded = true;
    }
  }

  function setPartnerUid() {}

  // Mood and stress are required; energy, closeness, concerns, body and lifts are optional.
  function save(answers, now = new Date()) {
    const date = dateKey(now);
    state.items[date] = clean(date, { ...answers, savedAt: now.toISOString() });
    const entry = state.items[date];
    state.error = "";
    if (householdId && meUid) {
      saveCheckin(householdId, meUid, entry).catch((cause) => {
        console.error("[app checkins]", cause?.code, cause);
        state.error =
          cause?.code === "permission-denied"
            ? "Your database rules do not allow check-ins yet. Publish the latest firestore.rules in the Firebase console."
            : "Your check-in is saved on this device, but we could not share it with your partner just now.";
      });
    }
    return entry;
  }

  function forDate(date) {
    return state.items[date] ?? null;
  }

  // Six days before `now`, then today, oldest first.
  function lastSeven(now = new Date()) {
    return lastSevenOf(state.items, now);
  }
  function partnerLastSeven(now = new Date()) {
    return lastSevenOf(state.partnerItems, now);
  }

  // Your newest check-in from the last 24 hours. While it stands, the quiz is not asked again.
  function recent(now = new Date()) {
    return newestWithin(state.items, now);
  }

  return { ...toRefs(state), save, forDate, lastSeven, partnerLastSeven, recent, bind, unbind, setPartnerUid };
});
