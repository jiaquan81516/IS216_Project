import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { subscribeCheckins, saveCheckin } from "@/api/checkins";
import { useCheckinsStore, dateKey, CHECKINS_KEY } from "@/app/stores/checkins";

vi.mock("@/api/checkins", () => ({
  subscribeCheckins: vi.fn(() => vi.fn()), // returns an unsubscribe fn
  saveCheckin: vi.fn().mockResolvedValue(undefined),
}));

const OWNER_KEY = "nt.app.checkins-owner";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  subscribeCheckins.mockImplementation(() => vi.fn());
  saveCheckin.mockResolvedValue(undefined);
  setActivePinia(createPinia());
});

afterEach(() => {
  localStorage.clear();
});

describe("dateKey", () => {
  it("formats a date as local yyyy-mm-dd", () => {
    expect(dateKey(new Date(2026, 9, 14))).toBe("2026-10-14");
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("useCheckinsStore", () => {
  it("starts with no items when localStorage is empty", () => {
    const store = useCheckinsStore();
    expect(store.items).toEqual({});
    expect(store.loaded).toBe(false);
  });

  it("loads valid saved check-ins from localStorage, dropping ones missing mood/stress", () => {
    localStorage.setItem(CHECKINS_KEY, JSON.stringify({
      "2026-10-13": { mood: 3, stress: 2, savedAt: "2026-10-13T10:00:00.000Z" },
      "2026-10-12": { mood: null, stress: 2 }, // invalid, dropped
    }));
    const store = useCheckinsStore();
    expect(Object.keys(store.items)).toEqual(["2026-10-13"]);
    expect(store.items["2026-10-13"].moodStage).toBe("opening");
  });

  it("saves a check-in locally even with no household bound, without calling saveCheckin", () => {
    const store = useCheckinsStore();
    const now = new Date(2026, 9, 14, 12, 0, 0);
    const entry = store.save({ mood: 3, stress: 3 }, now);
    expect(entry.date).toBe("2026-10-14");
    expect(store.items["2026-10-14"]).toEqual(entry);
    expect(saveCheckin).not.toHaveBeenCalled();
  });

  it("cleans and caps optional fields, defaulting the need and working out the stage", () => {
    const store = useCheckinsStore();
    const entry = store.save({
      mood: 1, stress: 5, concerns: ["a", "a", "b", "c", "d"], savedAt: "ignored, overwritten",
    }, new Date(2026, 9, 14));
    expect(entry.concerns).toEqual(["a", "b", "c"]); // de-duped and capped at 3
    expect(entry.need).toBe("checkOnMe");
    expect(entry.moodStage).toBe("wilted");
  });

  it("pushes to Firestore once bound, and surfaces a permission error distinctly", async () => {
    const store = useCheckinsStore();
    store.bind("house1", "me1");
    store.save({ mood: 3, stress: 3 }, new Date(2026, 9, 14));
    expect(saveCheckin).toHaveBeenCalledWith("house1", "me1", expect.objectContaining({ date: "2026-10-14" }));

    saveCheckin.mockRejectedValueOnce({ code: "permission-denied" });
    store.save({ mood: 3, stress: 3 }, new Date(2026, 9, 14));
    await Promise.resolve().then().then(); // let the rejection's .catch handler run
    expect(store.error).toContain("database rules");
  });

  it("does nothing when binding with no household id or uid", () => {
    const store = useCheckinsStore();
    store.bind("", "me1");
    expect(subscribeCheckins).not.toHaveBeenCalled();
    store.bind("house1", "");
    expect(subscribeCheckins).not.toHaveBeenCalled();
  });

  it("resets the local items when a different account binds on this device", () => {
    localStorage.setItem(OWNER_KEY, "someoneElse");
    const store = useCheckinsStore();
    store.save({ mood: 3, stress: 3 }, new Date(2026, 9, 14)); // populate before binding
    expect(Object.keys(store.items)).toHaveLength(1);
    store.bind("house1", "me1");
    expect(store.items).toEqual({});
    expect(localStorage.getItem(OWNER_KEY)).toBe("me1");
  });

  it("keeps items when the same account re-binds", () => {
    localStorage.setItem(OWNER_KEY, "me1");
    const store = useCheckinsStore();
    store.save({ mood: 3, stress: 3 }, new Date(2026, 9, 14));
    store.bind("house1", "me1");
    expect(Object.keys(store.items)).toHaveLength(1);
  });

  it("splits incoming docs into mine and the partner's, by uid", () => {
    const store = useCheckinsStore();
    store.bind("house1", "me1");
    const onData = subscribeCheckins.mock.calls[0][1];
    onData([
      { date: "2026-10-13", mood: 3, stress: 3, uid: "me1", savedAt: "2026-10-13T08:00:00.000Z" },
      { date: "2026-10-13", mood: 4, stress: 2, uid: "partner1", savedAt: "2026-10-13T08:00:00.000Z" },
    ]);
    expect(Object.keys(store.items)).toEqual(["2026-10-13"]);
    expect(Object.keys(store.partnerItems)).toEqual(["2026-10-13"]);
    expect(store.loaded).toBe(true);
  });

  it("keeps the newer copy when merging a remote entry with one already saved locally", () => {
    const store = useCheckinsStore();
    store.save({ mood: 2, stress: 2 }, new Date(2026, 9, 13)); // saved "now" -> savedAt is very recent
    store.bind("house1", "me1");
    const onData = subscribeCheckins.mock.calls[0][1];
    // An older remote copy of the same day should NOT replace the newer local one
    onData([{ date: "2026-10-13", mood: 5, stress: 1, uid: "me1", savedAt: "2000-01-01T00:00:00.000Z" }]);
    expect(store.items["2026-10-13"].mood).toBe(2);
  });

  it("re-pushes a local-only entry to Firestore once the household data arrives", () => {
    const store = useCheckinsStore();
    store.save({ mood: 3, stress: 3 }, new Date(2026, 9, 14)); // local only, before bind
    store.bind("house1", "me1");
    saveCheckin.mockClear();
    const onData = subscribeCheckins.mock.calls[0][1];
    onData([]); // household has nothing yet
    expect(saveCheckin).toHaveBeenCalledWith("house1", "me1", expect.objectContaining({ date: "2026-10-14" }));
  });

  it("ignores a subscription callback that fires after unbind (stale subscription)", () => {
    const store = useCheckinsStore();
    store.bind("house1", "me1");
    const onData = subscribeCheckins.mock.calls[0][1];
    store.unbind();
    onData([{ date: "2026-10-13", mood: 3, stress: 3, uid: "me1", savedAt: "2026-10-13T08:00:00.000Z" }]);
    expect(store.loaded).toBe(false);
    expect(store.partnerItems).toEqual({});
  });

  it("unsubscribes the previous listener when binding again", () => {
    const unsub1 = vi.fn();
    subscribeCheckins.mockImplementationOnce(() => unsub1);
    const store = useCheckinsStore();
    store.bind("house1", "me1");
    store.bind("house2", "me1");
    expect(unsub1).toHaveBeenCalled();
  });

  describe("forDate / lastSeven / partnerLastSeven / recent", () => {
    it("returns null for a date with no check-in", () => {
      const store = useCheckinsStore();
      expect(store.forDate("2026-10-14")).toBeNull();
    });

    it("returns the 7 most recent days ending today, oldest first, with entries attached", () => {
      const store = useCheckinsStore();
      const now = new Date(2026, 9, 14);
      store.save({ mood: 3, stress: 3 }, now);
      const days = store.lastSeven(now);
      expect(days).toHaveLength(7);
      expect(days[6].date).toBe("2026-10-14");
      expect(days[6].entry.mood).toBe(3);
      expect(days[0].date).toBe("2026-10-08");
      expect(days[0].entry).toBeNull();
    });

    it("uses partnerItems for partnerLastSeven", () => {
      const store = useCheckinsStore();
      store.bind("house1", "me1");
      const onData = subscribeCheckins.mock.calls[0][1];
      onData([{ date: "2026-10-14", mood: 3, stress: 3, uid: "partner1", savedAt: "2026-10-14T08:00:00.000Z" }]);
      const days = store.partnerLastSeven(new Date(2026, 9, 14));
      expect(days.at(-1).entry.mood).toBe(3);
    });

    it("finds the newest check-in saved within the last 24h, and not an older one", () => {
      const store = useCheckinsStore();
      const now = new Date(2026, 9, 14, 12, 0, 0);
      store.save({ mood: 3, stress: 3 }, new Date(now.getTime() - 25 * 60 * 60 * 1000)); // too old
      store.save({ mood: 4, stress: 2 }, new Date(now.getTime() - 60 * 60 * 1000)); // within 24h
      const recent = store.recent(now);
      expect(recent.mood).toBe(4);
    });
  });

  describe("resetStage", () => {
    it("sets the most recent check-in's stage back to budding", () => {
      const store = useCheckinsStore();
      const now = new Date(2026, 9, 14, 12, 0, 0);
      store.save({ mood: 1, stress: 5 }, now); // wilted
      expect(store.items["2026-10-14"].moodStage).toBe("wilted");
      store.resetStage(now);
      expect(store.items["2026-10-14"].moodStage).toBe("budding");
    });

    it("does nothing when there is no recent check-in", () => {
      const store = useCheckinsStore();
      expect(() => store.resetStage(new Date())).not.toThrow();
      expect(store.items).toEqual({});
    });
  });
});
