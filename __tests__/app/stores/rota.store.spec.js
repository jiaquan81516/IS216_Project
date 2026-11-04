import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import {
  cancelSwap, clearNightOverride, migrateLegacyRota, requestSwap,
  respondToSwap, saveRotaSettings, setNightOverride,
  subscribeNights, subscribeRotaSettings, subscribeSwaps,
} from "@/api/rota";
import { notifyPartner } from "@/api/push";
import { useRotaStore, rotaDefaults } from "@/app/stores/rota";

vi.mock("@/api/rota", () => ({
  subscribeRotaSettings: vi.fn(() => vi.fn()),
  subscribeNights: vi.fn(() => vi.fn()),
  subscribeSwaps: vi.fn(() => vi.fn()),
  saveRotaSettings: vi.fn().mockResolvedValue(undefined),
  setNightOverride: vi.fn().mockResolvedValue(undefined),
  clearNightOverride: vi.fn().mockResolvedValue(undefined),
  requestSwap: vi.fn().mockResolvedValue("swap-1"),
  respondToSwap: vi.fn().mockResolvedValue(undefined),
  cancelSwap: vi.fn().mockResolvedValue(undefined),
  migrateLegacyRota: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/api/push", () => ({ notifyPartner: vi.fn() }));

function bindAndLoad(store, { id = "house1", me = "me1", partner = "partner1", settings = {}, nights = [], swaps = [] } = {}) {
  store.bind(id, me, partner);
  const [settingsCall, nightsCall, swapsCall] = subscribeRotaSettings.mock.calls.length
    ? [subscribeRotaSettings.mock.calls.at(-1), subscribeNights.mock.calls.at(-1), subscribeSwaps.mock.calls.at(-1)]
    : [];
  settingsCall[1](settings);
  nightsCall[3](nights);
  swapsCall[1](swaps);
}

beforeEach(() => {
  vi.clearAllMocks();
  subscribeRotaSettings.mockImplementation(() => vi.fn());
  subscribeNights.mockImplementation(() => vi.fn());
  subscribeSwaps.mockImplementation(() => vi.fn());
  saveRotaSettings.mockResolvedValue(undefined);
  requestSwap.mockResolvedValue("swap-1");
  setActivePinia(createPinia());
});

describe("rotaDefaults", () => {
  it("defaults to alternate with a partner, manual without one", () => {
    expect(rotaDefaults(new Date("2026-11-04"), true).pattern).toBe("alternate");
    expect(rotaDefaults(new Date("2026-11-04"), false).pattern).toBe("manual");
  });
  it("starts the plan on the Monday of the given week", () => {
    // 2026-11-04 is a Wednesday; Monday of that week is 2026-11-02
    expect(rotaDefaults(new Date("2026-11-04T12:00:00")).startDate).toBe("2026-11-02");
  });
});

describe("useRotaStore / binding", () => {
  it("starts loading with no settings", () => {
    const store = useRotaStore();
    expect(store.loading).toBe(true);
    expect(store.settings).toBeNull();
  });

  it("does nothing when bound with no household id", () => {
    const store = useRotaStore();
    store.bind("");
    expect(subscribeRotaSettings).not.toHaveBeenCalled();
  });

  it("only stops loading once all three subscriptions have reported", () => {
    const store = useRotaStore();
    store.bind("house1", "me1", "partner1");
    const onSettings = subscribeRotaSettings.mock.calls[0][1];
    const onNights = subscribeNights.mock.calls[0][3];
    onSettings({});
    expect(store.loading).toBe(true);
    onNights([]);
    expect(store.loading).toBe(true);
    const onSwaps = subscribeSwaps.mock.calls[0][1];
    onSwaps([]);
    expect(store.loading).toBe(false);
  });

  it("ignores a stale callback after unbind", () => {
    const store = useRotaStore();
    store.bind("house1", "me1");
    const onSettings = subscribeRotaSettings.mock.calls[0][1];
    store.unbind();
    onSettings({ pattern: "manual" });
    expect(store.settings).toBeNull();
  });

  it("surfaces a subscription error", () => {
    const store = useRotaStore();
    store.bind("house1", "me1");
    const onError = subscribeRotaSettings.mock.calls[0][2];
    onError({ code: "permission-denied" });
    expect(store.error).toEqual({ code: "permission-denied" });
    expect(store.loading).toBe(false);
  });

  it("migrates legacy data on the first settings update, and never again for this binding", () => {
    // `migrate()` sets a `migrating` flag before awaiting and never clears it, so a second
    // settings update (or a slow first migration) can never trigger a second migration call.
    const store = useRotaStore();
    store.bind("house1", "me1", "partner1");
    const onSettings = subscribeRotaSettings.mock.calls[0][1];
    onSettings({ pattern: "manual" });
    onSettings({ pattern: "manual" });
    expect(migrateLegacyRota).toHaveBeenCalledTimes(1);
    expect(migrateLegacyRota).toHaveBeenCalledWith("house1", "me1", "partner1");
  });
  it("allows migration again after rebinding to a different household", () => {
    // useShared.js re-binds this store whenever householdId/meUid change (household switch,
    // re-auth), so unbind() must reset the migrating guard or the new household never migrates.
    const store = useRotaStore();
    store.bind("house1", "me1", "partner1");
    subscribeRotaSettings.mock.calls[0][1]({ pattern: "manual" });
    store.bind("house2", "me1", "partner1");
    subscribeRotaSettings.mock.calls[1][1]({ pattern: "manual" });
    expect(migrateLegacyRota).toHaveBeenCalledTimes(2);
    expect(migrateLegacyRota).toHaveBeenNthCalledWith(2, "house2", "me1", "partner1");
  });
});

describe("plan computed", () => {
  it("falls back to defaults when there is no saved pattern", () => {
    const store = useRotaStore();
    bindAndLoad(store, { settings: {} });
    expect(store.plan.pattern).toBe("alternate");
    expect(store.plan.hourCover).toHaveLength(24);
  });
  it("rejects an invalid stored pattern in favour of the default", () => {
    const store = useRotaStore();
    bindAndLoad(store, { settings: { pattern: "bogus" } });
    expect(store.plan.pattern).toBe("alternate");
  });
  it("accepts a valid stored pattern", () => {
    const store = useRotaStore();
    bindAndLoad(store, { settings: { pattern: "split" } });
    expect(store.plan.pattern).toBe("split");
  });
  it("converts legacy dayCover into hourCover when no explicit hourCover is stored", () => {
    const store = useRotaStore();
    bindAndLoad(store, { settings: { dayCover: { morning: { who: "me1" }, afternoon: { who: "both" } } } });
    expect(store.plan.hourCover[7]).toEqual({ who: "me1", label: "" });
    expect(store.plan.hourCover[13]).toEqual({ who: "both", label: "" });
    expect(store.plan.hourCover[0]).toBeNull();
  });
});

describe("view computed", () => {
  it("resolves overrides, schedule and swaps relative to meUid", () => {
    const store = useRotaStore();
    bindAndLoad(store, {
      settings: { pattern: "manual", schedule: [{ id: "s1", day: 0, start: "20:00", end: "22:00", who: "me1", label: "" }] },
      nights: [{ date: "2026-11-05", onCall: "partner1" }],
      swaps: [{ id: "sw1", status: "pending", from: "me1" }],
    });
    expect(store.view.overrides["2026-11-05"]).toBe("partner");
    expect(store.view.schedule[0]).toMatchObject({ who: "me" });
    expect(store.view.swaps[0].from).toBe("me");
  });

  it("shows a carer's own shift as 'other' with her label, never as the partner", () => {
    const store = useRotaStore();
    const storeAny = store;
    storeAny.setCarers({ carer1: "Nanny Mei" });
    bindAndLoad(store, {
      settings: { pattern: "manual", schedule: [{ id: "s1", day: 0, start: "08:00", end: "10:00", who: "carer1", label: "" }] },
    });
    expect(store.view.schedule[0]).toMatchObject({ who: "other", label: "Nanny Mei" });
  });

  it("exposes pending and history swap lists separately", () => {
    const store = useRotaStore();
    bindAndLoad(store, {
      swaps: [
        { id: "a", status: "pending" },
        { id: "b", status: "accepted" },
        { id: "c", status: "cancelled" },
      ],
    });
    expect(store.pending.map((s) => s.id)).toEqual(["a"]);
    expect(store.history.map((s) => s.id)).toEqual(["b"]);
  });
});

describe("write actions", () => {
  it("setPattern saves through saveRotaSettings", async () => {
    const store = useRotaStore();
    store.bind("house1", "me1");
    const ok = await store.setPattern("split");
    expect(ok).toBe(true);
    expect(saveRotaSettings).toHaveBeenCalledWith("house1", "me1", { pattern: "split" });
  });

  it("setFirstOnDuty resolves 'partner' to the partner's uid", async () => {
    const store = useRotaStore();
    store.bind("house1", "me1", "partner1");
    await store.setFirstOnDuty("partner");
    expect(saveRotaSettings).toHaveBeenCalledWith("house1", "me1", { firstOnDuty: "partner1" });
  });

  it("setFirstOnDuty falls back to meUid when there is no partner", async () => {
    const store = useRotaStore();
    store.bind("house1", "me1");
    await store.setFirstOnDuty("partner");
    expect(saveRotaSettings).toHaveBeenCalledWith("house1", "me1", { firstOnDuty: "me1" });
  });

  it("setHourCover stores uids for me/partner cells and other:<label> for a carer", async () => {
    const store = useRotaStore();
    store.bind("house1", "me1", "partner1");
    const cells = Array(24).fill(null);
    cells[7] = { who: "me" };
    cells[8] = { who: "partner" };
    cells[9] = { who: "other", label: "Grandma" };
    cells[10] = { who: "both" };
    await store.setHourCover(cells);
    const [, , patch] = saveRotaSettings.mock.calls[0];
    expect(patch.hourCover[7]).toBe("me1");
    expect(patch.hourCover[8]).toBe("partner1");
    expect(patch.hourCover[9]).toBe("other:Grandma");
    expect(patch.hourCover[10]).toBe("both");
    expect(patch.hourCover[0]).toBe("");
  });

  it("setSchedule resolves me/partner to uids and keeps a carer's uid for 'other' shifts", async () => {
    const store = useRotaStore();
    store.setCarers({ carer1: "Nanny Mei" });
    store.bind("house1", "me1", "partner1");
    await store.setSchedule([
      { id: "s1", day: 0, start: "08:00", end: "10:00", who: "me", label: "" },
      { id: "s2", day: 0, start: "10:00", end: "12:00", who: "other", label: "Nanny Mei" },
    ]);
    const [, , patch] = saveRotaSettings.mock.calls[0];
    expect(patch.schedule.find((s) => s.id === "s1").who).toBe("me1");
    const carerShift = patch.schedule.find((s) => s.id === "s2");
    expect(carerShift.who).toBe("carer1");
    expect(carerShift.label).toBe("");
  });

  it("setOverride stores the right uid for me/partner, and clears for null", async () => {
    const store = useRotaStore();
    store.bind("house1", "me1", "partner1");
    await store.setOverride("2026-11-05", "me");
    expect(setNightOverride).toHaveBeenCalledWith("house1", "me1", "2026-11-05", "me1");
    await store.setOverride("2026-11-05", "partner");
    expect(setNightOverride).toHaveBeenCalledWith("house1", "me1", "2026-11-05", "partner1");
    await store.setOverride("2026-11-05", null);
    expect(clearNightOverride).toHaveBeenCalledWith("house1", "2026-11-05");
  });

  it("setOverride rejects a non-ISO date without calling the API", async () => {
    const store = useRotaStore();
    store.bind("house1", "me1");
    const ok = await store.setOverride("not-a-date", "me");
    expect(ok).toBe(false);
    expect(setNightOverride).not.toHaveBeenCalled();
  });

  it("requestSwap notifies the partner only for a plain handover (no withDate)", async () => {
    const store = useRotaStore();
    store.bind("house1", "me1", "partner1");
    await store.requestSwap({ date: "2026-11-05" });
    expect(notifyPartner).toHaveBeenCalledWith("house1", "cover", "swap-1");
    notifyPartner.mockClear();
    await store.requestSwap({ date: "2026-11-05", withDate: "2026-11-06" });
    expect(notifyPartner).not.toHaveBeenCalled();
  });

  it("respondSwap moves both nights on accept and notifies for a handover", async () => {
    const store = useRotaStore();
    bindAndLoad(store, { swaps: [{ id: "sw1", status: "pending", date: "2026-11-05", withDate: null, from: "partner1", to: "me1" }] });
    const ok = await store.respondSwap("sw1", true);
    expect(ok).toBe(true);
    expect(respondToSwap).toHaveBeenCalledWith("house1", "sw1", true, { uid: "me1", nights: [{ date: "2026-11-05", onCall: "me1" }] });
    expect(notifyPartner).toHaveBeenCalledWith("house1", "coverReply", "sw1");
  });

  it("respondSwap returns false for a swap id that doesn't exist", async () => {
    const store = useRotaStore();
    store.bind("house1", "me1");
    expect(await store.respondSwap("missing", true)).toBe(false);
    expect(respondToSwap).not.toHaveBeenCalled();
  });

  it("cancelRequest calls cancelSwap", async () => {
    const store = useRotaStore();
    store.bind("house1", "me1");
    await store.cancelRequest("sw1");
    expect(cancelSwap).toHaveBeenCalledWith("house1", "sw1");
  });
});

describe("applyAction", () => {
  it("takes the night myself when it's my partner's and nothing is offered in return", async () => {
    const store = useRotaStore();
    store.bind("house1", "me1", "partner1");
    const result = await store.applyAction({ from: "partner1", date: "2026-11-05", withDate: null });
    expect(result).toBe("taken");
    expect(setNightOverride).toHaveBeenCalledWith("house1", "me1", "2026-11-05", "me1");
  });

  it("requests a swap when giving away my own night", async () => {
    const store = useRotaStore();
    store.bind("house1", "me1", "partner1");
    const result = await store.applyAction({ from: "me1", date: "2026-11-05", withDate: "2026-11-06" });
    expect(result).toBe("requested");
    expect(requestSwap).toHaveBeenCalledWith("house1", expect.objectContaining({ date: "2026-11-05", withDate: "2026-11-06" }));
  });

  it("returns '' for no action", async () => {
    const store = useRotaStore();
    expect(await store.applyAction(null)).toBe("");
  });
});

describe("reset", () => {
  it("restores defaults and clears every known night override", async () => {
    const store = useRotaStore();
    bindAndLoad(store, { nights: [{ date: "2026-11-05", onCall: "me1" }, { date: "2026-11-06", onCall: "partner1" }] });
    const ok = await store.reset();
    expect(ok).toBe(true);
    expect(saveRotaSettings).toHaveBeenCalled();
    expect(clearNightOverride).toHaveBeenCalledWith("house1", "2026-11-05");
    expect(clearNightOverride).toHaveBeenCalledWith("house1", "2026-11-06");
  });

  it("stops and returns false if saving defaults fails", async () => {
    saveRotaSettings.mockRejectedValueOnce({ code: "unavailable" });
    const store = useRotaStore();
    store.bind("house1", "me1");
    expect(await store.reset()).toBe(false);
    expect(clearNightOverride).not.toHaveBeenCalled();
  });
});
