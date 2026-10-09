import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { CALENDAR_KEY, useCalendarStore } from "@/v3/stores/calendar";

function fresh() {
  setActivePinia(createPinia());
  return useCalendarStore();
}
const saved = () => JSON.parse(localStorage.getItem(CALENDAR_KEY));
const draft = { title: "Health visitor", date: "2026-10-14", allDay: false, start: "10:00", end: "11:00", owner: "both", type: "appointment", notes: "Bring the red book" };

beforeEach(() => localStorage.clear());

describe("calendar store", () => {
  it("starts empty", () => {
    expect(fresh().events).toEqual([]);
  });

  it("adds an event, defaulting the end date and trimming the title", () => {
    const store = fresh();
    const event = store.addEvent({ ...draft, title: "  Health visitor " });
    expect(event.id).toBeTruthy();
    expect(event).toMatchObject({ title: "Health visitor", date: "2026-10-14", endDate: "2026-10-14", start: "10:00", end: "11:00", owner: "both", type: "appointment" });
    expect(store.events).toHaveLength(1);
  });

  it("clears times for all day events and repairs bad values", () => {
    const store = fresh();
    const a = store.addEvent({ ...draft, allDay: true });
    expect(a).toMatchObject({ allDay: true, start: null, end: null });
    const b = store.addEvent({ title: "x", date: "2026-10-14", endDate: "2026-10-01", owner: "nobody", type: "nope", start: "9am" });
    expect(b).toMatchObject({ endDate: "2026-10-14", owner: "both", type: "family", start: null });
    expect(store.addEvent({ title: "", date: "2026-10-14" })).toBeNull();
    expect(store.addEvent({ title: "No date", date: "soon" })).toBeNull();
    expect(store.addEvent({ title: "n", date: "2026-10-14", notes: "x".repeat(400) }).notes).toHaveLength(280);
  });

  it("updates and deletes", () => {
    const store = fresh();
    const event = store.addEvent(draft);
    const updated = store.updateEvent(event.id, { title: "Nurse", owner: "me", endDate: "2026-10-16" });
    expect(updated).toMatchObject({ id: event.id, title: "Nurse", owner: "me", endDate: "2026-10-16", start: "10:00" });
    expect(store.updateEvent("missing", { title: "x" })).toBeNull();
    expect(store.updateEvent(event.id, { title: "" })).toBeNull();
    expect(store.events[0].title).toBe("Nurse");
    store.removeEvent(event.id);
    expect(store.events).toEqual([]);
  });

  it("persists and reloads", () => {
    const store = fresh();
    store.addEvent(draft);
    expect(saved()).toHaveLength(1);
    const again = fresh();
    expect(again.events[0]).toMatchObject({ title: "Health visitor", notes: "Bring the red book" });
  });

  it("survives broken or blocked storage", () => {
    localStorage.setItem(CALENDAR_KEY, "{oops");
    expect(fresh().events).toEqual([]);
    localStorage.setItem(CALENDAR_KEY, JSON.stringify([{ title: "ok", date: "2026-10-14" }, { title: "bad" }, null, 4]));
    expect(fresh().events).toHaveLength(1);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      const store = fresh();
      expect(() => store.addEvent(draft)).not.toThrow();
      expect(store.events.length).toBeGreaterThan(0);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
