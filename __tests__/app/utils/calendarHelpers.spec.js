import { describe, it, expect } from "vitest";
import {
  EVENT_TYPES, NOTES_MAX,
  weekdayLabels, monthGrid, shiftMonth, monthLabel, dayHeading, agendaHeading,
  dateRangeLabel, formatClock, lastDay, eventsOnDay, sortDayEvents, agendaGroups,
  eventTimeLabel, validateEvent, nightOwner, weekStartOf, weekDays, toMinutes,
  isBarEvent, layoutWeekEvents, dayBlocks,
} from "@/app/utils/calendarHelpers";

describe("constants", () => {
  it("exposes the 3 event types and a notes cap", () => {
    expect(EVENT_TYPES.map((t) => t.value)).toEqual(["appointment", "family", "work"]);
    expect(NOTES_MAX).toBe(280);
  });
});

describe("weekdayLabels", () => {
  it("defaults to starting Monday", () => {
    expect(weekdayLabels()).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });
  it("starts from Sunday when asked", () => {
    expect(weekdayLabels(0)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });
});

describe("monthGrid", () => {
  it("builds 6 weeks of 7 days, starting the Monday on/before the 1st", () => {
    // Jan 1 2026 is a Thursday
    const grid = monthGrid(2026, 0, 1);
    expect(grid).toHaveLength(6);
    expect(grid[0]).toHaveLength(7);
    expect(grid[0][0].iso).toBe("2025-12-29"); // Monday before Jan 1
    expect(grid[0][0].inMonth).toBe(false);
    expect(grid[0][3].iso).toBe("2026-01-01");
    expect(grid[0][3].inMonth).toBe(true);
  });

  it("starts the grid on Sunday when weekStartsOn is 0", () => {
    const grid = monthGrid(2026, 0, 0);
    expect(grid[0][0].iso).toBe("2025-12-28"); // Sunday before Jan 1
  });

  it("marks only days in the target month/year as inMonth", () => {
    const grid = monthGrid(2026, 1, 1); // February 2026 (28 days, not a leap year)
    const flat = grid.flat();
    const inMonthDays = flat.filter((d) => d.inMonth);
    expect(inMonthDays).toHaveLength(28);
    expect(inMonthDays[0].iso).toBe("2026-02-01");
    expect(inMonthDays.at(-1).iso).toBe("2026-02-28");
  });
});

describe("shiftMonth", () => {
  it("moves forward within a year", () => {
    expect(shiftMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });
  });
  it("rolls over into the next year", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });
  it("rolls back into the previous year", () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
  it("supports jumps of more than one month", () => {
    expect(shiftMonth(2026, 0, 13)).toEqual({ year: 2027, month: 1 });
  });
});

describe("monthLabel / dayHeading", () => {
  it("formats a month and year", () => {
    expect(monthLabel(2026, 9)).toBe("October 2026");
  });
  it("formats a full weekday heading", () => {
    // 2026-10-14 is a Wednesday
    expect(dayHeading("2026-10-14")).toBe("Wednesday 14 October");
  });
});

describe("agendaHeading", () => {
  it("says Today for the given today", () => {
    expect(agendaHeading("2026-10-14", "2026-10-14")).toBe("Today");
  });
  it("says Tomorrow for the day right after today", () => {
    expect(agendaHeading("2026-10-15", "2026-10-14")).toBe("Tomorrow");
  });
  it("falls back to a short weekday heading otherwise", () => {
    expect(agendaHeading("2026-10-20", "2026-10-14")).toBe("Tue 20 October");
  });
});

describe("dateRangeLabel", () => {
  it("formats a single day", () => {
    expect(dateRangeLabel("2026-10-14", "2026-10-14")).toBe("14 October");
  });
  it("formats a range within the same month", () => {
    expect(dateRangeLabel("2026-10-14", "2026-10-16")).toBe("14 to 16 October");
  });
  it("formats a range crossing months", () => {
    expect(dateRangeLabel("2026-10-30", "2026-11-02")).toBe("30 October to 2 November");
  });
});

describe("formatClock", () => {
  it("formats morning and afternoon times", () => {
    expect(formatClock("09:05")).toBe("9:05 AM");
    expect(formatClock("14:30")).toBe("2:30 PM");
  });
  it("formats midnight and noon as 12", () => {
    expect(formatClock("00:00")).toBe("12:00 AM");
    expect(formatClock("12:00")).toBe("12:00 PM");
  });
  it("returns '' for malformed or missing input", () => {
    expect(formatClock("")).toBe("");
    expect(formatClock(null)).toBe("");
    expect(formatClock(undefined)).toBe("");
    expect(formatClock("9:30")).toBe("");
  });
  it("returns '' for an impossible hour", () => {
    expect(formatClock("24:00")).toBe("");
    expect(formatClock("99:00")).toBe("");
  });
});

describe("lastDay / isBarEvent", () => {
  it("lastDay falls back to date when endDate is absent", () => {
    expect(lastDay({ date: "2026-10-14" })).toBe("2026-10-14");
    expect(lastDay({ date: "2026-10-14", endDate: "2026-10-16" })).toBe("2026-10-16");
  });
  it("treats all-day and multi-day events as bars", () => {
    expect(isBarEvent({ date: "2026-10-14", allDay: true })).toBe(true);
    expect(isBarEvent({ date: "2026-10-14", endDate: "2026-10-16", start: "09:00" })).toBe(true);
    expect(isBarEvent({ date: "2026-10-14" })).toBe(true); // no start -> bar
  });
  it("treats a timed single-day event as a row, not a bar", () => {
    expect(isBarEvent({ date: "2026-10-14", start: "09:00" })).toBe(false);
  });
});

describe("eventsOnDay", () => {
  const events = [
    { date: "2026-10-14" },
    { date: "2026-10-12", endDate: "2026-10-16" },
    { date: "2026-10-20" },
  ];
  it("includes events that start, span, or just cover the day", () => {
    expect(eventsOnDay(events, "2026-10-14").map((e) => e.date)).toEqual(["2026-10-14", "2026-10-12"]);
  });
  it("excludes events entirely before or after the day", () => {
    expect(eventsOnDay(events, "2026-10-01")).toEqual([]);
  });
});

describe("sortDayEvents", () => {
  it("puts all-day/no-start events first, then sorts by start time, then title", () => {
    const list = [
      { title: "Lunch", start: "12:00" },
      { title: "All day thing", allDay: true },
      { title: "Early", start: "08:00" },
      { title: "Beta", start: "08:00" },
    ];
    const out = sortDayEvents(list);
    expect(out.map((e) => e.title)).toEqual(["All day thing", "Beta", "Early", "Lunch"]);
  });
  it("does not mutate the input array", () => {
    const list = [{ title: "B", start: "10:00" }, { title: "A", start: "09:00" }];
    const copy = [...list];
    sortDayEvents(list);
    expect(list).toEqual(copy);
  });
});

describe("agendaGroups", () => {
  it("groups future events by date, in date order", () => {
    const events = [
      { date: "2026-10-16", title: "Later" },
      { date: "2026-10-14", title: "Today item" },
      { date: "2026-10-01", title: "Past" },
    ];
    const groups = agendaGroups(events, "2026-10-14");
    expect(groups.map((g) => g.date)).toEqual(["2026-10-14", "2026-10-16"]);
    expect(groups[0].events.map((e) => e.title)).toEqual(["Today item"]);
  });
  it("lists a still-running multi-day event under fromIso even if it started earlier", () => {
    const events = [{ date: "2026-10-10", endDate: "2026-10-20", title: "Trip" }];
    const groups = agendaGroups(events, "2026-10-14");
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe("2026-10-14");
  });
  it("excludes events that have fully ended before fromIso", () => {
    const events = [{ date: "2026-10-01", endDate: "2026-10-05", title: "Old" }];
    expect(agendaGroups(events, "2026-10-14")).toEqual([]);
  });
});

describe("eventTimeLabel", () => {
  it("says All day for all-day or startless events", () => {
    expect(eventTimeLabel({ allDay: true })).toBe("All day");
    expect(eventTimeLabel({})).toBe("All day");
  });
  it("shows just the start time when there's no end", () => {
    expect(eventTimeLabel({ start: "09:00" })).toBe("9:00 AM");
  });
  it("shows a start-to-end range", () => {
    expect(eventTimeLabel({ start: "09:00", end: "10:30" })).toBe("9:00 AM to 10:30 AM");
  });
});

describe("validateEvent", () => {
  const base = { title: "Checkup", date: "2026-10-14", allDay: true };

  it("requires a title", () => {
    expect(validateEvent({ ...base, title: "  " })).toMatch(/title/i);
  });
  it("requires a valid start date", () => {
    expect(validateEvent({ ...base, date: "" })).toMatch(/start date/i);
    expect(validateEvent({ ...base, date: "2026-13-01" })).toMatch(/start date/i);
  });
  it("requires the end date on/after the start date", () => {
    expect(validateEvent({ ...base, endDate: "2026-10-13" })).toMatch(/end date/i);
    expect(validateEvent({ ...base, endDate: "not-a-date" })).toMatch(/end date/i);
  });
  it("accepts an all-day event with no times", () => {
    expect(validateEvent(base)).toBe("");
  });
  it("requires a start time for a non-all-day event", () => {
    expect(validateEvent({ ...base, allDay: false })).toMatch(/start time/i);
  });
  it("requires the end time after the start time on a single day", () => {
    expect(validateEvent({ ...base, allDay: false, start: "10:00", end: "09:00" })).toMatch(/end time/i);
    expect(validateEvent({ ...base, allDay: false, start: "10:00", end: "10:00" })).toMatch(/end time/i);
  });
  it("accepts a valid timed event", () => {
    expect(validateEvent({ ...base, allDay: false, start: "09:00", end: "10:00" })).toBe("");
  });
  it("does not check end<=start across different days", () => {
    expect(validateEvent({
      ...base, allDay: false, endDate: "2026-10-15", start: "20:00", end: "06:00",
    })).toBe("");
  });
});

describe("nightOwner", () => {
  it("reports who is on duty for the given night", () => {
    const store = { pattern: "alternate", firstOnDuty: "me", startDate: "2026-10-12", overrides: {}, swaps: [] };
    const owner = nightOwner(store, "2026-10-12");
    expect(owner.who).toBe("me");
    expect(owner.label).toBe("");
  });
  it("reflects an override", () => {
    const store = { pattern: "manual", startDate: "2026-10-12", overrides: { "2026-10-12": "partner" }, swaps: [] };
    expect(nightOwner(store, "2026-10-12").who).toBe("partner");
  });
});

describe("weekStartOf / weekDays", () => {
  it("finds the Monday on/before the given date", () => {
    expect(weekStartOf("2026-10-14")).toBe("2026-10-12"); // Wed -> Mon
  });
  it("finds the Sunday on/before the given date when weekStartsOn is 0", () => {
    expect(weekStartOf("2026-10-14", 0)).toBe("2026-10-11");
  });
  it("returns the date itself if it's already the week start", () => {
    expect(weekStartOf("2026-10-12")).toBe("2026-10-12");
  });
  it("lists 7 consecutive ISO days", () => {
    expect(weekDays("2026-10-12")).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
  });
});

describe("toMinutes", () => {
  it("parses HH:MM into minutes since midnight", () => {
    expect(toMinutes("14:30")).toBe(870);
    expect(toMinutes("00:00")).toBe(0);
  });
  it("returns 0 for malformed or missing input", () => {
    expect(toMinutes("")).toBe(0);
    expect(toMinutes(null)).toBe(0);
    expect(toMinutes("bad")).toBe(0);
  });
});

describe("layoutWeekEvents", () => {
  const week = weekDays("2026-10-12"); // Mon..Sun

  it("places a bar event spanning part of the week with the correct start/end/span", () => {
    const events = [{ date: "2026-10-13", endDate: "2026-10-15", allDay: true, title: "Trip" }];
    const { items, laneCount } = layoutWeekEvents(events, week);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ start: 1, end: 3, span: 3, lane: 0 });
    expect(laneCount).toBe(1);
  });

  it("marks continuation flags for events that overflow the week on either side", () => {
    const events = [{ date: "2026-10-10", endDate: "2026-10-20", allDay: true, title: "Long" }];
    const { items } = layoutWeekEvents(events, week);
    expect(items[0]).toMatchObject({ start: 0, end: 6, contLeft: true, contRight: true });
  });

  it("assigns overlapping bar events to different lanes", () => {
    const events = [
      { date: "2026-10-12", endDate: "2026-10-14", allDay: true, title: "A" },
      { date: "2026-10-13", endDate: "2026-10-15", allDay: true, title: "B" },
    ];
    const { items, laneCount } = layoutWeekEvents(events, week);
    expect(items.map((i) => i.lane).sort()).toEqual([0, 1]);
    expect(laneCount).toBe(2);
  });

  it("reuses a lane once it frees up (non-overlapping events on different days)", () => {
    const events = [
      { date: "2026-10-12", title: "A", allDay: true },
      { date: "2026-10-14", title: "B", allDay: true },
    ];
    const { items } = layoutWeekEvents(events, week);
    expect(items.every((i) => i.lane === 0)).toBe(true);
  });

  it("puts bar events before timed events, and longer spans before shorter ones at the same start", () => {
    const events = [
      { date: "2026-10-12", start: "09:00", title: "Timed" },
      { date: "2026-10-12", endDate: "2026-10-13", allDay: true, title: "Short bar" },
      { date: "2026-10-12", endDate: "2026-10-14", allDay: true, title: "Long bar" },
    ];
    const { items } = layoutWeekEvents(events, week);
    expect(items.map((i) => i.event.title)).toEqual(["Long bar", "Short bar", "Timed"]);
  });

  it("hides items beyond maxLanes and counts them per day", () => {
    const events = Array.from({ length: 5 }, (_, i) => ({ date: "2026-10-12", allDay: true, title: `E${i}` }));
    const { items, hidden, laneCount } = layoutWeekEvents(events, week, 3);
    expect(items).toHaveLength(3);
    expect(laneCount).toBe(3);
    expect(hidden[0]).toBe(2);
    expect(hidden[1]).toBe(0);
  });

  it("excludes events entirely outside the week", () => {
    const events = [{ date: "2026-09-01", endDate: "2026-09-05", allDay: true, title: "Old" }];
    expect(layoutWeekEvents(events, week).items).toEqual([]);
  });
});

describe("dayBlocks", () => {
  it("ignores all-day and other-day events", () => {
    const events = [
      { date: "2026-10-14", allDay: true, start: "09:00" },
      { date: "2026-10-15", start: "09:00" },
    ];
    expect(dayBlocks(events, "2026-10-14")).toEqual([]);
  });

  it("gives a single event column 0 of 1", () => {
    const events = [{ date: "2026-10-14", start: "09:00", end: "10:00" }];
    const [block] = dayBlocks(events, "2026-10-14");
    expect(block).toMatchObject({ startMin: 540, endMin: 600, col: 0, cols: 1 });
  });

  it("defaults a missing end time to 60 minutes after start", () => {
    const events = [{ date: "2026-10-14", start: "09:00" }];
    const [block] = dayBlocks(events, "2026-10-14");
    expect(block.endMin).toBe(600);
  });

  it("enforces a minimum 30-minute duration", () => {
    const events = [{ date: "2026-10-14", start: "09:00", end: "09:05" }];
    const [block] = dayBlocks(events, "2026-10-14");
    expect(block.endMin).toBe(570);
  });

  it("caps the end time at 1440 (midnight)", () => {
    const events = [{ date: "2026-10-14", start: "23:50", end: "23:55" }];
    const [block] = dayBlocks(events, "2026-10-14");
    // 23:50 = 1430, +30 min minimum = 1460, capped to 1440
    expect(block.endMin).toBe(1440);
  });

  it("splits two overlapping events into side-by-side columns", () => {
    const events = [
      { date: "2026-10-14", start: "09:00", end: "10:00", title: "A" },
      { date: "2026-10-14", start: "09:30", end: "10:30", title: "B" },
    ];
    const blocks = dayBlocks(events, "2026-10-14");
    const a = blocks.find((b) => b.event.title === "A");
    const b = blocks.find((b) => b.event.title === "B");
    expect(a.col).toBe(0);
    expect(b.col).toBe(1);
    expect(a.cols).toBe(2);
    expect(b.cols).toBe(2);
  });

  it("gives back-to-back (touching, not overlapping) events their own single-column clusters", () => {
    const events = [
      { date: "2026-10-14", start: "09:00", end: "10:00", title: "A" },
      { date: "2026-10-14", start: "10:00", end: "11:00", title: "B" },
    ];
    const blocks = dayBlocks(events, "2026-10-14");
    expect(blocks.every((b) => b.col === 0 && b.cols === 1)).toBe(true);
  });

  it("reuses a freed column within the same cluster", () => {
    // A: 09:00-10:00 (col 0), B: 09:15-09:45 (col 1), C: 09:45-10:15 (should reuse col 1, B ended)
    const events = [
      { date: "2026-10-14", start: "09:00", end: "10:00", title: "A" },
      { date: "2026-10-14", start: "09:15", end: "09:45", title: "B" },
      { date: "2026-10-14", start: "09:45", end: "10:15", title: "C" },
    ];
    const blocks = dayBlocks(events, "2026-10-14");
    const byTitle = Object.fromEntries(blocks.map((b) => [b.event.title, b]));
    expect(byTitle.A.col).toBe(0);
    expect(byTitle.B.col).toBe(1);
    expect(byTitle.C.col).toBe(1);
    expect(byTitle.A.cols).toBe(2);
  });

  it("starts a fresh cluster (and column count) once a gap closes the previous one", () => {
    const events = [
      { date: "2026-10-14", start: "09:00", end: "09:30", title: "A" },
      { date: "2026-10-14", start: "09:00", end: "09:30", title: "B" }, // overlaps A: cluster cols=2
      { date: "2026-10-14", start: "11:00", end: "11:30", title: "C" }, // separate cluster
    ];
    const blocks = dayBlocks(events, "2026-10-14");
    const byTitle = Object.fromEntries(blocks.map((b) => [b.event.title, b]));
    expect(byTitle.A.cols).toBe(2);
    expect(byTitle.B.cols).toBe(2);
    expect(byTitle.C.cols).toBe(1);
    expect(byTitle.C.col).toBe(0);
  });
});
