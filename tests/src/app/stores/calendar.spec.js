import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";

const api = vi.hoisted(() => ({
  onData: null,
  onError: null,
  stops: 0,
  addEvent: vi.fn(async () => "e-new"),
  updateEvent: vi.fn(async () => {}),
  deleteEvent: vi.fn(async () => {}),
  migrateLegacyCalendar: vi.fn(async () => false),
}));

vi.mock("@/api/calendar", () => ({
  subscribeEvents: (hid, onData, onError) => {
    api.onData = onData;
    api.onError = onError;
    return () => {
      api.stops += 1;
    };
  },
  addEvent: (...a) => api.addEvent(...a),
  updateEvent: (...a) => api.updateEvent(...a),
  deleteEvent: (...a) => api.deleteEvent(...a),
  migrateLegacyCalendar: (...a) => api.migrateLegacyCalendar(...a),
}));

import { cleanEvent, useCalendarStore } from "@/app/stores/calendar";

const ME = "u1";
const PARTNER = "u2";
const draft = {
  title: "Health visitor",
  date: "2026-10-14",
  allDay: false,
  start: "10:00",
  end: "11:00",
  owner: "both",
  type: "appointment",
  notes: "Bring the red book",
};

function fresh() {
  setActivePinia(createPinia());
  return useCalendarStore();
}
function bound(events = []) {
  const store = fresh();
  store.bind("h1", ME, PARTNER);
  api.onData(events);
  return store;
}

beforeEach(() => {
  api.onData = null;
  api.onError = null;
  api.stops = 0;
  for (const key of ["addEvent", "updateEvent", "deleteEvent", "migrateLegacyCalendar"]) api[key].mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("calendar store", () => {
  it("loads, and shows no error, until a household id arrives", () => {
    const store = fresh();
    expect(store.loading).toBe(true);
    expect(store.error).toBeNull();
    store.bind("", ME, PARTNER);
    expect(store.loading).toBe(true);
    expect(store.error).toBeNull();
    expect(api.onData).toBeNull();
  });

  it("fills the events from a snapshot", () => {
    const store = bound([{ id: "e1", title: "Health visitor", date: "2026-10-14", owner: ME }]);
    expect(store.loading).toBe(false);
    expect(store.events).toHaveLength(1);
    expect(store.events[0].owner).toBe(ME);
  });

  it("reports a failed listener by code and stops listening on unbind", () => {
    const store = bound();
    api.onError({ code: "permission-denied" });
    expect(store.error).toEqual({ code: "permission-denied" });
    store.unbind();
    expect(api.stops).toBe(1);
    expect(store.events).toEqual([]);
    expect(store.error).toBeNull();
  });

  it("moves old browser events up once, after the first snapshot", async () => {
    bound();
    await nextTick();
    expect(api.migrateLegacyCalendar).toHaveBeenCalledWith("h1", ME, PARTNER);
    api.onData([]);
    expect(api.migrateLegacyCalendar).toHaveBeenCalledTimes(1);
  });

  it("adds an event through the api, with my uid as the author", async () => {
    const store = bound();
    const saved = await store.addEvent({ ...draft, title: "  Health visitor " });
    expect(api.addEvent).toHaveBeenCalledWith("h1", ME, {
      title: "Health visitor",
      date: "2026-10-14",
      endDate: "2026-10-14",
      allDay: false,
      start: "10:00",
      end: "11:00",
      owner: "both",
      type: "appointment",
      notes: "Bring the red book",
    });
    expect(saved.date).toBe("2026-10-14");
  });

  it("repairs a draft and refuses one it cannot repair", async () => {
    const store = bound();
    await store.addEvent({ ...draft, allDay: true });
    expect(api.addEvent.mock.calls[0][2]).toMatchObject({ allDay: true, start: null, end: null });
    await store.addEvent({ title: "x", date: "2026-10-14", endDate: "2026-10-01", type: "nope", owner: "" });
    expect(api.addEvent.mock.calls[1][2]).toMatchObject({ endDate: "2026-10-14", type: "family", owner: ME });
    expect(await store.addEvent({ title: "", date: "2026-10-14" })).toBeNull();
    expect(await store.addEvent({ title: "No date", date: "soon" })).toBeNull();
    expect(api.addEvent).toHaveBeenCalledTimes(2);
    expect(cleanEvent({ title: "n", date: "2026-10-14", notes: "x".repeat(400) }).notes).toHaveLength(280);
  });

  it("edits and deletes an event that is in the snapshot", async () => {
    const store = bound([{ id: "e1", ...draft, endDate: "2026-10-14", owner: ME }]);
    await store.updateEvent("e1", { title: "Nurse", owner: PARTNER, endDate: "2026-10-16" });
    expect(api.updateEvent).toHaveBeenCalledWith("h1", "e1", expect.objectContaining({
      title: "Nurse",
      owner: PARTNER,
      endDate: "2026-10-16",
      start: "10:00",
    }));
    expect(await store.updateEvent("missing", { title: "x" })).toBeNull();
    expect(await store.updateEvent("e1", { title: "" })).toBeNull();
    await store.removeEvent("e1");
    expect(api.deleteEvent).toHaveBeenCalledWith("h1", "e1");
  });

  it("reports a failed write without hiding the page", async () => {
    const store = bound();
    api.addEvent.mockRejectedValueOnce(Object.assign(new Error("no"), { code: "permission-denied" }));
    expect(await store.addEvent(draft)).toBeNull();
    expect(store.writeError).toContain("could not save the event");
    expect(store.error).toBeNull();
  });

  it("writes nothing when no household is bound", async () => {
    const store = fresh();
    expect(await store.addEvent(draft)).toBeNull();
    expect(api.addEvent).not.toHaveBeenCalled();
  });
});
