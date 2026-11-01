import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  cancelSwap as apiCancelSwap,
  clearNightOverride,
  migrateLegacyRota,
  requestSwap as apiRequestSwap,
  respondToSwap,
  saveRotaSettings,
  setNightOverride,
  subscribeNights,
  subscribeRotaSettings,
  subscribeSwaps,
} from "@/api/rota";
import { addDays, isIsoDate, mondayOf, toIso } from "@/app/utils/rotaHelpers";
import { ownerKey, ownerUid } from "@/app/utils/sharedHelpers";

const PATTERNS = ["alternate", "split", "manual"];
// Who looks after the baby, hour by hour. The rota still plans the nights; this lets you paint any
// hour of the day with a parent, both, or someone else (a nanny, a grandparent, childcare). It is a list of
// 24 values, one for each hour of the day starting at midnight. A value is a uid, "both", "other:Label",
// or an empty string for "use the default" (the rota for the evening and night, open in the day).
const HOURS = 24;
function cleanHours(list) {
  const out = Array(HOURS).fill(null);
  if (!Array.isArray(list)) return out;
  for (let h = 0; h < HOURS; h += 1) {
    const value = typeof list[h] === "string" ? list[h] : "";
    if (!value || value === "none") continue;
    if (value.startsWith("other:")) out[h] = { who: "other", label: value.slice(6, 30) || "Someone else" };
    else out[h] = { who: value, label: "" };
  }
  return out;
}
// The earlier shift choices (a list of shifts, or morning and afternoon) become hours.
function legacyHours(data) {
  const list = Array(HOURS).fill("");
  const put = (cover, from, to) => {
    if (!cover || typeof cover.who !== "string" || cover.who === "none") return;
    for (let h = from; h < to; h += 1) list[h] = cover.who === "other" ? `other:${cover.label || "Someone else"}` : cover.who;
  };
  if (Array.isArray(data?.dayShifts)) {
    for (const shift of data.dayShifts) {
      const from = Math.floor(Number(String(shift?.start ?? "").slice(0, 2)) + Number(String(shift?.start ?? "").slice(3, 5)) / 60);
      const to = Math.ceil(Number(String(shift?.end ?? "").slice(0, 2)) + Number(String(shift?.end ?? "").slice(3, 5)) / 60);
      if (Number.isFinite(from) && Number.isFinite(to)) put(shift, Math.max(0, from), Math.min(HOURS, to));
    }
  } else if (data?.dayCover) {
    put(data.dayCover.morning, 6, 12);
    put(data.dayCover.afternoon, 12, 18);
  }
  return list;
}

// Overrides are loaded for a year either side of today, which covers the rota week view and
// the calendar month grid without a second listener.
const WINDOW_DAYS = 365;

export function rotaDefaults(today = new Date()) {
  return { pattern: "alternate", startDate: mondayOf(today), handoverTime: "07:00", firstOnDuty: null };
}

// The shared sleep rota. Firestore is the only store: nothing is kept in localStorage.
export const useRotaStore = defineStore("app-rota", () => {
  const settings = ref(null); // the raw settings document, or null before the first save
  const nights = ref({}); // ISO date to { date, onCall, setBy, setAt }
  const swaps = ref([]);
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
    settings.value = null;
    nights.value = {};
    swaps.value = [];
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
    if (seen.size === 3) loading.value = false;
  }

  async function migrate() {
    if (migrating || !householdId.value || !meUid.value) return;
    migrating = true;
    await migrateLegacyRota(householdId.value, meUid.value, partnerUid.value);
  }

  // Attaches the three listeners for one household. Call unbind first when the id changes.
  function bind(id, uid = "", partner = "") {
    unbind();
    const current = run;
    meUid.value = uid;
    partnerUid.value = partner;
    if (!id) return;
    householdId.value = id;
    const today = toIso(new Date());
    const from = addDays(today, -WINDOW_DAYS);
    const to = addDays(today, WINDOW_DAYS);
    const guard = (fn) => (value) => {
      if (current !== run) return;
      fn(value);
    };
    const onError = guard((cause) => fail(cause));
    try {
      stops = [
        subscribeRotaSettings(
          id,
          guard((data) => {
            settings.value = data;
            error.value = null;
            mark("settings");
            migrate();
          }),
          onError,
        ),
        subscribeNights(
          id,
          from,
          to,
          guard((list) => {
            nights.value = Object.fromEntries(list.map((n) => [n.date, n]));
            mark("nights");
          }),
          onError,
        ),
        subscribeSwaps(
          id,
          guard((list) => {
            swaps.value = list;
            mark("swaps");
          }),
          onError,
        ),
      ];
    } catch (cause) {
      console.error("[app rota]", cause?.code, cause);
      fail(cause);
    }
  }

  function setPartnerUid(uid) {
    partnerUid.value = uid ?? "";
  }

  // The settings with defaults filled in, still holding uids.
  const plan = computed(() => {
    const base = rotaDefaults();
    const data = settings.value ?? {};
    return {
      pattern: PATTERNS.includes(data.pattern) ? data.pattern : base.pattern,
      startDate: isIsoDate(data.startDate) ? data.startDate : base.startDate,
      handoverTime: /^\d{2}:\d{2}$/.test(data.handoverTime ?? "") ? data.handoverTime : base.handoverTime,
      firstOnDuty: data.firstOnDuty ?? null,
      hourCover: cleanHours(Array.isArray(data.hourCover) ? data.hourCover : legacyHours(data)),
      updatedAt: data.updatedAt ?? null,
      updatedBy: data.updatedBy ?? null,
    };
  });

  // The same plan in the "me" and "partner" shape the pure helpers in rotaHelpers.js use.
  const view = computed(() => {
    const me = meUid.value;
    const overrides = {};
    for (const [date, night] of Object.entries(nights.value)) {
      const who = ownerKey(night?.onCall, me);
      if (who) overrides[date] = who;
    }
    return {
      pattern: plan.value.pattern,
      firstOnDuty: ownerKey(plan.value.firstOnDuty, me) === "partner" ? "partner" : "me",
      startDate: plan.value.startDate,
      handoverTime: plan.value.handoverTime,
      hourCover: plan.value.hourCover.map((cell) =>
        cell ? { ...cell, who: cell.who === "both" || cell.who === "other" ? cell.who : ownerKey(cell.who, me) } : null,
      ),
      overrides,
      swaps: swaps.value.map((s) => ({ ...s, from: ownerKey(s.from, me) ?? "me" })),
    };
  });

  const pending = computed(() => swaps.value.filter((s) => s.status === "pending"));
  const history = computed(() => swaps.value.filter((s) => s.status !== "pending" && s.status !== "cancelled"));

  async function attempt(action, message) {
    if (!householdId.value) return false;
    writeError.value = "";
    try {
      await action();
      return true;
    } catch (cause) {
      console.error("[app rota]", cause?.code, cause);
      writeError.value = message;
      return false;
    }
  }

  function saveSettings(patch) {
    return attempt(
      () => saveRotaSettings(householdId.value, meUid.value, patch),
      "We could not save the plan. Check your connection and try again.",
    );
  }
  function setPattern(pattern) {
    return saveSettings({ pattern });
  }
  function setFirstOnDuty(who) {
    const uid = who === "partner" ? partnerUid.value : meUid.value;
    return saveSettings({ firstOnDuty: uid || meUid.value });
  }
  function setStartDate(startDate) {
    return saveSettings({ startDate });
  }
  // The hours you painted: a list of 24 cells, each null (use the default) or { who: "me" | "partner" | "both" | "other", label }.
  // Saves the whole list, so an erased hour goes too.
  function setHourCover(cells) {
    const stored = Array.from({ length: HOURS }, (_, h) => {
      const cell = cells?.[h];
      if (!cell?.who) return "";
      if (cell.who === "me" || cell.who === "partner") return ownerUid(cell.who, meUid.value, partnerUid.value) || "";
      if (cell.who === "other") return `other:${cell.label || "Someone else"}`;
      return cell.who === "both" ? "both" : "";
    });
    return saveSettings({ hourCover: stored });
  }
  function setHandoverTime(handoverTime) {
    return saveSettings({ handoverTime });
  }

  // who is "me", "partner", "open" or null to go back to the pattern.
  function setOverride(date, who) {
    if (!isIsoDate(date)) return Promise.resolve(false);
    if (who === null || who === undefined) {
      return attempt(
        () => clearNightOverride(householdId.value, date),
        "We could not clear that night. Check your connection and try again.",
      );
    }
    let onCall = "open";
    if (who === "me") onCall = meUid.value;
    else if (who === "partner") onCall = partnerUid.value || "open";
    return attempt(
      () => setNightOverride(householdId.value, meUid.value, date, onCall),
      "We could not save that night. Check your connection and try again.",
    );
  }

  // I give away `date` and take `withDate` in return (null for nothing in return).
  function requestSwap({ date, withDate = null, message = "" }) {
    return attempt(
      () =>
        apiRequestSwap(householdId.value, {
          date,
          withDate,
          from: meUid.value,
          to: partnerUid.value || null,
          message,
        }),
      "We could not send the swap request. Check your connection and try again.",
    );
  }

  // Accepting moves the nights as well, in one batch.
  function respondSwap(id, accept) {
    const swap = swaps.value.find((s) => s.id === id);
    if (!swap) return Promise.resolve(false);
    const taker = swap.to || meUid.value;
    // A cover offer ("I will take tonight") has no night of its own to give, so only withDate moves.
    const nightsToSet = accept
      ? [...(swap.date ? [{ date: swap.date, onCall: taker }] : []), ...(swap.withDate ? [{ date: swap.withDate, onCall: swap.from }] : [])]
      : [];
    return attempt(
      () => respondToSwap(householdId.value, id, accept, { uid: meUid.value, nights: nightsToSet }),
      "We could not answer that request. Check your connection and try again.",
    );
  }

  function cancelRequest(id) {
    return attempt(
      () => apiCancelSwap(householdId.value, id),
      "We could not cancel that request. Check your connection and try again.",
    );
  }

  // "Apply suggestion" now asks the other parent instead of changing the plan alone. Returns
  // "requested", "taken" when I simply take a night off my partner, or "" when it failed.
  async function applyAction(action) {
    if (!action) return "";
    const mine = ownerKey(action.from, meUid.value) !== "partner";
    if (!mine && !action.withDate) {
      // Nothing to offer in return, so I take that night on myself. Nobody needs to agree.
      return (await setOverride(action.date, "me")) ? "taken" : "";
    }
    const ok = await requestSwap({
      date: mine ? action.date : action.withDate,
      withDate: mine ? (action.withDate ?? null) : action.date,
      message: "",
    });
    return ok ? "requested" : "";
  }

  // Back to the default pattern, and every loaded override cleared for both parents.
  async function reset() {
    const ok = await saveSettings({ ...rotaDefaults(), firstOnDuty: meUid.value, hourCover: Array(HOURS).fill(""), dayShifts: [] });
    if (!ok) return false;
    const dates = Object.keys(nights.value);
    for (const date of dates) {
      const done = await attempt(
        () => clearNightOverride(householdId.value, date),
        "We could not clear every night. Check your connection and try again.",
      );
      if (!done) return false;
    }
    return true;
  }

  return {
    settings,
    nights,
    swaps,
    loading,
    error,
    writeError,
    householdId,
    meUid,
    partnerUid,
    plan,
    view,
    pending,
    history,
    bind,
    unbind,
    setPartnerUid,
    saveSettings,
    setPattern,
    setFirstOnDuty,
    setStartDate,
    setHandoverTime,
    setHourCover,
    setOverride,
    requestSwap,
    respondSwap,
    cancelRequest,
    applyAction,
    reset,
  };
});
