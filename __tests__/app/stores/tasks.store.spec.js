import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { subscribeTasks, addTask, updateTask, toggleTask, deleteTask } from "@/api/tasks";
import { notifyPartner } from "@/api/push";
import { useTasksStore, cleanTask } from "@/app/stores/tasks";

vi.mock("@/api/tasks", () => ({
  subscribeTasks: vi.fn(() => vi.fn()),
  addTask: vi.fn().mockResolvedValue("new-id"),
  updateTask: vi.fn().mockResolvedValue(undefined),
  toggleTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/api/push", () => ({ notifyPartner: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  subscribeTasks.mockImplementation(() => vi.fn());
  addTask.mockResolvedValue("new-id");
  setActivePinia(createPinia());
});

describe("cleanTask", () => {
  it("returns null for a missing or blank title", () => {
    expect(cleanTask(null)).toBeNull();
    expect(cleanTask({})).toBeNull();
    expect(cleanTask({ title: "   " })).toBeNull();
  });
  it("trims the title and caps it at 120 characters", () => {
    expect(cleanTask({ title: "  Buy milk  " }).title).toBe("Buy milk");
    expect(cleanTask({ title: "x".repeat(200) }).title).toHaveLength(120);
  });
  it("falls back to 'home' for an unrecognised group", () => {
    expect(cleanTask({ title: "x", group: "bogus" }).group).toBe("home");
    expect(cleanTask({ title: "x", group: "work" }).group).toBe("work");
  });
  it("only accepts a genuinely valid ISO due date", () => {
    expect(cleanTask({ title: "x", due: "2026-10-14" }).due).toBe("2026-10-14");
    expect(cleanTask({ title: "x", due: "2026-02-30" }).due).toBeNull();
    expect(cleanTask({ title: "x", due: "bad" }).due).toBeNull();
  });
  it("falls back to the given owner, or 'both' by default", () => {
    expect(cleanTask({ title: "x" }).owner).toBe("both");
    expect(cleanTask({ title: "x" }, "me1").owner).toBe("me1");
    expect(cleanTask({ title: "x", owner: "partner1" }).owner).toBe("partner1");
  });
  it("defaults notes to '' unless a string is given", () => {
    expect(cleanTask({ title: "x" }).notes).toBe("");
    expect(cleanTask({ title: "x", notes: "call doctor" }).notes).toBe("call doctor");
    expect(cleanTask({ title: "x", notes: 5 }).notes).toBe("");
  });
});

describe("useTasksStore", () => {
  it("starts loading with no tasks", () => {
    const store = useTasksStore();
    expect(store.tasks).toEqual([]);
    expect(store.loading).toBe(true);
  });

  it("populates tasks and stops loading once the subscription delivers", () => {
    const store = useTasksStore();
    store.bind("house1", "me1", "partner1");
    const onData = subscribeTasks.mock.calls[0][1];
    onData([{ id: "t1", title: "Buy milk" }]);
    expect(store.tasks).toEqual([{ id: "t1", title: "Buy milk" }]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("surfaces a subscription error", () => {
    const store = useTasksStore();
    store.bind("house1", "me1");
    const onError = subscribeTasks.mock.calls[0][2];
    onError({ code: "permission-denied" });
    expect(store.error).toEqual({ code: "permission-denied" });
    expect(store.loading).toBe(false);
  });

  it("does nothing when binding with no household id", () => {
    const store = useTasksStore();
    store.bind("");
    expect(subscribeTasks).not.toHaveBeenCalled();
  });

  it("ignores a stale subscription callback after unbind", () => {
    const store = useTasksStore();
    store.bind("house1", "me1");
    const onData = subscribeTasks.mock.calls[0][1];
    store.unbind();
    onData([{ id: "t1" }]);
    expect(store.tasks).toEqual([]);
    expect(store.loading).toBe(true);
  });

  describe("addTask", () => {
    it("adds a task and announces it to the other parent when it's theirs", async () => {
      const store = useTasksStore();
      store.bind("house1", "me1", "partner1");
      const added = await store.addTask({ title: "Buy milk", owner: "partner1" });
      expect(added.title).toBe("Buy milk");
      expect(addTask).toHaveBeenCalledWith("house1", "me1", expect.objectContaining({ title: "Buy milk" }));
      expect(notifyPartner).toHaveBeenCalledWith("house1", "task", "new-id");
    });

    it("does not announce a task assigned to 'both' or to myself", async () => {
      const store = useTasksStore();
      store.bind("house1", "me1", "partner1");
      await store.addTask({ title: "A", owner: "both" });
      await store.addTask({ title: "B", owner: "me1" });
      expect(notifyPartner).not.toHaveBeenCalled();
    });

    it("announces the correct new task's id even when two adds race each other", async () => {
      const store = useTasksStore();
      store.bind("house1", "me1", "partner1");
      let resolveFirst;
      addTask.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
      addTask.mockImplementationOnce(() => Promise.resolve("second-id"));

      const firstAdd = store.addTask({ title: "First", owner: "partner1" });
      const secondAdd = store.addTask({ title: "Second", owner: "partner1" });
      await secondAdd; // the second call resolves first
      resolveFirst("first-id");
      await firstAdd;

      expect(notifyPartner).toHaveBeenNthCalledWith(1, "house1", "task", "second-id");
      expect(notifyPartner).toHaveBeenNthCalledWith(2, "house1", "task", "first-id");
    });

    it("returns null for an invalid task and never calls the API", async () => {
      const store = useTasksStore();
      store.bind("house1", "me1");
      const result = await store.addTask({ title: "   " });
      expect(result).toBeNull();
      expect(addTask).not.toHaveBeenCalled();
    });

    it("returns null and sets writeError when the API call fails", async () => {
      addTask.mockRejectedValueOnce({ code: "unavailable" });
      const store = useTasksStore();
      store.bind("house1", "me1");
      const result = await store.addTask({ title: "Buy milk" });
      expect(result).toBeNull();
      expect(store.writeError).toContain("could not add");
      expect(notifyPartner).not.toHaveBeenCalled();
    });

    it("does nothing when no household is bound", async () => {
      const store = useTasksStore();
      const result = await store.addTask({ title: "Buy milk" });
      expect(result).toBeNull();
      expect(addTask).not.toHaveBeenCalled();
    });
  });

  describe("updateTask", () => {
    it("merges the patch onto the existing task and announces an owner change", async () => {
      const store = useTasksStore();
      store.bind("house1", "me1", "partner1");
      const onData = subscribeTasks.mock.calls[0][1];
      onData([{ id: "t1", title: "Buy milk", owner: "me1", group: "home" }]);
      const result = await store.updateTask("t1", { owner: "partner1" });
      expect(result).toMatchObject({ id: "t1", title: "Buy milk", owner: "partner1" });
      expect(updateTask).toHaveBeenCalledWith("house1", "t1", expect.objectContaining({ owner: "partner1" }));
      expect(notifyPartner).toHaveBeenCalledWith("house1", "task", "t1");
    });

    it("does not announce when the owner is unchanged", async () => {
      const store = useTasksStore();
      store.bind("house1", "me1", "partner1");
      const onData = subscribeTasks.mock.calls[0][1];
      onData([{ id: "t1", title: "Buy milk", owner: "partner1" }]);
      await store.updateTask("t1", { title: "Buy formula" });
      expect(notifyPartner).not.toHaveBeenCalled();
    });

    it("returns null for a task id that doesn't exist", async () => {
      const store = useTasksStore();
      store.bind("house1", "me1");
      expect(await store.updateTask("missing", { title: "x" })).toBeNull();
      expect(updateTask).not.toHaveBeenCalled();
    });
  });

  describe("toggleTask / removeTask", () => {
    it("toggles a task's done state", async () => {
      const store = useTasksStore();
      store.bind("house1", "me1");
      const onData = subscribeTasks.mock.calls[0][1];
      onData([{ id: "t1", done: false }]);
      const ok = await store.toggleTask("t1");
      expect(ok).toBe(true);
      expect(toggleTask).toHaveBeenCalledWith("house1", "t1", true, "me1");
    });

    it("resolves false for a missing task without calling the API", async () => {
      const store = useTasksStore();
      store.bind("house1", "me1");
      const ok = await store.toggleTask("missing");
      expect(ok).toBe(false);
      expect(toggleTask).not.toHaveBeenCalled();
    });

    it("removes a task", async () => {
      const store = useTasksStore();
      store.bind("house1", "me1");
      const ok = await store.removeTask("t1");
      expect(ok).toBe(true);
      expect(deleteTask).toHaveBeenCalledWith("house1", "t1");
    });

    it("surfaces a write error on failure", async () => {
      deleteTask.mockRejectedValueOnce({ code: "unavailable" });
      const store = useTasksStore();
      store.bind("house1", "me1");
      const ok = await store.removeTask("t1");
      expect(ok).toBe(false);
      expect(store.writeError).toContain("could not delete");
    });
  });
});
