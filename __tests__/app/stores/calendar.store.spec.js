import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { addEvent, deleteEvent, migrateLegacyCalendar, subscribeEvents, updateEvent } from "@/api/calendar";
import { useCalendarStore, cleanEvent } from "@/app/stores/calendar";

vi.mock("@/api/calendar", () => ({
  subscribeEvents: vi.fn(() => vi.fn()),
  addEvent: vi.fn().mockResolvedValue(undefined),
  updateEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
  migrateLegacyCalendar: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  subscribeEvents.mockImplementation(() => vi.fn());
  setActivePinia(createPinia());
});

describe("cleanEvent", () => {
  it("returns null for a missing title or an invalid start date", () => {
    expect(cleanEvent(null)).toBeNull();
    expect(cleanEvent({ title: "", date: "2026-11-05" })).toBeNull();
    expect(cleanEvent({ title: "Checkup", date: "bad" })).toBeNull();
    expect(cleanEvent({ title: "Checkup", date: "2026-02-30" })).toBeNull();
  });

  it("trims and caps the title at 80 characters", () => {
    expect(cleanEvent({ title: "  Checkup  ", date: "2026-11-05" }).title).toBe("Checkup");
    expect(cleanEvent({ title: "x".repeat(200), date: "2026-11-05" }).title).toHaveLength(80);
  });

  it("falls back endDate to date when missing, invalid, or before the start date", () => {
    expect(cleanEvent({ title: "x", date: "2026-11-05" }).endDate).toBe("2026-11-05");
    expect(cleanEvent({ title: "x", date: "2026-11-05", endDate: "bad" }).endDate).toBe("2026-11-05");
    expect(cleanEvent({ title: "x", date: "2026-11-05", endDate: "2026-11-01" }).endDate).toBe("2026-11-05");
    expect(cleanEvent({ title: "x", date: "2026-11-05", endDate: "2026-11-10" }).endDate).toBe("2026-11-10");
  });

  it("clears start/end times for an all-day event even if times are given", () => {
    const event = cleanEvent({ title: "x", date: "2026-11-05", allDay: true, start: "09:00", end: "10:00" });
    expect(event.allDay).toBe(true);
    expect(event.start).toBeNull();
    expect(event.end).toBeNull();
  });

  it("only accepts well-formed HH:MM times for a timed event", () => {
    expect(cleanEvent({ title: "x", date: "2026-11-05", start: "09:00", end: "10:00" })).toMatchObject({ start: "09:00", end: "10:00" });
    expect(cleanEvent({ title: "x", date: "2026-11-05", start: "9am", end: "bad" })).toMatchObject({ start: null, end: null });
  });

  it("falls back to 'family' for an unrecognised type, and keeps a valid one", () => {
    expect(cleanEvent({ title: "x", date: "2026-11-05", type: "bogus" }).type).toBe("family");
    expect(cleanEvent({ title: "x", date: "2026-11-05", type: "work" }).type).toBe("work");
  });

  it("falls back owner to the given default", () => {
    expect(cleanEvent({ title: "x", date: "2026-11-05" }, "me1").owner).toBe("me1");
    expect(cleanEvent({ title: "x", date: "2026-11-05", owner: "both" }, "me1").owner).toBe("both");
  });

  it("caps notes at NOTES_MAX and coerces a non-string to ''", () => {
    expect(cleanEvent({ title: "x", date: "2026-11-05", notes: "x".repeat(400) }).notes).toHaveLength(280);
    expect(cleanEvent({ title: "x", date: "2026-11-05", notes: 5 }).notes).toBe("");
  });

  it("keeps only string babyIds, capped at 20", () => {
    const many = Array.from({ length: 25 }, (_, i) => `b${i}`);
    const event = cleanEvent({ title: "x", date: "2026-11-05", babyIds: [...many, 123, null] });
    expect(event.babyIds).toHaveLength(20);
    expect(event.babyIds.every((id) => typeof id === "string")).toBe(true);
  });

  it("defaults babyIds to [] (all babies) when not an array", () => {
    expect(cleanEvent({ title: "x", date: "2026-11-05" }).babyIds).toEqual([]);
  });
});

describe("useCalendarStore", () => {
  it("starts loading with no events", () => {
    const store = useCalendarStore();
    expect(store.events).toEqual([]);
    expect(store.loading).toBe(true);
  });

  it("does nothing when bound with no household id", () => {
    const store = useCalendarStore();
    store.bind("");
    expect(subscribeEvents).not.toHaveBeenCalled();
  });

  it("loads events, stops loading, and triggers migration", () => {
    const store = useCalendarStore();
    store.bind("house1", "me1", "partner1");
    const onData = subscribeEvents.mock.calls[0][1];
    onData([{ id: "e1", date: "2026-11-05" }]);
    expect(store.events).toEqual([{ id: "e1", date: "2026-11-05" }]);
    expect(store.loading).toBe(false);
    expect(migrateLegacyCalendar).toHaveBeenCalledWith("house1", "me1", "partner1");
  });

  it("only migrates once per binding even with repeated event pushes", () => {
    const store = useCalendarStore();
    store.bind("house1", "me1", "partner1");
    const onData = subscribeEvents.mock.calls[0][1];
    onData([]);
    onData([]);
    expect(migrateLegacyCalendar).toHaveBeenCalledTimes(1);
  });

  it("allows migration again after rebinding to a different household", () => {
    const store = useCalendarStore();
    store.bind("house1", "me1", "partner1");
    subscribeEvents.mock.calls[0][1]([]);
    store.bind("house2", "me1", "partner1");
    subscribeEvents.mock.calls[1][1]([]);
    expect(migrateLegacyCalendar).toHaveBeenCalledTimes(2);
    expect(migrateLegacyCalendar).toHaveBeenNthCalledWith(2, "house2", "me1", "partner1");
  });

  it("surfaces a subscription error", () => {
    const store = useCalendarStore();
    store.bind("house1", "me1");
    const onError = subscribeEvents.mock.calls[0][2];
    onError({ code: "permission-denied" });
    expect(store.error).toEqual({ code: "permission-denied" });
    expect(store.loading).toBe(false);
  });

  it("ignores a stale callback after unbind", () => {
    const store = useCalendarStore();
    store.bind("house1", "me1");
    const onData = subscribeEvents.mock.calls[0][1];
    store.unbind();
    onData([{ id: "e1" }]);
    expect(store.events).toEqual([]);
  });

  it("byDate sorts events chronologically by date string", () => {
    const store = useCalendarStore();
    store.bind("house1", "me1");
    const onData = subscribeEvents.mock.calls[0][1];
    onData([{ id: "b", date: "2026-12-01" }, { id: "a", date: "2026-11-01" }]);
    expect(store.byDate.map((e) => e.id)).toEqual(["a", "b"]);
  });

  describe("addEvent", () => {
    it("adds a valid event and defaults its owner to meUid", async () => {
      const store = useCalendarStore();
      store.bind("house1", "me1");
      const result = await store.addEvent({ title: "Checkup", date: "2026-11-05" });
      expect(result).toMatchObject({ title: "Checkup", owner: "me1" });
      expect(addEvent).toHaveBeenCalledWith("house1", "me1", expect.objectContaining({ title: "Checkup" }));
    });

    it("returns null for an invalid event without calling the API", async () => {
      const store = useCalendarStore();
      store.bind("house1", "me1");
      const result = await store.addEvent({ title: "", date: "2026-11-05" });
      expect(result).toBeNull();
      expect(addEvent).not.toHaveBeenCalled();
    });

    it("returns null and sets writeError when the API call fails", async () => {
      addEvent.mockRejectedValueOnce({ code: "unavailable" });
      const store = useCalendarStore();
      store.bind("house1", "me1");
      const result = await store.addEvent({ title: "Checkup", date: "2026-11-05" });
      expect(result).toBeNull();
      expect(store.writeError).toContain("could not save");
    });

    it("does nothing when no household is bound", async () => {
      const store = useCalendarStore();
      const result = await store.addEvent({ title: "Checkup", date: "2026-11-05" });
      expect(result).toBeNull();
      expect(addEvent).not.toHaveBeenCalled();
    });
  });

  describe("updateEvent", () => {
    it("merges the patch onto the existing event", async () => {
      const store = useCalendarStore();
      store.bind("house1", "me1");
      subscribeEvents.mock.calls[0][1]([{ id: "e1", title: "Checkup", date: "2026-11-05" }]);
      const result = await store.updateEvent("e1", { title: "Checkup 2" });
      expect(result).toMatchObject({ id: "e1", title: "Checkup 2" });
      expect(updateEvent).toHaveBeenCalledWith("house1", "e1", expect.objectContaining({ title: "Checkup 2" }));
    });

    it("returns null for a missing event id", async () => {
      const store = useCalendarStore();
      store.bind("house1", "me1");
      expect(await store.updateEvent("missing", { title: "x" })).toBeNull();
      expect(updateEvent).not.toHaveBeenCalled();
    });

    it("returns null when the merged patch is invalid", async () => {
      const store = useCalendarStore();
      store.bind("house1", "me1");
      subscribeEvents.mock.calls[0][1]([{ id: "e1", title: "Checkup", date: "2026-11-05" }]);
      const result = await store.updateEvent("e1", { title: "" });
      expect(result).toBeNull();
      expect(updateEvent).not.toHaveBeenCalled();
    });
  });

  describe("removeEvent", () => {
    it("deletes an event", async () => {
      const store = useCalendarStore();
      store.bind("house1", "me1");
      const ok = await store.removeEvent("e1");
      expect(ok).toBe(true);
      expect(deleteEvent).toHaveBeenCalledWith("house1", "e1");
    });

    it("surfaces a write error on failure", async () => {
      deleteEvent.mockRejectedValueOnce({ code: "unavailable" });
      const store = useCalendarStore();
      store.bind("house1", "me1");
      const ok = await store.removeEvent("e1");
      expect(ok).toBe(false);
      expect(store.writeError).toContain("could not delete");
    });
  });
});
