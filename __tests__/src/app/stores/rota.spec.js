import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";

const api = vi.hoisted(() => ({
  settings: null,
  settingsError: null,
  nights: null,
  swaps: null,
  stops: 0,
  saveRotaSettings: vi.fn(async () => {}),
  setNightOverride: vi.fn(async () => {}),
  clearNightOverride: vi.fn(async () => {}),
  requestSwap: vi.fn(async () => "s-new"),
  respondToSwap: vi.fn(async () => {}),
  cancelSwap: vi.fn(async () => {}),
  migrateLegacyRota: vi.fn(async () => false),
}));

vi.mock("@/app/api/rota", () => ({
  subscribeRotaSettings: (hid, onData, onError) => {
    api.settings = onData;
    api.settingsError = onError;
    return () => {
      api.stops += 1;
    };
  },
  subscribeNights: (hid, from, to, onData) => {
    api.nights = onData;
    api.nightsRange = { from, to };
    return () => {
      api.stops += 1;
    };
  },
  subscribeSwaps: (hid, onData) => {
    api.swaps = onData;
    return () => {
      api.stops += 1;
    };
  },
  saveRotaSettings: (...a) => api.saveRotaSettings(...a),
  setNightOverride: (...a) => api.setNightOverride(...a),
  clearNightOverride: (...a) => api.clearNightOverride(...a),
  requestSwap: (...a) => api.requestSwap(...a),
  respondToSwap: (...a) => api.respondToSwap(...a),
  cancelSwap: (...a) => api.cancelSwap(...a),
  migrateLegacyRota: (...a) => api.migrateLegacyRota(...a),
}));

import { useRotaStore } from "@/app/stores/rota";

const ME = "u1";
const PARTNER = "u2";

function fresh() {
  setActivePinia(createPinia());
  return useRotaStore();
}
// Reports one snapshot for each of the three listeners.
function snapshot(store, { settings = null, nights = [], swaps = [] } = {}) {
  api.settings(settings);
  api.nights(nights);
  api.swaps(swaps);
  return store;
}

beforeEach(() => {
  api.settings = null;
  api.nights = null;
  api.swaps = null;
  api.stops = 0;
  for (const key of [
    "saveRotaSettings",
    "setNightOverride",
    "clearNightOverride",
    "requestSwap",
    "respondToSwap",
    "cancelSwap",
    "migrateLegacyRota",
  ]) {
    api[key].mockClear();
  }
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("rota store binding", () => {
  it("loads, and shows no error, until a household id arrives", () => {
    const store = fresh();
    expect(store.loading).toBe(true);
    expect(store.error).toBeNull();
    store.bind("", ME, PARTNER);
    expect(store.loading).toBe(true);
    expect(store.error).toBeNull();
    expect(api.settings).toBeNull();
  });

  it("fills the plan, the nights and the swaps from one snapshot each", () => {
    const store = fresh();
    store.bind("h1", ME, PARTNER);
    expect(store.loading).toBe(true);
    snapshot(store, {
      settings: { pattern: "manual", firstOnDuty: PARTNER, startDate: "2026-10-12", handoverTime: "08:30" },
      nights: [{ date: "2026-10-14", onCall: ME, setBy: ME }],
      swaps: [{ id: "s1", date: "2026-10-14", from: PARTNER, to: ME, status: "pending" }],
    });
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.plan).toMatchObject({ pattern: "manual", firstOnDuty: PARTNER, handoverTime: "08:30" });
    expect(store.nights["2026-10-14"].onCall).toBe(ME);
    expect(store.pending).toHaveLength(1);
  });

  it("maps uids onto the me and partner shape the plan helpers use", () => {
    const store = fresh();
    store.bind("h1", ME, PARTNER);
    snapshot(store, {
      settings: { pattern: "alternate", firstOnDuty: PARTNER, startDate: "2026-10-12" },
      nights: [
        { date: "2026-10-14", onCall: ME },
        { date: "2026-10-15", onCall: PARTNER },
        { date: "2026-10-16", onCall: "open" },
      ],
      swaps: [{ id: "s1", date: "2026-10-19", from: PARTNER, to: ME, status: "accepted" }],
    });
    expect(store.view.firstOnDuty).toBe("partner");
    expect(store.view.overrides).toEqual({
      "2026-10-14": "me",
      "2026-10-15": "partner",
      "2026-10-16": "open",
    });
    expect(store.view.swaps[0].from).toBe("partner");
  });

  it("uses the defaults until something is saved", () => {
    const store = fresh();
    store.bind("h1", ME, PARTNER);
    snapshot(store);
    expect(store.plan).toMatchObject({ pattern: "alternate", handoverTime: "07:00", firstOnDuty: null });
    expect(store.view.firstOnDuty).toBe("me");
  });

  it("reports a failed listener by code and stops listening on unbind", () => {
    const store = fresh();
    store.bind("h1", ME, PARTNER);
    api.settingsError({ code: "permission-denied" });
    expect(store.loading).toBe(false);
    expect(store.error).toEqual({ code: "permission-denied" });
    store.unbind();
    expect(api.stops).toBe(3);
    expect(store.error).toBeNull();
    expect(store.householdId).toBe("");
  });

  it("moves the old browser plan up once, after the first snapshot", async () => {
    const store = fresh();
    store.bind("h1", ME, PARTNER);
    snapshot(store);
    await nextTick();
    expect(api.migrateLegacyRota).toHaveBeenCalledWith("h1", ME, PARTNER);
    api.settings(null);
    expect(api.migrateLegacyRota).toHaveBeenCalledTimes(1);
  });
});

describe("rota store writes", () => {
  function bound() {
    const store = fresh();
    store.bind("h1", ME, PARTNER);
    snapshot(store, {
      settings: { pattern: "alternate", firstOnDuty: ME, startDate: "2026-10-12", handoverTime: "07:00" },
      nights: [{ date: "2026-10-14", onCall: ME }],
      swaps: [
        { id: "s1", date: "2026-10-19", withDate: "2026-10-20", from: PARTNER, to: ME, status: "pending" },
        { id: "s2", date: "2026-10-21", withDate: null, from: ME, to: PARTNER, status: "pending" },
      ],
    });
    return store;
  }

  it("saves the settings with my uid", async () => {
    const store = bound();
    await store.setPattern("split");
    expect(api.saveRotaSettings).toHaveBeenCalledWith("h1", ME, { pattern: "split" });
    await store.setFirstOnDuty("partner");
    expect(api.saveRotaSettings).toHaveBeenLastCalledWith("h1", ME, { firstOnDuty: PARTNER });
    await store.setHandoverTime("08:30");
    expect(api.saveRotaSettings).toHaveBeenLastCalledWith("h1", ME, { handoverTime: "08:30" });
  });

  it("turns a night choice into a uid, and clears a night", async () => {
    const store = bound();
    await store.setOverride("2026-10-14", "me");
    expect(api.setNightOverride).toHaveBeenCalledWith("h1", ME, "2026-10-14", ME);
    await store.setOverride("2026-10-15", "partner");
    expect(api.setNightOverride).toHaveBeenLastCalledWith("h1", ME, "2026-10-15", PARTNER);
    await store.setOverride("2026-10-16", "open");
    expect(api.setNightOverride).toHaveBeenLastCalledWith("h1", ME, "2026-10-16", "open");
    await store.setOverride("2026-10-14", null);
    expect(api.clearNightOverride).toHaveBeenCalledWith("h1", "2026-10-14");
    await store.setOverride("not a date", "me");
    expect(api.setNightOverride).toHaveBeenCalledTimes(3);
  });

  it("asks in my own name and sends it to my partner", async () => {
    const store = bound();
    await store.requestSwap({ date: "2026-10-14", withDate: "2026-10-16", message: "I am unwell" });
    expect(api.requestSwap).toHaveBeenCalledWith("h1", {
      date: "2026-10-14",
      withDate: "2026-10-16",
      from: ME,
      to: PARTNER,
      message: "I am unwell",
    });
  });

  it("accepting a swap hands the nights over in the same write", async () => {
    const store = bound();
    await store.respondSwap("s1", true);
    expect(api.respondToSwap).toHaveBeenCalledWith("h1", "s1", true, {
      uid: ME,
      nights: [
        { date: "2026-10-19", onCall: ME },
        { date: "2026-10-20", onCall: PARTNER },
      ],
    });
  });

  it("declining sends no nights, and cancelling is mine to do", async () => {
    const store = bound();
    await store.respondSwap("s1", false);
    expect(api.respondToSwap).toHaveBeenCalledWith("h1", "s1", false, { uid: ME, nights: [] });
    await store.cancelRequest("s2");
    expect(api.cancelSwap).toHaveBeenCalledWith("h1", "s2");
    expect(await store.respondSwap("missing", true)).toBe(false);
  });

  it("applying a suggestion asks instead of changing the plan alone", async () => {
    const store = bound();
    expect(await store.applyAction({ date: "2026-10-14", withDate: "2026-10-16", from: "me" })).toBe("requested");
    expect(api.requestSwap).toHaveBeenLastCalledWith("h1", {
      date: "2026-10-14",
      withDate: "2026-10-16",
      from: ME,
      to: PARTNER,
      message: "",
    });
    // When the partner is the one carrying too many nights, I simply take that night.
    expect(await store.applyAction({ date: "2026-10-18", withDate: null, from: "partner" })).toBe("taken");
    expect(api.setNightOverride).toHaveBeenLastCalledWith("h1", ME, "2026-10-18", ME);
  });

  it("resets the plan and clears every loaded night", async () => {
    const store = bound();
    await store.reset();
    expect(api.saveRotaSettings).toHaveBeenCalledWith("h1", ME, expect.objectContaining({ pattern: "alternate", firstOnDuty: ME }));
    expect(api.clearNightOverride).toHaveBeenCalledWith("h1", "2026-10-14");
  });

  it("reports a failed write without hiding the page", async () => {
    const store = bound();
    api.saveRotaSettings.mockRejectedValueOnce(Object.assign(new Error("no"), { code: "permission-denied" }));
    expect(await store.setPattern("split")).toBe(false);
    expect(store.writeError).toContain("could not save the plan");
    expect(store.error).toBeNull();
  });

  it("writes nothing when no household is bound", async () => {
    const store = fresh();
    expect(await store.setPattern("split")).toBe(false);
    expect(api.saveRotaSettings).not.toHaveBeenCalled();
  });
});
