import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { RTW_KEY, useReturnToWorkStore } from "@/v3/stores/returnToWork";

function fresh() {
  setActivePinia(createPinia());
  return useReturnToWorkStore();
}
const saved = () => JSON.parse(localStorage.getItem(RTW_KEY));

beforeEach(() => localStorage.clear());

describe("return to work store", () => {
  it("starts empty with a five item pumping checklist", () => {
    const store = fresh();
    expect(store.returnDate).toBeNull();
    expect(store.tasks).toEqual([]);
    expect(store.pumping.items).toHaveLength(5);
    expect(store.pumping.items.every((i) => !i.done)).toBe(true);
    expect(store.pumping.sessions).toBeNull();
  });

  it("adds, toggles, edits and deletes tasks", () => {
    const store = fresh();
    const task = store.addTask({ title: "  Book a trial ", group: "childcare", owner: "me", due: "2026-10-20" });
    expect(task.title).toBe("Book a trial");
    expect(store.tasks).toHaveLength(1);
    store.toggleTask(task.id);
    expect(store.tasks[0].done).toBe(true);
    store.updateTask(task.id, { title: "Book two trials", owner: "partner" });
    expect(store.tasks[0]).toMatchObject({ title: "Book two trials", owner: "partner", group: "childcare" });
    store.removeTask(task.id);
    expect(store.tasks).toEqual([]);
  });

  it("ignores empty titles and normalises bad values", () => {
    const store = fresh();
    expect(store.addTask({ title: "   " })).toBeNull();
    const task = store.addTask({ title: "x", group: "nope", owner: "nobody", due: "tomorrow" });
    expect(task).toMatchObject({ group: "home", owner: "both", due: null });
  });

  it("sets the return date and rejects bad ones", () => {
    const store = fresh();
    store.setReturnDate("2026-11-04");
    expect(store.returnDate).toBe("2026-11-04");
    store.setReturnDate("soon");
    expect(store.returnDate).toBeNull();
  });

  it("stores responsibilities and pumping choices", () => {
    const store = fresh();
    store.setResponsibility("meals", "partner");
    store.setResponsibility("unknown-area", "me");
    expect(store.responsibilities.meals).toBe("partner");
    expect(store.responsibilities["unknown-area"]).toBeUndefined();
    store.setResponsibility("meals", null);
    expect(store.responsibilities.meals).toBeNull();
    store.togglePumpingItem("find-room");
    store.setSessions(3);
    store.setSessions(9);
    expect(store.pumping.sessions).toBeNull();
    store.setSessions(4);
    store.togglePumpingTime("morning");
    store.togglePumpingTime("midday");
    store.togglePumpingTime("morning");
    expect(store.pumping.times).toEqual(["midday"]);
    expect(store.pumping.items.find((i) => i.key === "find-room").done).toBe(true);
  });

  it("persists to localStorage and loads it back", () => {
    const store = fresh();
    store.setReturnDate("2026-11-04");
    store.addTask({ title: "Plan the morning handover", group: "home" });
    store.togglePumpingItem("pack-pump");
    store.setSessions(2);
    expect(saved().returnDate).toBe("2026-11-04");
    expect(saved().tasks).toHaveLength(1);

    const again = fresh();
    expect(again.returnDate).toBe("2026-11-04");
    expect(again.tasks[0].title).toBe("Plan the morning handover");
    expect(again.pumping.items.find((i) => i.key === "pack-pump").done).toBe(true);
    expect(again.pumping.sessions).toBe(2);
  });

  it("falls back to defaults when stored data is broken", () => {
    localStorage.setItem(RTW_KEY, "{not json");
    expect(fresh().tasks).toEqual([]);
    localStorage.setItem(RTW_KEY, JSON.stringify({ returnDate: 5, tasks: [{ title: "ok", owner: "me" }, { nope: 1 }, null] }));
    const store = fresh();
    expect(store.returnDate).toBeNull();
    expect(store.tasks).toHaveLength(1);
    expect(store.tasks[0].owner).toBe("me");
  });

  it("keeps working when storage throws", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      const store = fresh();
      expect(() => store.addTask({ title: "Still works" })).not.toThrow();
      expect(store.tasks).toHaveLength(1);
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it("resets everything", () => {
    const store = fresh();
    store.setReturnDate("2026-11-04");
    store.addTask({ title: "x" });
    store.reset();
    expect(store.returnDate).toBeNull();
    expect(store.tasks).toEqual([]);
  });
});
