import { describe, it, expect } from "vitest";
import {
  toIso, parseIso, isIsoDate, addDays, daysBetween, mondayOf, otherOf,
  dateLabel, weekdayShort, dayNumber, weekLabel, formatHandover,
  carerOn, weekNights, restSummary, suggest, cancelSwap, joinNames,
} from "@/app/utils/rotaHelpers";

describe("toIso / parseIso round-trip", () => {
  it("round-trips a date", () => {
    const d = new Date(2026, 10, 4);
    expect(toIso(d)).toBe("2026-11-04");
    expect(parseIso("2026-11-04").getTime()).toBe(new Date(2026, 10, 4).getTime());
  });

  it("zero-pads single-digit month/day", () => {
    expect(toIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("isIsoDate", () => {
  it("accepts a well-formed, real calendar date", () => {
    expect(isIsoDate("2026-11-04")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true); // leap day
  });

  it("rejects a malformed string", () => {
    expect(isIsoDate("2026-1-4")).toBe(false);
    expect(isIsoDate("not-a-date")).toBe(false);
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
    expect(isIsoDate(20261104)).toBe(false);
  });

  it("rejects an impossible calendar date instead of letting it roll over", () => {
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2023-02-29")).toBe(false); // not a leap year
  });
});

describe("addDays", () => {
  it("adds and subtracts days, crossing month/year boundaries", () => {
    expect(addDays("2026-11-04", 1)).toBe("2026-11-05");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-04", -5)).toBe("2026-10-30");
  });

  it("adding 0 returns the same date", () => {
    expect(addDays("2026-11-04", 0)).toBe("2026-11-04");
  });
});

describe("daysBetween", () => {
  it("is positive when 'to' is after 'from'", () => {
    expect(daysBetween("2026-11-01", "2026-11-04")).toBe(3);
  });
  it("is negative when 'to' is before 'from'", () => {
    expect(daysBetween("2026-11-04", "2026-11-01")).toBe(-3);
  });
  it("is 0 for the same date", () => {
    expect(daysBetween("2026-11-04", "2026-11-04")).toBe(0);
  });
  it("crosses a month boundary correctly", () => {
    expect(daysBetween("2026-11-30", "2026-12-02")).toBe(2);
  });
});

describe("mondayOf", () => {
  it("returns the same date when given a Monday", () => {
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
  });
  it("returns the preceding Monday for any other weekday", () => {
    expect(mondayOf("2026-11-04")).toBe("2026-11-02"); // Wed
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // Sun
  });
  it("accepts a Date object too", () => {
    expect(mondayOf(new Date(2026, 10, 4))).toBe("2026-11-02");
  });
  it("defaults to today when called with no argument", () => {
    expect(() => mondayOf()).not.toThrow();
  });
});

describe("otherOf", () => {
  it("swaps me/partner", () => {
    expect(otherOf("me")).toBe("partner");
    expect(otherOf("partner")).toBe("me");
  });
  it("passes through anything else unchanged", () => {
    expect(otherOf("open")).toBe("open");
    expect(otherOf("other")).toBe("other");
    expect(otherOf("both")).toBe("both");
  });
});

describe("dateLabel / weekdayShort / dayNumber", () => {
  it("formats a weekday + day + month label", () => {
    expect(dateLabel("2026-11-04")).toBe("Wed 4 November");
  });
  it("gives the short weekday", () => {
    expect(weekdayShort("2026-11-04")).toBe("Wed");
  });
  it("gives the bare day number", () => {
    expect(dayNumber("2026-11-04")).toBe(4);
  });
});

describe("weekLabel", () => {
  it("formats a week within one month", () => {
    expect(weekLabel("2026-11-02")).toBe("2 to 8 November");
  });
  it("formats a week spanning two months", () => {
    expect(weekLabel("2026-11-30")).toBe("30 November to 6 December");
  });
});

describe("formatHandover", () => {
  it("formats midnight, noon and a PM hour in 12h clock", () => {
    expect(formatHandover("00:00")).toBe("12:00 AM");
    expect(formatHandover("12:00")).toBe("12:00 PM");
    expect(formatHandover("19:30")).toBe("7:30 PM");
  });
  it("defaults to 7:00 AM for a missing/malformed time", () => {
    expect(formatHandover(null)).toBe("7:00 AM");
    expect(formatHandover(undefined)).toBe("7:00 AM");
    expect(formatHandover("not-a-time")).toBe("7:00 AM");
  });
  it("defaults to 7:00 AM for an out-of-range hour", () => {
    expect(formatHandover("25:00")).toBe("7:00 AM");
  });
});

describe("carerOn", () => {
  it("finds a carer whose days list includes this date's weekday (Monday = 0)", () => {
    const store = { carerNights: [{ label: "Nanny", days: [2] }] }; // Wed
    expect(carerOn(store, "2026-11-04")).toEqual({ label: "Nanny", days: [2] });
  });
  it("returns null when no carer covers that weekday", () => {
    const store = { carerNights: [{ label: "Nanny", days: [0] }] }; // Mon
    expect(carerOn(store, "2026-11-04")).toBeNull(); // Wed
  });
  it("returns null when there are no carers at all", () => {
    expect(carerOn({}, "2026-11-04")).toBeNull();
    expect(carerOn({ carerNights: [] }, "2026-11-04")).toBeNull();
  });
});

describe("weekNights", () => {
  const weekStart = "2026-11-02"; // Monday

  it("returns 7 consecutive nights", () => {
    const nights = weekNights({ pattern: "manual", startDate: weekStart }, weekStart);
    expect(nights).toHaveLength(7);
    expect(nights.map((n) => n.date)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
  });

  it("manual pattern leaves every night 'open' with no resting/second", () => {
    const nights = weekNights({ pattern: "manual", startDate: weekStart }, weekStart);
    for (const n of nights) {
      expect(n.who).toBe("open");
      expect(n.resting).toBeNull();
      expect(n.second).toBeNull();
      expect(n.shared).toBe(false);
      expect(n.source).toBe("pattern");
    }
  });

  it("alternate pattern alternates who is on, starting with firstOnDuty", () => {
    const store = { pattern: "alternate", startDate: weekStart, firstOnDuty: "me" };
    const nights = weekNights(store, weekStart);
    expect(nights.map((n) => n.who)).toEqual(["me", "partner", "me", "partner", "me", "partner", "me"]);
    expect(nights[0].resting).toBe("partner");
    expect(nights[1].resting).toBe("me");
  });

  it("alternate pattern honours firstOnDuty: partner", () => {
    const store = { pattern: "alternate", startDate: weekStart, firstOnDuty: "partner" };
    const nights = weekNights(store, weekStart);
    expect(nights[0].who).toBe("partner");
  });

  it("split pattern marks every assigned night as shared, with the other as 'second'", () => {
    const store = { pattern: "split", startDate: weekStart, firstOnDuty: "me" };
    const nights = weekNights(store, weekStart);
    expect(nights[0].who).toBe("me");
    expect(nights[0].shared).toBe(true);
    expect(nights[0].second).toBe("partner");
    expect(nights[0].resting).toBeNull(); // shared nights have no one "resting"
  });

  it("an override always wins over the pattern", () => {
    const store = { pattern: "alternate", startDate: weekStart, firstOnDuty: "me", overrides: { "2026-11-02": "open" } };
    const nights = weekNights(store, weekStart);
    expect(nights[0].who).toBe("open");
    expect(nights[1].who).toBe("partner"); // pattern continues unaffected for the rest
  });

  it("a fixed carer's night overrides the pattern and carries their label", () => {
    const store = { pattern: "alternate", startDate: weekStart, firstOnDuty: "me", carerNights: [{ label: "Nanny", days: [2] }] }; // Wed = index 2
    const nights = weekNights(store, weekStart);
    const wed = nights.find((n) => n.date === "2026-11-04");
    expect(wed.who).toBe("other");
    expect(wed.label).toBe("Nanny");
  });

  it("a carer night does not cost either parent a turn (fixed carer nights are skipped from the alternation count)", () => {
    // Carer takes every Wednesday (index 2). The parent alternation should treat that day as
    // a "free" slot that doesn't flip whose turn it is, per parentTurn's intent.
    const store = { pattern: "alternate", startDate: weekStart, firstOnDuty: "me", carerNights: [{ label: "Nanny", days: [2] }] };
    const nights = weekNights(store, weekStart);
    // Mon=me, Tue=partner, Wed=carer (skipped), Thu should continue as if Wed never counted: me
    expect(nights.map((n) => n.who)).toEqual(["me", "partner", "other", "me", "partner", "me", "partner"]);
  });

  it("an accepted swap moves a night to the other person", () => {
    const store = {
      pattern: "alternate", startDate: weekStart, firstOnDuty: "me",
      swaps: [{ date: "2026-11-02", from: "me", status: "accepted" }],
    };
    const nights = weekNights(store, weekStart);
    expect(nights[0].who).toBe("partner"); // otherOf("me")
    expect(nights[0].source).toBe("swap");
  });

  it("an accepted two-way swap also gives the requester the withDate night", () => {
    const store = {
      pattern: "alternate", startDate: weekStart, firstOnDuty: "me",
      swaps: [{ date: "2026-11-02", withDate: "2026-11-03", from: "me", status: "accepted" }],
    };
    const nights = weekNights(store, weekStart);
    expect(nights[0].who).toBe("partner"); // date -> otherOf(from)
    expect(nights[1].who).toBe("me"); // withDate -> from
  });

  it("a pending (not accepted) swap has no effect", () => {
    const store = {
      pattern: "alternate", startDate: weekStart, firstOnDuty: "me",
      swaps: [{ date: "2026-11-02", from: "me", status: "pending" }],
    };
    const nights = weekNights(store, weekStart);
    expect(nights[0].who).toBe("me"); // unaffected
  });
});

describe("restSummary", () => {
  it("counts onDuty nights, longest run and nights off for each person", () => {
    const nights = [
      { who: "me", shared: false }, { who: "me", shared: false }, { who: "partner", shared: false },
      { who: "me", shared: false }, { who: "open" }, { who: "other" }, { who: "partner", shared: false },
    ];
    const s = restSummary(nights);
    expect(s.me.onDuty).toBe(3);
    expect(s.me.longestRun).toBe(2);
    expect(s.partner.onDuty).toBe(2);
    expect(s.shared).toBe(0);
    expect(s.carer).toBe(1);
    expect(s.open).toBe(1);
  });

  it("does not count a shared night toward onDuty for either person", () => {
    const nights = [{ who: "me", shared: true }];
    const s = restSummary(nights);
    expect(s.me.onDuty).toBe(0);
    expect(s.shared).toBe(1);
  });

  it("'off' counts the OTHER person's non-shared nights", () => {
    const nights = [{ who: "me", shared: false }, { who: "partner", shared: false }];
    expect(restSummary(nights).me.off).toBe(1); // partner was on, so "me" was off that night
  });

  it("handles an empty week", () => {
    const s = restSummary([]);
    expect(s).toEqual({ me: { onDuty: 0, longestRun: 0, off: 0 }, partner: { onDuty: 0, longestRun: 0, off: 0 }, shared: 0, carer: 0, open: 0 });
  });
});

describe("suggest", () => {
  const balanced = [
    { date: "2026-11-02", who: "me", shared: false },
    { date: "2026-11-03", who: "partner", shared: false },
    { date: "2026-11-04", who: "me", shared: false },
    { date: "2026-11-05", who: "partner", shared: false },
  ];

  it("says the week is balanced when nothing needs changing", () => {
    expect(suggest(balanced).text).toBe("This week is balanced.");
    expect(suggest(balanced).action).toBeNull();
  });

  it("flags open nights when the week is otherwise balanced", () => {
    const nights = [...balanced, { date: "2026-11-06", who: "open" }];
    expect(suggest(nights).text).toBe("Some nights are still open.");
  });

  it("suggests a single swap when one person has 2+ more nights than the other", () => {
    const nights = [
      { date: "2026-11-02", who: "me", shared: false },
      { date: "2026-11-03", who: "me", shared: false },
      { date: "2026-11-04", who: "me", shared: false },
      { date: "2026-11-05", who: "partner", shared: false },
    ];
    const result = suggest(nights, { me: "Jess", partner: "Pat" });
    expect(result.action.from).toBe("me");
    expect(result.text).toContain("Jess has one more night off");
    expect(result.action.withDate).toBeNull();
  });

  it("does NOT suggest a balancing swap for a 1-night difference", () => {
    const nights = [
      { date: "2026-11-02", who: "me", shared: false },
      { date: "2026-11-03", who: "me", shared: false },
      { date: "2026-11-04", who: "partner", shared: false },
    ];
    // diff is 1, not > 1, so it should fall through to the run-length check / balanced text
    expect(suggest(nights).action).toBeNull();
  });

  it("suggests breaking up a run of 3+ consecutive nights for the same person", () => {
    const nights = [
      { date: "2026-11-02", who: "me", shared: false },
      { date: "2026-11-03", who: "me", shared: false },
      { date: "2026-11-04", who: "me", shared: false },
      { date: "2026-11-05", who: "partner", shared: false },
      { date: "2026-11-06", who: "partner", shared: false },
      { date: "2026-11-07", who: "partner", shared: false },
    ];
    const result = suggest(nights, { me: "Jess", partner: "Pat" });
    expect(result.text).toContain("Jess is on duty 3 nights in a row");
    expect(result.short).toContain("3 nights in a row for Jess");
    expect(result.action).not.toBeNull();
  });

  it("defaults names to 'Me' / 'Your partner' when none are given", () => {
    const nights = [
      { date: "2026-11-02", who: "me", shared: false },
      { date: "2026-11-03", who: "me", shared: false },
      { date: "2026-11-04", who: "me", shared: false },
      { date: "2026-11-05", who: "partner", shared: false },
    ];
    expect(suggest(nights).text).toContain("Me has one more night off");
  });

  it("handles an empty week without throwing", () => {
    expect(() => suggest([])).not.toThrow();
    expect(suggest([]).text).toBe("This week is balanced.");
  });
});

describe("cancelSwap", () => {
  it("removes a pending swap of mine by id", () => {
    const swaps = [{ id: "s1", status: "pending", from: "me" }, { id: "s2", status: "pending", from: "me" }];
    expect(cancelSwap(swaps, "s1").map((s) => s.id)).toEqual(["s2"]);
  });

  it("does not remove a swap that is not pending", () => {
    const swaps = [{ id: "s1", status: "accepted", from: "me" }];
    expect(cancelSwap(swaps, "s1")).toHaveLength(1);
  });

  it("does not remove a swap that is not mine", () => {
    const swaps = [{ id: "s1", status: "pending", from: "partner" }];
    expect(cancelSwap(swaps, "s1")).toHaveLength(1);
  });

  it("does not mutate the input array", () => {
    const swaps = [{ id: "s1", status: "pending", from: "me" }];
    const original = [...swaps];
    cancelSwap(swaps, "s1");
    expect(swaps).toEqual(original);
  });
});

describe("joinNames", () => {
  it("returns '' for an empty list", () => {
    expect(joinNames([])).toBe("");
  });
  it("returns the single name as-is", () => {
    expect(joinNames(["Tiara"])).toBe("Tiara");
  });
  it("joins two names with 'and'", () => {
    expect(joinNames(["Tiara", "Noah"])).toBe("Tiara and Noah");
  });
  it("joins 3+ names with commas and a final 'and'", () => {
    expect(joinNames(["Tiara", "Noah", "Mei"])).toBe("Tiara, Noah and Mei");
  });
  it("filters out falsy entries", () => {
    expect(joinNames(["Tiara", "", null, "Noah"])).toBe("Tiara and Noah");
  });
});
