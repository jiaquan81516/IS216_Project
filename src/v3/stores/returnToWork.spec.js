import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";

const api = vi.hoisted(() => ({
  onPlan: null,
  onTasks: null,
  onError: null,
  stops: 0,
  addTask: vi.fn(async () => "t-new"),
  updateTask: vi.fn(async () => {}),
  toggleTask: vi.fn(async () => {}),
  deleteTask: vi.fn(async () => {}),
  saveRtwPlan: vi.fn(async () => {}),
  setResponsibility: vi.fn(async () => {}),
  setPumping: vi.fn(async () => {}),
  migrateLegacyRtw: vi.fn(async () => false),
}));

vi.mock("@/v3/api/rtw", () => ({
  subscribeRtwPlan: (hid, onData, onError) => {
    api.onPlan = onData;
    api.onError = onError;
    return () => {
      api.stops += 1;
    };
  },
  subscribeTasks: (hid, onData) => {
    api.onTasks = onData;
    return () => {
      api.stops += 1;
    };
  },
  addTask: (...a) => api.addTask(...a),
  updateTask: (...a) => api.updateTask(...a),
  toggleTask: (...a) => api.toggleTask(...a),
  deleteTask: (...a) => api.deleteTask(...a),
  saveRtwPlan: (...a) => api.saveRtwPlan(...a),
  setResponsibility: (...a) => api.setResponsibility(...a),
  setPumping: (...a) => api.setPumping(...a),
  migrateLegacyRtw: (...a) => api.migrateLegacyRtw(...a),
}));

import { cleanTask, useReturnToWorkStore } from "@/v3/stores/returnToWork";

const ME = "u1";
const PARTNER = "u2";

function fresh() {
  setActivePinia(createPinia());
  return useReturnToWorkStore();
}
function bound({ plan = null, tasks = [] } = {}) {
  const store = fresh();
  store.bind("h1", ME, PARTNER);
  api.onPlan(plan);
  api.onTasks(tasks);
  return store;
}

beforeEach(() => {
  api.onPlan = null;
  api.onTasks = null;
  api.stops = 0;
  for (const key of [
    "addTask",
    "updateTask",
    "toggleTask",
    "deleteTask",
    "saveRtwPlan",
    "setResponsibility",
    "setPumping",
    "migrateLegacyRtw",
  ]) {
    api[key].mockClear();
  }
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("return to work store binding", () => {
  it("loads, and shows no error, until a household id arrives", () => {
    const store = fresh();
    expect(store.loading).toBe(true);
    expect(store.error).toBeNull();
    store.bind("", ME, PARTNER);
    expect(store.loading).toBe(true);
    expect(store.error).toBeNull();
    expect(api.onPlan).toBeNull();
  });

  it("starts empty with a five item checklist and nothing decided", () => {
    const store = bound();
    expect(store.loading).toBe(false);
    expect(store.returnDate).toBeNull();
    expect(store.tasks).toEqual([]);
    expect(store.pumpingItems).toHaveLength(5);
    expect(store.pumpingItems.every((i) => !i.done)).toBe(true);
    expect(store.pumping.sessions).toBeNull();
    expect(store.responsibilities.meals).toBeNull();
  });

  it("fills the plan and the tasks from one snapshot each", () => {
    const store = bound({
      plan: {
        returnDate: "2026-11-04",
        responsibilities: { meals: PARTNER, chores: "both" },
        pumping: { items: { "find-room": true }, sessions: 3, times: ["morning", "nope"] },
        updatedBy: PARTNER,
      },
      tasks: [{ id: "t1", title: "Book a trial", owner: ME, done: false, due: null, group: "childcare" }],
    });
    expect(store.returnDate).toBe("2026-11-04");
    expect(store.responsibilities.meals).toBe(PARTNER);
    expect(store.responsibilities.chores).toBe("both");
    expect(store.pumpingItems.find((i) => i.key === "find-room").done).toBe(true);
    expect(store.pumping.sessions).toBe(3);
    expect(store.pumping.times).toEqual(["morning"]);
    expect(store.tasks).toHaveLength(1);
    expect(store.updatedBy).toBe(PARTNER);
  });

  it("reports a failed listener by code and stops listening on unbind", () => {
    const store = bound();
    api.onError({ code: "permission-denied" });
    expect(store.error).toEqual({ code: "permission-denied" });
    store.unbind();
    expect(api.stops).toBe(2);
    expect(store.tasks).toEqual([]);
    expect(store.error).toBeNull();
  });

  it("moves the old browser plan up once, after the first snapshot", async () => {
    bound();
    await nextTick();
    expect(api.migrateLegacyRtw).toHaveBeenCalledWith("h1", ME, PARTNER);
    api.onPlan(null);
    expect(api.migrateLegacyRtw).toHaveBeenCalledTimes(1);
  });
});

describe("return to work store writes", () => {
  it("saves the return date and rejects a bad one", async () => {
    const store = bound();
    await store.setReturnDate("2026-11-04");
    expect(api.saveRtwPlan).toHaveBeenCalledWith("h1", ME, { returnDate: "2026-11-04" });
    await store.setReturnDate("soon");
    expect(api.saveRtwPlan).toHaveBeenLastCalledWith("h1", ME, { returnDate: null });
  });

  it("adds, edits, ticks and deletes a task", async () => {
    const store = bound({
      tasks: [{ id: "t1", title: "Old title", owner: ME, group: "home", due: null, done: false, notes: "" }],
    });
    await store.addTask({ title: "  Book a trial ", group: "childcare", owner: PARTNER, due: "2026-10-20" });
    expect(api.addTask).toHaveBeenCalledWith("h1", ME, {
      title: "Book a trial",
      group: "childcare",
      due: "2026-10-20",
      owner: PARTNER,
      notes: "",
    });
    expect(await store.addTask({ title: "   " })).toBeNull();

    await store.updateTask("t1", { title: "New title", owner: "both" });
    expect(api.updateTask).toHaveBeenCalledWith("h1", "t1", expect.objectContaining({ title: "New title", owner: "both" }));
    expect(await store.updateTask("missing", { title: "x" })).toBeNull();

    await store.toggleTask("t1");
    expect(api.toggleTask).toHaveBeenCalledWith("h1", "t1", true, ME);
    await store.removeTask("t1");
    expect(api.deleteTask).toHaveBeenCalledWith("h1", "t1");
  });

  it("normalises a task draft", () => {
    expect(cleanTask({ title: "x", group: "nope", owner: "", due: "tomorrow" })).toEqual({
      title: "x",
      group: "home",
      due: null,
      owner: "both",
      notes: "",
    });
    expect(cleanTask({ title: "  " })).toBeNull();
  });

  it("stores a responsibility as a uid, both or nothing", async () => {
    const store = bound();
    await store.setResponsibility("meals", PARTNER);
    expect(api.setResponsibility).toHaveBeenCalledWith("h1", ME, "meals", PARTNER);
    await store.setResponsibility("meals", null);
    expect(api.setResponsibility).toHaveBeenLastCalledWith("h1", ME, "meals", null);
    expect(await store.setResponsibility("unknown-area", ME)).toBe(false);
    expect(api.setResponsibility).toHaveBeenCalledTimes(2);
  });

  it("merges one pumping choice at a time", async () => {
    const store = bound({ plan: { pumping: { times: ["morning"] } } });
    await store.togglePumpingItem("find-room");
    expect(api.setPumping).toHaveBeenCalledWith("h1", ME, { items: { "find-room": true } });
    await store.setSessions(3);
    expect(api.setPumping).toHaveBeenLastCalledWith("h1", ME, { sessions: 3 });
    await store.setSessions(9);
    expect(api.setPumping).toHaveBeenLastCalledWith("h1", ME, { sessions: null });
    await store.togglePumpingTime("midday");
    expect(api.setPumping).toHaveBeenLastCalledWith("h1", ME, { times: ["morning", "midday"] });
    await store.togglePumpingTime("morning");
    expect(api.setPumping).toHaveBeenLastCalledWith("h1", ME, { times: [] });
    expect(await store.togglePumpingTime("nope")).toBe(false);
  });

  it("reports a failed write without hiding the page", async () => {
    const store = bound();
    api.saveRtwPlan.mockRejectedValueOnce(Object.assign(new Error("no"), { code: "permission-denied" }));
    expect(await store.setReturnDate("2026-11-04")).toBe(false);
    expect(store.writeError).toContain("could not save the plan");
    expect(store.error).toBeNull();
  });

  it("writes nothing when no household is bound", async () => {
    const store = fresh();
    expect(await store.addTask({ title: "x" })).toBeNull();
    expect(api.addTask).not.toHaveBeenCalled();
  });
});
