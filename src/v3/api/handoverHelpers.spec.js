import { describe, expect, it } from "vitest";
import {
  formatWindow,
  handoverRows,
  handoverStatus,
  periodStartFrom,
  suggestedNextUp,
  summariseWindow,
  summaryBlocks,
  summaryLine,
} from "@/v3/api/handoverHelpers";

const at = (iso) => new Date(iso);
const NOW = at("2026-10-10T19:00:00");

function entry(type, iso, extra = {}) {
  return { id: `${type}-${iso}`, type, at: at(iso), ...extra };
}

describe("periodStartFrom", () => {
  it("uses the previous handover's sentAt", () => {
    expect(periodStartFrom({ sentAt: at("2026-10-10T07:10:00") }, NOW).toISOString()).toBe(
      at("2026-10-10T07:10:00").toISOString(),
    );
  });

  it("falls back to the start of today when there is none", () => {
    const start = periodStartFrom(null, NOW);
    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(10);
  });

  it("accepts a Firestore style timestamp", () => {
    const sent = at("2026-10-10T06:00:00");
    expect(periodStartFrom({ sentAt: { toDate: () => sent } }, NOW)).toEqual(sent);
  });
});

describe("summariseWindow", () => {
  const entries = [
    entry("feed", "2026-10-10T18:00:00"),
    entry("feed", "2026-10-10T08:00:00"),
    entry("feed", "2026-10-10T06:00:00"), // before the window
    entry("nappy", "2026-10-10T09:00:00"),
    entry("sleep", "2026-10-10T13:00:00", { endedAt: at("2026-10-10T14:40:00") }),
    entry("note", "2026-10-10T10:00:00"),
  ];

  it("counts only what started inside the window", () => {
    expect(summariseWindow(entries, at("2026-10-10T07:10:00"), NOW)).toEqual({
      feeds: 2,
      sleepMinutes: 100,
      nappies: 1,
    });
  });

  it("counts a sleep that is still going up to now", () => {
    const open = [entry("sleep", "2026-10-10T18:30:00")];
    expect(summariseWindow(open, at("2026-10-10T07:00:00"), NOW).sleepMinutes).toBe(30);
  });

  it("clips a sleep that runs past now", () => {
    const over = [entry("sleep", "2026-10-10T18:30:00", { endedAt: at("2026-10-10T21:00:00") })];
    expect(summariseWindow(over, at("2026-10-10T07:00:00"), NOW).sleepMinutes).toBe(30);
  });

  it("is all zeros with no entries, and ignores entries with no time", () => {
    expect(summariseWindow([], at("2026-10-10T07:00:00"), NOW)).toEqual({ feeds: 0, sleepMinutes: 0, nappies: 0 });
    expect(summariseWindow([{ type: "feed" }], at("2026-10-10T07:00:00"), NOW).feeds).toBe(0);
    expect(summariseWindow(undefined, at("2026-10-10T07:00:00"), NOW).feeds).toBe(0);
  });
});

describe("summaryBlocks and summaryLine", () => {
  it("names the three blocks and makes the words singular when there is one", () => {
    expect(summaryBlocks({ feeds: 1, sleepMinutes: 220, nappies: 1 })).toEqual([
      { key: "feeds", label: "feed", value: "1" },
      { key: "sleep", label: "sleep", value: "3 h 40 min" },
      { key: "nappies", label: "nappy", value: "1" },
    ]);
    expect(summaryBlocks({ feeds: 4, sleepMinutes: 0, nappies: 3 }).map((b) => b.label)).toEqual([
      "feeds",
      "sleep",
      "nappies",
    ]);
  });

  it("copes with a missing summary", () => {
    expect(summaryLine(undefined)).toBe("0 feeds, 0 min sleep, 0 nappies");
  });

  it("reads as one line", () => {
    expect(summaryLine({ feeds: 4, sleepMinutes: 220, nappies: 3 })).toBe("4 feeds, 3 h 40 min sleep, 3 nappies");
  });
});

describe("suggestedNextUp", () => {
  const rotaView = {
    pattern: "alternate",
    firstOnDuty: "me",
    startDate: "2026-10-10",
    handoverTime: "07:00",
    overrides: {},
    swaps: [],
  };

  it("works out the next feed from the last feed logged", () => {
    const list = [entry("feed", "2026-10-10T18:00:00"), entry("feed", "2026-10-10T09:00:00")];
    expect(suggestedNextUp(list, null, NOW)[0]).toBe("Next feed due around 9:00 PM");
  });

  it("names who is on duty tonight from the rota", () => {
    expect(suggestedNextUp([], rotaView, NOW, { me: "Daniel", partner: "Mei" })).toEqual([
      "Daniel is on duty tonight",
    ]);
    expect(suggestedNextUp([], { ...rotaView, firstOnDuty: "partner" }, NOW, { partner: "Mei" })).toEqual([
      "Mei is on duty tonight",
    ]);
  });

  it("says you when no name is known, and notes a split night", () => {
    expect(suggestedNextUp([], rotaView, NOW)).toEqual(["You are on duty tonight"]);
    expect(suggestedNextUp([], { ...rotaView, pattern: "split" }, NOW)).toEqual(["Tonight is a split night"]);
  });

  it("adds a medication line only when a repeat was written down", () => {
    const repeat = [entry("medication", "2026-10-10T15:00:00", { details: { text: "again in 6 hours" } })];
    const once = [entry("medication", "2026-10-10T15:00:00", { details: { text: "one dose given" } })];
    expect(suggestedNextUp(repeat, null, NOW)).toEqual(["Medication due"]);
    expect(suggestedNextUp(once, null, NOW)).toEqual([]);
  });

  it("never offers more than three", () => {
    const list = [
      entry("feed", "2026-10-10T18:00:00"),
      entry("medication", "2026-10-10T15:00:00", { details: { text: "repeat tonight" } }),
    ];
    const out = suggestedNextUp(list, rotaView, NOW, { me: "Daniel", partner: "Mei" });
    expect(out).toHaveLength(3);
    expect(out).toEqual(["Next feed due around 9:00 PM", "Daniel is on duty tonight", "Medication due"]);
  });

  it("offers nothing from an empty log and no rota", () => {
    expect(suggestedNextUp([], null, NOW)).toEqual([]);
    expect(suggestedNextUp(undefined, {}, NOW)).toEqual([]);
  });
});

describe("handoverStatus", () => {
  it("is accepted once it has been accepted", () => {
    expect(handoverStatus({ to: "u1", acceptedAt: at("2026-10-10T07:20:00") }, "u1")).toBe("accepted");
  });

  it("waits for me when it was sent to me", () => {
    expect(handoverStatus({ to: "u1", acceptedAt: null }, "u1")).toBe("waiting for you");
  });

  it("waits for them, by name when it is known", () => {
    expect(handoverStatus({ to: "u2", acceptedAt: null }, "u1", "Mei")).toBe("waiting for Mei");
    expect(handoverStatus({ to: "u2", acceptedAt: null }, "u1")).toBe("waiting for your partner");
  });

  it("is empty with nothing to describe", () => {
    expect(handoverStatus(null, "u1")).toBe("");
  });
});

describe("formatWindow", () => {
  it("reads as two times on the same day", () => {
    expect(formatWindow(at("2026-10-10T07:10:00"), at("2026-10-10T19:10:00"))).toBe("7:10 AM to 7:10 PM");
  });

  it("names the day when the shift crossed midnight", () => {
    expect(formatWindow(at("2026-10-09T21:00:00"), at("2026-10-10T07:10:00"))).toBe("Yesterday 9:00 PM to 7:10 AM");
  });

  it("falls back to one time, or nothing", () => {
    expect(formatWindow(null, at("2026-10-10T07:10:00"))).toBe("7:10 AM");
    expect(formatWindow(at("2026-10-10T07:10:00"), null)).toBe("7:10 AM");
    expect(formatWindow(null, null)).toBe("");
  });
});

describe("handoverRows", () => {
  const list = [
    entry("feed", "2026-10-10T18:00:00"),
    entry("nappy", "2026-10-10T12:00:00"),
    entry("feed", "2026-10-10T06:00:00"),
  ];
  const handovers = [{ id: "h1", sentAt: at("2026-10-10T07:10:00") }];

  it("puts a divider between the entries either side of a handover", () => {
    const rows = handoverRows(list, handovers);
    expect(rows.map((r) => r.kind)).toEqual(["entry", "entry", "divider", "entry"]);
    expect(rows[2]).toMatchObject({ key: "handover-h1", label: "Handover sent 7:10 AM" });
  });

  it("leaves out a boundary with nothing on one side of it", () => {
    const rows = handoverRows(list, [{ id: "h2", sentAt: at("2026-10-10T19:00:00") }]);
    expect(rows.every((r) => r.kind === "entry")).toBe(true);
  });

  it("draws every boundary in the window, newest first", () => {
    const rows = handoverRows(list, [
      { id: "h1", sentAt: at("2026-10-10T07:10:00") },
      { id: "h2", sentAt: at("2026-10-10T13:00:00") },
    ]);
    expect(rows.map((r) => r.key)).toEqual([
      list[0].id,
      "handover-h2",
      list[1].id,
      "handover-h1",
      list[2].id,
    ]);
  });

  it("does nothing with fewer than two entries, or with no handovers", () => {
    expect(handoverRows([list[0]], handovers)).toEqual([{ kind: "entry", key: list[0].id, entry: list[0] }]);
    expect(handoverRows(list, []).map((r) => r.kind)).toEqual(["entry", "entry", "entry"]);
    expect(handoverRows(list, undefined)).toHaveLength(3);
    expect(handoverRows(undefined, handovers)).toEqual([]);
  });
});
