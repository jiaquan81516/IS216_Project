import { describe, expect, it } from "vitest";
import {
  agendaGroups,
  agendaHeading,
  dateRangeLabel,
  dayHeading,
  eventsOnDay,
  eventTimeLabel,
  formatClock,
  monthGrid,
  monthLabel,
  nightOwner,
  shiftMonth,
  sortDayEvents,
  validateEvent,
  weekdayLabels,
} from "@/app/api/calendarHelpers";

const ev = (over) => ({ id: over.title, title: "E", date: "2026-10-14", endDate: "2026-10-14", allDay: true, start: null, end: null, owner: "both", type: "family", notes: "", ...over });

describe("monthGrid", () => {
  it("always returns 6 weeks of 7 days", () => {
    for (const [y, m] of [[2026, 9], [2027, 1], [2026, 11], [2024, 1]]) {
      const grid = monthGrid(y, m);
      expect(grid).toHaveLength(6);
      expect(grid.every((w) => w.length === 7)).toBe(true);
    }
  });

  it("starts on Monday with leading and trailing days from the next and previous month", () => {
    const grid = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(grid[0].map((d) => d.iso)).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]);
    expect(grid[0].map((d) => d.inMonth)).toEqual([false, false, false, true, true, true, true]);
    const last = grid[5];
    expect(last[0].iso).toBe("2026-11-02");
    expect(last[6].iso).toBe("2026-11-08");
    expect(last.every((d) => !d.inMonth)).toBe(true);
    expect(grid.flat().filter((d) => d.inMonth)).toHaveLength(31);
    expect(grid[2][2]).toEqual({ iso: "2026-10-14", day: 14, inMonth: true });
  });

  it("supports a Sunday start and a month that begins on the first column", () => {
    expect(monthGrid(2026, 9, 0)[0][0].iso).toBe("2026-09-27");
    const feb = monthGrid(2027, 1); // 1 February 2027 is a Monday
    expect(feb[0][0]).toEqual({ iso: "2027-02-01", day: 1, inMonth: true });
    expect(feb[5][0].iso).toBe("2027-03-08");
  });

  it("handles year boundaries", () => {
    const grid = monthGrid(2026, 11);
    expect(grid.flat().at(-1).iso).toBe("2027-01-10");
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("labels", () => {
  it("formats month, day and weekday labels", () => {
    expect(monthLabel(2026, 9)).toBe("October 2026");
    expect(dayHeading("2026-10-14")).toBe("Wednesday 14 October");
    expect(weekdayLabels()).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(weekdayLabels(0)[0]).toBe("Sun");
    expect(agendaHeading("2026-10-14", "2026-10-14")).toBe("Today");
    expect(agendaHeading("2026-10-15", "2026-10-14")).toBe("Tomorrow");
    expect(agendaHeading("2026-10-17", "2026-10-14")).toBe("Sat 17 October");
    expect(dateRangeLabel("2026-10-14", "2026-10-16")).toBe("14 to 16 October");
    expect(dateRangeLabel("2026-10-30", "2026-11-02")).toBe("30 October to 2 November");
    expect(formatClock("14:30")).toBe("2:30 PM");
    expect(formatClock("00:05")).toBe("12:05 AM");
    expect(formatClock("")).toBe("");
    expect(eventTimeLabel(ev({ allDay: false, start: "09:00", end: "10:30" }))).toBe("9:00 AM to 10:30 AM");
    expect(eventTimeLabel(ev({ allDay: false, start: "09:00" }))).toBe("9:00 AM");
    expect(eventTimeLabel(ev({}))).toBe("All day");
  });
});

describe("events on a day", () => {
  const events = [
    ev({ title: "Single", date: "2026-10-14", endDate: "2026-10-14" }),
    ev({ title: "Span", date: "2026-10-13", endDate: "2026-10-15" }),
    ev({ title: "Other", date: "2026-10-20", endDate: "2026-10-20" }),
    { id: "x", title: "No end", date: "2026-10-14", allDay: true },
  ];

  it("includes multi-day events on every covered day", () => {
    expect(eventsOnDay(events, "2026-10-12").map((e) => e.title)).toEqual([]);
    expect(eventsOnDay(events, "2026-10-13").map((e) => e.title)).toEqual(["Span"]);
    expect(eventsOnDay(events, "2026-10-14").map((e) => e.title)).toEqual(["Single", "Span", "No end"]);
    expect(eventsOnDay(events, "2026-10-15").map((e) => e.title)).toEqual(["Span"]);
    expect(eventsOnDay(events, "2026-10-16")).toEqual([]);
  });

  it("sorts all day first, then by time, then by title, without mutating", () => {
    const list = [
      ev({ title: "Late", allDay: false, start: "15:00" }),
      ev({ title: "Early", allDay: false, start: "08:00" }),
      ev({ title: "B day" }),
      ev({ title: "A day" }),
    ];
    expect(sortDayEvents(list).map((e) => e.title)).toEqual(["A day", "B day", "Early", "Late"]);
    expect(list[0].title).toBe("Late");
  });
});

describe("agendaGroups", () => {
  it("groups upcoming events by date and skips past ones", () => {
    const events = [
      ev({ title: "Past", date: "2026-10-01", endDate: "2026-10-01" }),
      ev({ title: "Later", date: "2026-10-20", endDate: "2026-10-20" }),
      ev({ title: "Timed", date: "2026-10-14", endDate: "2026-10-14", allDay: false, start: "10:00" }),
      ev({ title: "All day", date: "2026-10-14", endDate: "2026-10-14" }),
      ev({ title: "Running", date: "2026-10-12", endDate: "2026-10-16" }),
    ];
    const groups = agendaGroups(events, "2026-10-14");
    expect(groups.map((g) => g.date)).toEqual(["2026-10-14", "2026-10-20"]);
    expect(groups[0].events.map((e) => e.title)).toEqual(["All day", "Running", "Timed"]);
    expect(agendaGroups([], "2026-10-14")).toEqual([]);
  });
});

describe("validateEvent", () => {
  const ok = { title: "Checkup", date: "2026-10-14", endDate: "2026-10-14", allDay: false, start: "09:00", end: "10:00" };
  it("accepts a good draft", () => {
    expect(validateEvent(ok)).toBe("");
    expect(validateEvent({ ...ok, allDay: true, start: "", end: "" })).toBe("");
    expect(validateEvent({ ...ok, end: "" })).toBe("");
  });
  it("explains each problem", () => {
    expect(validateEvent({ ...ok, title: "  " })).toBe("Add a title for the event.");
    expect(validateEvent({ ...ok, end: "09:00" })).toBe("End time must be after start time.");
    expect(validateEvent({ ...ok, end: "08:00" })).toBe("End time must be after start time.");
    expect(validateEvent({ ...ok, endDate: "2026-10-13" })).toBe("End date must be on or after the start date.");
    expect(validateEvent({ ...ok, start: "" })).toBe("Add a start time.");
  });
  it("allows an earlier end time on a later day", () => {
    expect(validateEvent({ ...ok, endDate: "2026-10-15", end: "08:00" })).toBe("");
  });
});

describe("nightOwner", () => {
  const rota = { pattern: "alternate", firstOnDuty: "me", startDate: "2026-10-12", overrides: {}, swaps: [] };
  it("follows the rota pattern", () => {
    expect(nightOwner(rota, "2026-10-12")).toEqual({ who: "me", shared: false, second: null });
    expect(nightOwner(rota, "2026-10-13").who).toBe("partner");
    expect(nightOwner(rota, "2026-10-14").who).toBe("me");
    expect(nightOwner({ ...rota, firstOnDuty: "partner" }, "2026-10-12").who).toBe("partner");
  });
  it("reports shared, open and overridden nights", () => {
    expect(nightOwner({ ...rota, pattern: "split" }, "2026-10-12")).toEqual({ who: "me", shared: true, second: "partner" });
    expect(nightOwner({ ...rota, pattern: "manual" }, "2026-10-12").who).toBe("open");
    expect(nightOwner({ ...rota, overrides: { "2026-10-12": "partner" } }, "2026-10-12").who).toBe("partner");
  });
  it("applies accepted swaps", () => {
    const swapped = { ...rota, swaps: [{ id: "s", date: "2026-10-12", withDate: null, from: "me", status: "accepted" }] };
    expect(nightOwner(swapped, "2026-10-12").who).toBe("partner");
  });
});
