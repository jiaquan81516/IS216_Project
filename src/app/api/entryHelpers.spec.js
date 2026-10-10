import { describe, expect, it } from "vitest";
import { groupByDay, lastOfType, summariseEntry, todayStats } from "./entryHelpers";

const ts = (date) => ({ toDate: () => date });
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe("summariseEntry", () => {
  it("describes a breastfeed", () => {
    const e = { type: "feed", at: ts(at(2026, 10, 9, 21, 5)), details: { method: "breast", side: "left", minutes: 18 } };
    expect(summariseEntry(e)).toEqual({ title: "Feeding", detail: "Breastfeeding, left, 18 minutes", note: "" });
  });

  it("describes bottle and expressed feeds", () => {
    expect(summariseEntry({ type: "feed", details: { method: "bottle", ml: 90 } }).detail).toBe("Bottle, 90 ml");
    expect(summariseEntry({ type: "feed", details: { method: "expressed", ml: 60 } }).detail).toBe("Expressed milk, 60 ml");
  });

  it("describes sleep, finished and ongoing", () => {
    const done = { type: "sleep", at: ts(at(2026, 10, 9, 21, 0)), endedAt: ts(at(2026, 10, 9, 22, 30)) };
    expect(summariseEntry(done).detail).toBe("1 h 30 min, 9:00 PM to 10:30 PM");
    const going = { type: "sleep", at: ts(at(2026, 10, 9, 21, 0)), endedAt: null };
    expect(summariseEntry(going).detail).toBe("Started 9:00 PM, still sleeping");
  });

  it("describes nappy, medication and note entries", () => {
    expect(summariseEntry({ type: "nappy", details: { nappyType: "wet" } })).toMatchObject({ title: "Diaper", detail: "Wet nappy" });
    expect(summariseEntry({ type: "medication", details: { drug: "Paracetamol", dose: "2.5 ml" } })).toMatchObject({
      title: "Medication",
      detail: "Paracetamol, 2.5 ml",
    });
    expect(summariseEntry({ type: "note", details: { text: "Check the rash" } })).toMatchObject({
      title: "Note",
      detail: "Check the rash",
    });
  });

  it("returns the optional note on other types", () => {
    expect(summariseEntry({ type: "nappy", details: { nappyType: "both", text: "Rash" } }).note).toBe("Rash");
  });
});

describe("groupByDay", () => {
  it("labels days and keeps order", () => {
    const today = at(2026, 10, 9, 12);
    const entries = [
      { id: "a", at: ts(at(2026, 10, 9, 9)) },
      { id: "b", at: ts(at(2026, 10, 9, 7)) },
      { id: "c", at: ts(at(2026, 10, 8, 23)) },
      { id: "d", at: ts(at(2026, 10, 6, 10)) },
    ];
    const groups = groupByDay(entries, today);
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Tue 6 Oct"]);
    expect(groups[0].entries.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("todayStats", () => {
  it("counts feeds, nappies and sleep since local midnight", () => {
    const now = at(2026, 10, 9, 12);
    const entries = [
      { type: "feed", at: ts(at(2026, 10, 9, 8)) },
      { type: "feed", at: ts(at(2026, 10, 9, 10)) },
      { type: "feed", at: ts(at(2026, 10, 8, 23)) },
      { type: "nappy", at: ts(at(2026, 10, 9, 9)) },
      { type: "sleep", at: ts(at(2026, 10, 9, 1)), endedAt: ts(at(2026, 10, 9, 3)) },
      { type: "sleep", at: ts(at(2026, 10, 9, 11)), endedAt: null },
    ];
    expect(todayStats(entries, now)).toEqual({ feeds: 2, sleepMinutes: 180, nappies: 1 });
  });
});

describe("lastOfType", () => {
  it("returns the newest of the type or null", () => {
    const entries = [
      { id: "a", type: "feed", at: ts(at(2026, 10, 9, 8)) },
      { id: "b", type: "feed", at: ts(at(2026, 10, 9, 10)) },
      { id: "c", type: "nappy", at: ts(at(2026, 10, 9, 11)) },
    ];
    expect(lastOfType(entries, "feed").id).toBe("b");
    expect(lastOfType(entries, "sleep")).toBeNull();
  });
});
