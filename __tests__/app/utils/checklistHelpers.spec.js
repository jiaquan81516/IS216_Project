import { describe, it, expect } from "vitest";
import { dueText, TABS, TITLE_MAX, taskOwner, inTab, checklistView, dueLabel, ownerChip } from "@/app/utils/checklistHelpers";

describe("constants", () => {
  it("TABS is all/mine/partner, frozen", () => {
    expect(TABS).toEqual(["all", "mine", "partner"]);
    expect(Object.isFrozen(TABS)).toBe(true);
  });
  it("TITLE_MAX is 120", () => expect(TITLE_MAX).toBe(120));
});

describe("dueText", () => {
  const today = new Date(2026, 10, 4);

  it("returns '' for a missing/invalid due date", () => {
    expect(dueText(undefined, today)).toBe("");
    expect(dueText("not-a-date", today)).toBe("");
  });

  it("says 'Due today' / 'Due tomorrow'", () => {
    expect(dueText("2026-11-04", today)).toBe("Due today");
    expect(dueText("2026-11-05", today)).toBe("Due tomorrow");
  });

  it("says 'Due in N days' further out", () => {
    expect(dueText("2026-11-09", today)).toBe("Due in 5 days");
  });

  it("says 'Overdue by N day(s)', pluralising correctly", () => {
    expect(dueText("2026-11-03", today)).toBe("Overdue by 1 day");
    expect(dueText("2026-11-01", today)).toBe("Overdue by 3 days");
  });
});

describe("taskOwner", () => {
  it("resolves via ownerKey, defaulting to 'open' for an empty owner", () => {
    expect(taskOwner({ owner: "me1" }, "me1")).toBe("me");
    expect(taskOwner({ owner: "p1" }, "me1")).toBe("partner");
    expect(taskOwner({ owner: "both" }, "me1")).toBe("both");
    expect(taskOwner({}, "me1")).toBe("open");
    expect(taskOwner({ owner: null }, "me1")).toBe("open");
  });
});

describe("inTab", () => {
  const meUid = "me1";
  it("'all' tab always shows every task", () => {
    expect(inTab({ owner: "p1" }, "all", meUid)).toBe(true);
    expect(inTab({}, "all", meUid)).toBe(true);
  });

  it("a task with no set owner shows in both mine and partner's tab", () => {
    expect(inTab({}, "mine", meUid)).toBe(true);
    expect(inTab({}, "partner", meUid)).toBe(true);
  });

  it("a 'both' task shows in both mine and partner's tab", () => {
    expect(inTab({ owner: "both" }, "mine", meUid)).toBe(true);
    expect(inTab({ owner: "both" }, "partner", meUid)).toBe(true);
  });

  it("mine/partner tabs only show the matching owner otherwise", () => {
    expect(inTab({ owner: "me1" }, "mine", meUid)).toBe(true);
    expect(inTab({ owner: "me1" }, "partner", meUid)).toBe(false);
    expect(inTab({ owner: "p1" }, "partner", meUid)).toBe(true);
    expect(inTab({ owner: "p1" }, "mine", meUid)).toBe(false);
  });
});

describe("checklistView", () => {
  const today = new Date(2026, 10, 4);
  const meUid = "me1";

  it("splits open tasks into due groups and done tasks separately", () => {
    const tasks = [
      { id: "1", title: "A", due: "2026-11-04", owner: "both" },
      { id: "2", title: "B", due: "2026-11-06", owner: "both" },
      { id: "3", title: "C", owner: "both", done: true, doneAt: new Date(2026, 10, 3) },
    ];
    const { groups, done, openCount } = checklistView(tasks, { meUid, today });
    expect(openCount).toBe(2);
    expect(done).toHaveLength(1);
    expect(groups.map((g) => g.key)).toEqual(["today", "week"]);
  });

  it("groups an overdue task under 'today'", () => {
    const tasks = [{ id: "1", title: "A", due: "2026-11-01", owner: "both" }];
    const { groups } = checklistView(tasks, { meUid, today });
    expect(groups[0].key).toBe("today");
    expect(groups[0].tasks[0].id).toBe("1");
  });

  it("groups a date more than 6 days out under 'later'", () => {
    const tasks = [{ id: "1", title: "A", due: "2026-11-15", owner: "both" }];
    const { groups } = checklistView(tasks, { meUid, today });
    expect(groups[0].key).toBe("later");
  });

  it("groups a dateless task under 'none'", () => {
    const tasks = [{ id: "1", title: "A", owner: "both" }];
    const { groups } = checklistView(tasks, { meUid, today });
    expect(groups[0].key).toBe("none");
  });

  it("omits empty groups entirely", () => {
    const tasks = [{ id: "1", title: "A", due: "2026-11-04", owner: "both" }];
    const { groups } = checklistView(tasks, { meUid, today });
    expect(groups).toHaveLength(1);
  });

  it("orders tasks within a group by due date then title", () => {
    const tasks = [
      { id: "b", title: "Bravo", due: "2026-11-04", owner: "both" },
      { id: "a", title: "Alpha", due: "2026-11-04", owner: "both" },
    ];
    const { groups } = checklistView(tasks, { meUid, today });
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("sorts done tasks newest-completed first", () => {
    const tasks = [
      { id: "1", title: "A", owner: "both", done: true, doneAt: new Date(2026, 10, 1) },
      { id: "2", title: "B", owner: "both", done: true, doneAt: new Date(2026, 10, 3) },
    ];
    const { done } = checklistView(tasks, { meUid, today });
    expect(done.map((t) => t.id)).toEqual(["2", "1"]);
  });

  it("filters by tab before grouping", () => {
    const tasks = [
      { id: "1", title: "Mine", owner: "me1", due: "2026-11-04" },
      { id: "2", title: "Theirs", owner: "p1", due: "2026-11-04" },
    ];
    const { groups } = checklistView(tasks, { meUid, today, tab: "mine" });
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["1"]);
  });

  it("handles an empty/missing task list", () => {
    expect(checklistView(undefined, { meUid, today })).toEqual({ groups: [], done: [], openCount: 0 });
    expect(checklistView([], { meUid, today })).toEqual({ groups: [], done: [], openCount: 0 });
  });
});

describe("dueLabel", () => {
  it("delegates to dueText using the task's due field", () => {
    expect(dueLabel({ due: "2026-11-04" }, new Date(2026, 10, 4))).toBe("Due today");
    expect(dueLabel({}, new Date(2026, 10, 4))).toBe("");
  });
});

describe("ownerChip", () => {
  const meUid = "me1";

  it("labels 'both'", () => {
    expect(ownerChip({ owner: "both" }, { meUid })).toEqual({ initial: "B", name: "Both" });
  });

  it("labels me with my own initial and name", () => {
    expect(ownerChip({ owner: "me1" }, { meUid, meName: "Jess" })).toEqual({ initial: "J", name: "Jess" });
  });

  it("labels the partner with their initial and name", () => {
    expect(ownerChip({ owner: "p1" }, { meUid, partnerName: "Pat" })).toEqual({ initial: "P", name: "Pat" });
  });

  it("falls back to default names when custom ones are blank", () => {
    expect(ownerChip({ owner: "me1" }, { meUid, meName: "" })).toEqual({ initial: "M", name: "Me" });
    expect(ownerChip({ owner: "p1" }, { meUid, partnerName: "" })).toEqual({ initial: "P", name: "Your partner" });
  });

  it("shows 'Not set' for an open/unowned task", () => {
    expect(ownerChip({}, { meUid })).toEqual({ initial: "?", name: "Not set" });
  });
});
