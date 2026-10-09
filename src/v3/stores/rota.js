import { defineStore } from "pinia";
import { reactive, toRefs, watch } from "vue";
import {
  addPendingSwap,
  applySwap,
  cancelSwap,
  isIsoDate,
  mondayOf,
  resolveSwap,
} from "@/v3/api/rotaHelpers";

export const ROTA_KEY = "nt.v3.rota";

const PATTERNS = ["alternate", "split", "manual"];

function defaults() {
  return {
    pattern: "alternate",
    firstOnDuty: "me",
    startDate: mondayOf(new Date()),
    handoverTime: "07:00",
    overrides: {},
    swaps: [],
  };
}

function load() {
  const base = defaults();
  try {
    const data = JSON.parse(localStorage.getItem(ROTA_KEY) || "null");
    if (!data || typeof data !== "object") return base;
    return {
      pattern: PATTERNS.includes(data.pattern) ? data.pattern : base.pattern,
      firstOnDuty: data.firstOnDuty === "partner" ? "partner" : "me",
      startDate: isIsoDate(data.startDate) ? data.startDate : base.startDate,
      handoverTime: /^\d{2}:\d{2}$/.test(data.handoverTime ?? "") ? data.handoverTime : base.handoverTime,
      overrides: data.overrides && typeof data.overrides === "object" ? data.overrides : {},
      swaps: Array.isArray(data.swaps) ? data.swaps : [],
    };
  } catch {
    return base;
  }
}

// Local only until the database is connected. Persisted to localStorage under nt.v3.rota.
export const useRotaStore = defineStore("v3-rota", () => {
  const state = reactive(load());

  watch(
    state,
    (value) => {
      try {
        localStorage.setItem(ROTA_KEY, JSON.stringify(value));
      } catch {
        // Storage can be blocked; the plan then lives in memory only.
      }
    },
    { deep: true, flush: "sync" },
  );

  function setOverride(date, who) {
    if (who === "me" || who === "partner" || who === "open") state.overrides[date] = who;
    else delete state.overrides[date];
  }
  function requestSwap({ date, withDate = null, message = "" }) {
    state.swaps = addPendingSwap(state.swaps, { date, withDate, from: "me", message });
  }
  function respondSwap(id, accept) {
    state.swaps = resolveSwap(state.swaps, id, accept);
  }
  function cancelRequest(id) {
    state.swaps = cancelSwap(state.swaps, id);
  }
  // Applies a swap straight away (used by "Apply suggestion").
  function applyAction(action) {
    state.swaps = applySwap(state.swaps, action);
  }
  function reset() {
    Object.assign(state, defaults());
  }

  return { ...toRefs(state), setOverride, requestSwap, respondSwap, cancelRequest, applyAction, reset };
});
