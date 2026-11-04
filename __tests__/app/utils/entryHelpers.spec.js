import { describe, it, expect } from "vitest";
import {
  ENTRY_TYPES, pad2, toDate, formatTime, toTimeInput, startOfDay, formatMinutes,
  summariseEntry, dayLabel, groupByDay, todayStats, lastOfType, describeEntriesError,
  lastFeedHeading,
} from "@/app/utils/entryHelpers";

describe("ENTRY_TYPES", () => {
  it("is frozen and covers feed/sleep/nappy/note/medication", () => {
    expect(Object.isFrozen(ENTRY_TYPES)).toBe(true);
    expect(Object.keys(ENTRY_TYPES).sort()).toEqual(["feed", "medication", "nappy", "note", "sleep"]);
  });
});

describe("pad2", () => {
  it("pads single digits, leaves two digits alone", () => {
    expect(pad2(5)).toBe("05");
    expect(pad2(12)).toBe("12");
    expect(pad2(0)).toBe("00");
  });
});

describe("toDate", () => {
  it("returns null for falsy input", () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate(0)).toBeNull();
    expect(toDate("")).toBeNull();
  });

  it("calls .toDate() on a Firestore-Timestamp-like object", () => {
    const d = new Date(2026, 0, 1);
    expect(toDate({ toDate: () => d })).toBe(d);
  });

  it("passes a real Date straight through", () => {
    const d = new Date(2026, 0, 1);
    expect(toDate(d)).toBe(d);
  });

  it("parses a numeric ms timestamp or ISO string", () => {
    expect(toDate(1700000000000)).toBeInstanceOf(Date);
    expect(toDate("2026-01-01T00:00:00Z")).toBeInstanceOf(Date);
  });

  it("returns null for an unparseable string", () => {
    expect(toDate("not a date")).toBeNull();
  });
});

describe("formatTime", () => {
  it("formats midnight and noon correctly", () => {
    expect(formatTime(new Date(2026, 0, 1, 0, 5))).toBe("12:05 AM");
    expect(formatTime(new Date(2026, 0, 1, 12, 0))).toBe("12:00 PM");
  });

  it("formats a PM hour without leading zero", () => {
    expect(formatTime(new Date(2026, 0, 1, 21, 5))).toBe("9:05 PM");
  });

  it("returns '' for an unparseable value", () => {
    expect(formatTime(null)).toBe("");
  });
});

describe("toTimeInput", () => {
  it("formats as zero-padded 24h HH:mm", () => {
    expect(toTimeInput(new Date(2026, 0, 1, 9, 5))).toBe("09:05");
    expect(toTimeInput(new Date(2026, 0, 1, 21, 5))).toBe("21:05");
  });

  it("returns '' for an unparseable value", () => {
    expect(toTimeInput(null)).toBe("");
  });
});

describe("startOfDay", () => {
  it("zeroes the time of day", () => {
    const d = startOfDay(new Date(2026, 5, 15, 13, 45, 30));
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([0, 0, 0, 0]);
    expect(d.getDate()).toBe(15);
  });
});

describe("formatMinutes", () => {
  it("shows minutes only under an hour", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(0)).toBe("0 min");
  });

  it("shows hours only on an exact hour", () => {
    expect(formatMinutes(120)).toBe("2 h");
  });

  it("shows hours and minutes combined", () => {
    expect(formatMinutes(580)).toBe("9 h 40 min");
  });

  it("rounds to the nearest minute", () => {
    expect(formatMinutes(44.6)).toBe("45 min");
  });

  it("clamps negative totals to 0 min", () => {
    expect(formatMinutes(-10)).toBe("0 min");
  });
});

describe("summariseEntry", () => {
  it("summarises a breastfeeding entry with side and minutes", () => {
    const { title, detail } = summariseEntry({ type: "feed", details: { method: "breast", side: "Left", minutes: 12 } });
    expect(title).toBe("Feeding");
    expect(detail).toBe("Breastfeeding, Left, 12 minutes");
  });

  it("uses singular 'minute' for 1 minute", () => {
    const { detail } = summariseEntry({ type: "feed", details: { method: "breast", minutes: 1 } });
    expect(detail).toBe("Breastfeeding, 1 minute");
  });

  it("summarises expressed milk with ml", () => {
    const { detail } = summariseEntry({ type: "feed", details: { method: "expressed", ml: 90 } });
    expect(detail).toBe("Expressed milk, 90 ml");
  });

  it("summarises a bottle feed with ml", () => {
    const { detail } = summariseEntry({ type: "feed", details: { method: "bottle", ml: 120 } });
    expect(detail).toBe("Bottle, 120 ml");
  });

  it("falls back to plain 'Feed' for an unknown/missing method", () => {
    expect(summariseEntry({ type: "feed", details: {} }).detail).toBe("Feed");
  });

  it("summarises a finished sleep with duration and times", () => {
    const at = new Date(2026, 0, 1, 20, 0);
    const endedAt = new Date(2026, 0, 1, 22, 30);
    const { detail } = summariseEntry({ type: "sleep", at, endedAt, details: {} });
    expect(detail).toBe("2 h 30 min, 8:00 PM to 10:30 PM");
  });

  it("summarises an ongoing sleep (no endedAt)", () => {
    const at = new Date(2026, 0, 1, 20, 0);
    const { detail } = summariseEntry({ type: "sleep", at, details: {} });
    expect(detail).toBe("Started 8:00 PM, still sleeping");
  });

  it("summarises a nappy change with and without a type", () => {
    expect(summariseEntry({ type: "nappy", details: { nappyType: "wet" } }).detail).toBe("Wet nappy");
    expect(summariseEntry({ type: "nappy", details: {} }).detail).toBe("Nappy change");
  });

  it("summarises medication as 'drug, dose'", () => {
    expect(summariseEntry({ type: "medication", details: { drug: "Panadol", dose: "5ml" } }).detail).toBe("Panadol, 5ml");
    expect(summariseEntry({ type: "medication", details: { drug: "Panadol" } }).detail).toBe("Panadol");
  });

  it("summarises a note as its text", () => {
    expect(summariseEntry({ type: "note", details: { text: "Rolled over!" } }).detail).toBe("Rolled over!");
  });

  it("carries the free-text note through for non-note types too", () => {
    expect(summariseEntry({ type: "feed", details: { method: "bottle", ml: 60, text: "fussy" } }).note).toBe("fussy");
  });

  it("falls back to 'Entry' title and empty detail for an unknown type", () => {
    const result = summariseEntry({ type: "unknown", details: {} });
    expect(result.title).toBe("Entry");
    expect(result.detail).toBe("");
  });

  it("handles a missing entry/details object without throwing", () => {
    expect(() => summariseEntry({})).not.toThrow();
    expect(() => summariseEntry(undefined)).not.toThrow();
  });
});

describe("dayLabel", () => {
  const today = new Date(2026, 10, 4); // Wed 4 Nov 2026

  it("says 'Today' for the same calendar day", () => {
    expect(dayLabel(new Date(2026, 10, 4, 23, 0), today)).toBe("Today");
  });

  it("says 'Yesterday' for one day back", () => {
    expect(dayLabel(new Date(2026, 10, 3), today)).toBe("Yesterday");
  });

  it("says 'Weekday D Mon' for anything older", () => {
    expect(dayLabel(new Date(2026, 10, 1), today)).toBe("Sun 1 Nov");
  });

  it("also labels a future date by weekday (not just the past)", () => {
    expect(dayLabel(new Date(2026, 10, 6), today)).toBe("Fri 6 Nov");
  });
});

describe("groupByDay", () => {
  const today = new Date(2026, 10, 4);

  it("groups consecutive same-day entries and keeps order", () => {
    const entries = [
      { type: "feed", at: new Date(2026, 10, 4, 10, 0) },
      { type: "nappy", at: new Date(2026, 10, 4, 9, 0) },
      { type: "feed", at: new Date(2026, 10, 3, 10, 0) },
    ];
    const groups = groupByDay(entries, today);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Today");
    expect(groups[0].entries).toHaveLength(2);
    expect(groups[1].label).toBe("Yesterday");
    expect(groups[1].entries).toHaveLength(1);
  });

  it("starts a new group when day entries are not contiguous (same day appearing twice, separated)", () => {
    const entries = [
      { type: "feed", at: new Date(2026, 10, 4, 10, 0) },
      { type: "feed", at: new Date(2026, 10, 3, 10, 0) },
      { type: "feed", at: new Date(2026, 10, 4, 8, 0) }, // same day as first, but not adjacent
    ];
    const groups = groupByDay(entries, today);
    expect(groups).toHaveLength(3);
  });

  it("skips entries with no usable date", () => {
    const entries = [{ type: "feed", at: null }, { type: "feed", at: new Date(2026, 10, 4) }];
    const groups = groupByDay(entries, today);
    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(1);
  });

  it("returns [] for an empty list", () => {
    expect(groupByDay([], today)).toEqual([]);
  });
});

describe("todayStats", () => {
  const now = new Date(2026, 10, 4, 18, 0);

  it("counts feeds and nappies logged today, ignoring earlier days", () => {
    const entries = [
      { type: "feed", at: new Date(2026, 10, 4, 8, 0) },
      { type: "feed", at: new Date(2026, 10, 3, 8, 0) },
      { type: "nappy", at: new Date(2026, 10, 4, 9, 0) },
    ];
    expect(todayStats(entries, now)).toEqual({ feeds: 1, sleepMinutes: 0, nappies: 1 });
  });

  it("sums finished sleep durations today", () => {
    const entries = [
      { type: "sleep", at: new Date(2026, 10, 4, 1, 0), endedAt: new Date(2026, 10, 4, 3, 0) },
    ];
    expect(todayStats(entries, now).sleepMinutes).toBe(120);
  });

  it("counts an ongoing sleep up to now", () => {
    const entries = [{ type: "sleep", at: new Date(2026, 10, 4, 17, 0) }]; // no endedAt
    expect(todayStats(entries, now).sleepMinutes).toBe(60);
  });

  it("ignores an entry with no usable 'at'", () => {
    expect(todayStats([{ type: "feed", at: null }], now)).toEqual({ feeds: 0, sleepMinutes: 0, nappies: 0 });
  });

  it("returns all zeros for an empty list", () => {
    expect(todayStats([], now)).toEqual({ feeds: 0, sleepMinutes: 0, nappies: 0 });
  });
});

describe("lastOfType", () => {
  it("returns the most recent entry of the given type, regardless of list order", () => {
    const earlier = { type: "feed", at: new Date(2026, 0, 1, 8, 0) };
    const later = { type: "feed", at: new Date(2026, 0, 1, 12, 0) };
    expect(lastOfType([earlier, later], "feed")).toBe(later);
    expect(lastOfType([later, earlier], "feed")).toBe(later);
  });

  it("ignores entries of a different type", () => {
    const feed = { type: "feed", at: new Date(2026, 0, 1, 8, 0) };
    const nappy = { type: "nappy", at: new Date(2026, 0, 1, 12, 0) };
    expect(lastOfType([feed, nappy], "feed")).toBe(feed);
  });

  it("skips entries with no usable date", () => {
    const bad = { type: "feed", at: null };
    const good = { type: "feed", at: new Date(2026, 0, 1) };
    expect(lastOfType([bad, good], "feed")).toBe(good);
  });

  it("returns null when there is no entry of that type", () => {
    expect(lastOfType([], "feed")).toBeNull();
    expect(lastOfType([{ type: "nappy", at: new Date() }], "feed")).toBeNull();
  });
});

describe("describeEntriesError", () => {
  it("has a specific, detailed message for permission-denied", () => {
    const { text, detail } = describeEntriesError("permission-denied");
    expect(text).toContain("Firebase denied access");
    expect(detail).toBe("");
  });

  it("names the missing index for failed-precondition", () => {
    expect(describeEntriesError("failed-precondition").text).toContain("index");
  });

  it("gives a connection message for unavailable/timeout/deadline-exceeded", () => {
    for (const code of ["unavailable", "timeout", "deadline-exceeded"]) {
      expect(describeEntriesError(code).text).toContain("connection");
    }
  });

  it("falls back to a generic message with the error code as detail, for an unknown code", () => {
    const { text, detail } = describeEntriesError("some-weird-code");
    expect(text).toBe("We could not load the care log.");
    expect(detail).toBe("Error code: some-weird-code");
  });

  it("omits the detail line when there is no code at all", () => {
    expect(describeEntriesError(undefined).detail).toBe("");
    expect(describeEntriesError(null).detail).toBe("");
  });
});

describe("lastFeedHeading", () => {
  const now = new Date(2026, 10, 4, 18, 0);

  it("returns '' when there is no feed", () => {
    expect(lastFeedHeading(null, now)).toBe("");
    expect(lastFeedHeading({}, now)).toBe("");
  });

  it("says 'Last feed <time>' for a feed today", () => {
    expect(lastFeedHeading({ at: new Date(2026, 10, 4, 9, 5) }, now)).toBe("Last feed 9:05 AM");
  });

  it("says 'yesterday' for a feed exactly one calendar day back", () => {
    expect(lastFeedHeading({ at: new Date(2026, 10, 3, 9, 5) }, now)).toBe("Last feed yesterday, 9:05 AM");
  });

  it("says 'earlier' for anything older than yesterday", () => {
    expect(lastFeedHeading({ at: new Date(2026, 10, 1, 9, 5) }, now)).toBe("Last feed earlier, 9:05 AM");
  });
});
