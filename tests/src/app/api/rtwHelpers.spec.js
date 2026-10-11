import { describe, expect, it } from "vitest";
import {
  balanceHint,
  daysUntil,
  dueText,
  formatDay,
  groupTasks,
  ownerCounts,
  pumpingProgress,
  pumpingSummary,
  responsibilityCounts,
  responsibilitySummary,
  returnSentence,
  sortTasks,
  suggestedTasks,
} from "@/app/api/rtwHelpers";

const TODAY = "2026-10-14";
const task = (over) => ({ id: over.title, title: "T", group: "home", due: null, owner: "both", done: false, notes: "", ...over });

describe("return date helpers", () => {
  it("counts days until the return date", () => {
    expect(daysUntil("2026-11-04", TODAY)).toBe(21);
    expect(daysUntil("2026-10-14", TODAY)).toBe(0);
    expect(daysUntil("2026-10-10", TODAY)).toBe(-4);
    expect(daysUntil("2026-11-04", new Date(2026, 9, 14, 23, 30))).toBe(21);
    expect(daysUntil(null, TODAY)).toBeNull();
    expect(daysUntil("nonsense", TODAY)).toBeNull();
  });

  it("formats the day and the sentence", () => {
    expect(formatDay("2026-11-04", TODAY)).toBe("4 November");
    expect(formatDay("2027-01-05", TODAY)).toBe("5 January 2027");
    expect(returnSentence("2026-11-04", TODAY)).toBe("Back at work on 4 November. 21 days to go.");
    expect(returnSentence("2026-10-15", TODAY)).toBe("Back at work on 15 October. 1 day to go.");
    expect(returnSentence("2026-10-14", TODAY)).toBe("Back at work on 14 October. That is today.");
    expect(returnSentence("2026-10-01", TODAY)).toBe("Back at work since 1 October.");
    expect(returnSentence(null, TODAY)).toBe("");
  });

  it("words due dates", () => {
    expect(dueText(null, TODAY)).toBe("");
    expect(dueText("2026-10-14", TODAY)).toBe("Due today");
    expect(dueText("2026-10-15", TODAY)).toBe("Due tomorrow");
    expect(dueText("2026-10-19", TODAY)).toBe("Due in 5 days");
    expect(dueText("2026-10-13", TODAY)).toBe("Overdue by 1 day");
    expect(dueText("2026-10-12", TODAY)).toBe("Overdue by 2 days");
  });
});

describe("groupTasks", () => {
  const tasks = [
    task({ title: "Done one", done: true, due: "2026-10-01" }),
    task({ title: "No date b" }),
    task({ title: "Later", due: "2026-10-21" }),
    task({ title: "Edge of week", due: "2026-10-20" }),
    task({ title: "Today", due: "2026-10-14" }),
    task({ title: "Late", due: "2026-10-12" }),
    task({ title: "No date a" }),
    task({ title: "Soon", due: "2026-10-16" }),
  ];

  it("splits into ordered groups and sorts inside each", () => {
    const groups = groupTasks(tasks, TODAY);
    expect(groups.map((g) => g.label)).toEqual(["Overdue", "This week", "Later", "No date", "Done"]);
    expect(groups[0].tasks.map((t) => t.title)).toEqual(["Late"]);
    expect(groups[1].tasks.map((t) => t.title)).toEqual(["Today", "Soon", "Edge of week"]);
    expect(groups[2].tasks.map((t) => t.title)).toEqual(["Later"]);
    expect(groups[3].tasks.map((t) => t.title)).toEqual(["No date a", "No date b"]);
    expect(groups[4].tasks.map((t) => t.title)).toEqual(["Done one"]);
  });

  it("leaves out empty groups", () => {
    expect(groupTasks([], TODAY)).toEqual([]);
    expect(groupTasks([task({ title: "Only", due: "2026-10-20" })], TODAY).map((g) => g.label)).toEqual(["This week"]);
  });

  it("sorts by due date then title with undated last, without mutating", () => {
    const input = [task({ title: "b" }), task({ title: "a", due: "2026-10-20" }), task({ title: "A", due: "2026-10-20" })];
    expect(sortTasks(input).map((t) => t.title)).toEqual(["a", "A", "b"]);
    expect(input[0].title).toBe("b");
  });
});

describe("ownerCounts", () => {
  it("counts open tasks per owner", () => {
    const counts = ownerCounts([
      task({ title: "1", owner: "me" }),
      task({ title: "2", owner: "me", done: true }),
      task({ title: "3", owner: "partner" }),
      task({ title: "4", owner: "both" }),
      task({ title: "5", owner: "both" }),
    ]);
    expect(counts).toEqual({ me: 1, partner: 1, both: 2 });
  });
});

describe("suggestedTasks", () => {
  it("returns the three fixed suggestions", () => {
    const all = suggestedTasks([]);
    expect(all.map((s) => s.title)).toEqual([
      "Plan the morning routine",
      "Arrange a childcare trial",
      "Talk to your manager",
    ]);
    expect(all.map((s) => s.group)).toEqual(["home", "childcare", "work"]);
  });

  it("drops suggestions already added, ignoring case and spaces", () => {
    const left = suggestedTasks(["  arrange A childcare TRIAL ", "Something else"]);
    expect(left).toHaveLength(2);
    expect(left.some((s) => s.title === "Arrange a childcare trial")).toBe(false);
  });
});

describe("responsibilities", () => {
  it("counts areas and treats missing choices as not decided", () => {
    const counts = responsibilityCounts({ "morning-routine": "me", dropoff: "me", pickup: "partner", meals: "both" });
    expect(counts).toEqual({ me: 2, partner: 1, both: 1, undecided: 4 });
    expect(responsibilitySummary(counts, "Mei")).toBe("You cover 2, Mei covers 1, shared 1, not decided 4.");
  });

  it("suggests moving one only when the gap is 2 or more", () => {
    expect(balanceHint({ me: 3, partner: 2, both: 0, undecided: 3 }, { me: "Daniel", partner: "Mei" })).toBe("");
    expect(balanceHint({ me: 4, partner: 2, both: 0, undecided: 2 }, { me: "Daniel", partner: "Mei" })).toBe(
      "Daniel has 2 more than Mei. Consider moving one.",
    );
    expect(balanceHint({ me: 1, partner: 4, both: 0, undecided: 3 }, { me: "Daniel", partner: "Mei" })).toBe(
      "Mei has 3 more than Daniel. Consider moving one.",
    );
    expect(balanceHint({ me: 3, partner: 0, both: 0, undecided: 5 })).toBe("You have 3 more than your partner. Consider moving one.");
    expect(balanceHint({ me: 0, partner: 2, both: 0, undecided: 6 })).toBe("Your partner has 2 more than you. Consider moving one.");
  });
});

describe("pumping helpers", () => {
  it("summarises breaks in day order", () => {
    expect(pumpingSummary({ sessions: 3, times: ["afternoon", "morning", "midday"] })).toBe(
      "Plan for 3 breaks: morning, midday, afternoon.",
    );
    expect(pumpingSummary({ sessions: 2, times: [] })).toBe("Plan for 2 breaks.");
    expect(pumpingSummary({ sessions: null, times: ["morning"] })).toBe("Plan for breaks: morning.");
    expect(pumpingSummary({ sessions: null, times: [] })).toBe("");
  });

  it("reports checklist progress", () => {
    expect(pumpingProgress([{ done: true }, { done: false }, { done: true }]).text).toBe("2 of 3 done");
  });
});
