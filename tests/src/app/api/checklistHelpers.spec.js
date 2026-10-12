import { describe, expect, it } from "vitest";
import {
  checklistView,
  dueLabel,
  inTab,
  myOpenTasks,
  ownerChip,
  queuedTasks,
  taskOwner,
} from "@/app/api/checklistHelpers";

const ME = "u1";
const PARTNER = "u2";
const TODAY = new Date("2026-10-13T10:00:00");

function task(id, extra = {}) {
  return { id, title: `Task ${id}`, owner: ME, due: null, done: false, queued: false, ...extra };
}

describe("taskOwner and inTab", () => {
  it("says whose a task is", () => {
    expect(taskOwner(task("a"), ME)).toBe("me");
    expect(taskOwner(task("a", { owner: PARTNER }), ME)).toBe("partner");
    expect(taskOwner(task("a", { owner: "both" }), ME)).toBe("both");
    expect(taskOwner(task("a", { owner: "" }), ME)).toBe("open");
  });

  it("shows shared tasks on every tab and the rest only on the owner's", () => {
    const mine = task("a");
    const theirs = task("b", { owner: PARTNER });
    const both = task("c", { owner: "both" });
    expect([mine, theirs, both].map((t) => inTab(t, "all", ME))).toEqual([true, true, true]);
    expect([mine, theirs, both].map((t) => inTab(t, "mine", ME))).toEqual([true, false, true]);
    expect([mine, theirs, both].map((t) => inTab(t, "partner", ME))).toEqual([false, true, true]);
  });
});

describe("checklistView", () => {
  const tasks = [
    task("late", { due: "2026-10-10", title: "Late one" }),
    task("today", { due: "2026-10-13", title: "Today one" }),
    task("tomorrow", { due: "2026-10-14", owner: PARTNER, title: "Tomorrow one" }),
    task("week", { due: "2026-10-19", title: "Week edge" }),
    task("later", { due: "2026-10-20", title: "Later one" }),
    task("none", { title: "No date" }),
    task("d1", { done: true, doneAt: new Date("2026-10-12T08:00:00") }),
    task("d2", { done: true, doneAt: new Date("2026-10-12T09:00:00") }),
  ];

  it("groups open tasks, puts overdue under Today, and leaves empty groups out", () => {
    const view = checklistView(tasks, { meUid: ME, today: TODAY });
    expect(view.groups.map((g) => g.label)).toEqual(["Today", "This week", "Later", "No date"]);
    expect(view.groups[0].tasks.map((t) => t.id)).toEqual(["late", "today"]);
    expect(view.groups[1].tasks.map((t) => t.id)).toEqual(["tomorrow", "week"]);
    expect(view.groups[2].tasks.map((t) => t.id)).toEqual(["later"]);
    expect(view.groups[3].tasks.map((t) => t.id)).toEqual(["none"]);
    expect(view.openCount).toBe(6);
  });

  it("lists finished tasks newest first", () => {
    const view = checklistView(tasks, { meUid: ME, today: TODAY });
    expect(view.done.map((t) => t.id)).toEqual(["d2", "d1"]);
  });

  it("applies the tab", () => {
    const view = checklistView(tasks, { meUid: ME, tab: "partner", today: TODAY });
    expect(view.groups.flatMap((g) => g.tasks).map((t) => t.id)).toEqual(["tomorrow"]);
    expect(view.done).toEqual([]);
  });

  it("copes with no tasks", () => {
    expect(checklistView(undefined, { meUid: ME, today: TODAY })).toEqual({ groups: [], done: [], openCount: 0 });
  });
});

describe("passing tasks on", () => {
  const tasks = [
    task("a", { due: "2026-10-15" }),
    task("b", { queued: true }),
    task("c", { owner: PARTNER, queued: true }),
    task("d", { owner: "both" }),
    task("e", { done: true, queued: true }),
  ];

  it("offers only my own open tasks, soonest first", () => {
    expect(myOpenTasks(tasks, ME).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("finds the ones I queued", () => {
    expect(queuedTasks(tasks, ME).map((t) => t.id)).toEqual(["b"]);
    expect(queuedTasks(undefined, ME)).toEqual([]);
  });
});

describe("labels", () => {
  it("words the due date", () => {
    expect(dueLabel(task("a", { due: "2026-10-13" }), TODAY)).toBe("Due today");
    expect(dueLabel(task("a", { due: "2026-10-14" }), TODAY)).toBe("Due tomorrow");
    expect(dueLabel(task("a", { due: "2026-10-10" }), TODAY)).toBe("Overdue by 3 days");
    expect(dueLabel(task("a"), TODAY)).toBe("");
  });

  it("shows an initial and a name for the owner", () => {
    const names = { meUid: ME, meName: "Daniel", partnerName: "Mei" };
    expect(ownerChip(task("a"), names)).toEqual({ initial: "D", name: "Daniel" });
    expect(ownerChip(task("a", { owner: PARTNER }), names)).toEqual({ initial: "M", name: "Mei" });
    expect(ownerChip(task("a", { owner: "both" }), names)).toEqual({ initial: "B", name: "Both" });
    expect(ownerChip(task("a", { owner: "" }), names)).toEqual({ initial: "?", name: "Not set" });
  });
});
