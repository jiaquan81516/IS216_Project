import { describe, it, expect } from "vitest";
import {
  DAY_START, DAY_END, toMinutes, toHhmm, weekdayIndex, makeShiftId,
  cleanShifts, applyShift, removeShift, coverFor, fromHourCells,
} from "@/app/utils/scheduleHelpers";

describe("constants", () => {
  it("DAY_START/DAY_END are 6 AM and 6 PM in minutes", () => {
    expect(DAY_START).toBe(360);
    expect(DAY_END).toBe(1080);
  });
});

describe("toMinutes / toHhmm round-trip", () => {
  it("converts zero-padded HH:mm to minutes", () => {
    expect(toMinutes("08:30")).toBe(510);
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("rejects an unpadded hour or malformed string", () => {
    expect(toMinutes("8:30")).toBeNull();
    expect(toMinutes("8:3")).toBeNull();
    expect(toMinutes("bad")).toBeNull();
    expect(toMinutes(null)).toBeNull();
    expect(toMinutes(undefined)).toBeNull();
  });

  it("rejects an out-of-range hour or minute", () => {
    expect(toMinutes("24:00")).toBeNull();
    expect(toMinutes("12:60")).toBeNull();
  });

  it("toHhmm formats minutes back to zero-padded HH:mm", () => {
    expect(toHhmm(510)).toBe("08:30");
    expect(toHhmm(0)).toBe("00:00");
    expect(toHhmm(1439)).toBe("23:59");
  });

  it("round-trips HH:mm -> minutes -> HH:mm", () => {
    expect(toHhmm(toMinutes("14:05"))).toBe("14:05");
  });
});

describe("weekdayIndex", () => {
  it("Monday is 0 and Sunday is 6", () => {
    expect(weekdayIndex(new Date(2026, 10, 2))).toBe(0); // Mon
    expect(weekdayIndex(new Date(2026, 10, 8))).toBe(6); // Sun
  });
});

describe("makeShiftId", () => {
  it("returns a non-empty string prefixed with 'sh-'", () => {
    expect(makeShiftId()).toMatch(/^sh-/);
  });
  it("returns a different id on successive calls", () => {
    expect(makeShiftId()).not.toBe(makeShiftId());
  });
});

describe("cleanShifts", () => {
  it("keeps a well-formed shift and fills in a missing id", () => {
    const [out] = cleanShifts([{ day: 0, start: 360, end: 420, who: "me" }]);
    expect(out.day).toBe(0);
    expect(out.start).toBe(360);
    expect(out.end).toBe(420);
    expect(out.who).toBe("me");
    expect(out.id).toMatch(/^sh-/);
  });

  it("keeps an explicit string id", () => {
    const [out] = cleanShifts([{ id: "custom-1", day: 0, start: 360, end: 420, who: "me" }]);
    expect(out.id).toBe("custom-1");
  });

  it("accepts HH:mm strings for start/end", () => {
    const [out] = cleanShifts([{ day: 0, start: "06:00", end: "07:00", who: "me" }]);
    expect(out.start).toBe(360);
    expect(out.end).toBe(420);
  });

  it("drops a shift with an invalid day", () => {
    expect(cleanShifts([{ day: 7, start: 360, end: 420, who: "me" }])).toEqual([]);
    expect(cleanShifts([{ day: -1, start: 360, end: 420, who: "me" }])).toEqual([]);
    expect(cleanShifts([{ day: "x", start: 360, end: 420, who: "me" }])).toEqual([]);
  });

  it("drops a shift where end <= start", () => {
    expect(cleanShifts([{ day: 0, start: 420, end: 420, who: "me" }])).toEqual([]);
    expect(cleanShifts([{ day: 0, start: 420, end: 360, who: "me" }])).toEqual([]);
  });

  it("drops a shift with an unrecognised 'who'", () => {
    expect(cleanShifts([{ day: 0, start: 360, end: 420, who: "nanny" }])).toEqual([]);
    expect(cleanShifts([{ day: 0, start: 360, end: 420 }])).toEqual([]);
  });

  it("gives 'other' shifts a label, defaulting to 'Someone else'", () => {
    expect(cleanShifts([{ day: 0, start: 360, end: 420, who: "other", label: "Nanny" }])[0].label).toBe("Nanny");
    expect(cleanShifts([{ day: 0, start: 360, end: 420, who: "other" }])[0].label).toBe("Someone else");
  });

  it("truncates an 'other' label to 30 characters", () => {
    const label = "x".repeat(50);
    expect(cleanShifts([{ day: 0, start: 360, end: 420, who: "other", label }])[0].label).toHaveLength(30);
  });

  it("clears the label for non-'other' kinds even if one was supplied", () => {
    expect(cleanShifts([{ day: 0, start: 360, end: 420, who: "me", label: "Should be ignored" }])[0].label).toBe("");
  });

  it("sorts by day then start time", () => {
    const out = cleanShifts([
      { day: 1, start: 600, end: 660, who: "me" },
      { day: 0, start: 600, end: 660, who: "me" },
      { day: 0, start: 360, end: 420, who: "partner" },
    ]);
    expect(out.map((s) => `${s.day}-${s.start}`)).toEqual(["0-360", "0-600", "1-600"]);
  });

  it("returns [] for a non-array", () => {
    expect(cleanShifts(null)).toEqual([]);
    expect(cleanShifts(undefined)).toEqual([]);
    expect(cleanShifts("x")).toEqual([]);
  });
});

describe("removeShift", () => {
  it("removes the shift with the given id", () => {
    const list = [{ id: "a" }, { id: "b" }];
    expect(removeShift(list, "a")).toEqual([{ id: "b" }]);
  });
  it("is a no-op if the id is not present", () => {
    const list = [{ id: "a" }];
    expect(removeShift(list, "z")).toEqual(list);
  });
});

describe("applyShift", () => {
  it("adds a new shift on a day with nothing else", () => {
    const out = applyShift([], { days: [0], start: 360, end: 420, who: "me" });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ day: 0, start: 360, end: 420, who: "me" });
  });

  it("adds the same shift to multiple days at once", () => {
    const out = applyShift([], { days: [0, 2, 4], start: 360, end: 420, who: "me" });
    expect(out.map((s) => s.day)).toEqual([0, 2, 4]);
  });

  it("leaves shifts on other days untouched", () => {
    const existing = [{ id: "x", day: 1, start: 360, end: 420, who: "partner" }];
    const out = applyShift(existing, { days: [0], start: 600, end: 660, who: "me" });
    expect(out.find((s) => s.day === 1)).toMatchObject({ day: 1, start: 360, end: 420, who: "partner" });
  });

  it("completely replaces a shift that is fully covered by the new one", () => {
    const existing = [{ id: "x", day: 0, start: 400, end: 410, who: "partner" }];
    const out = applyShift(existing, { days: [0], start: 360, end: 420, who: "me" });
    expect(out).toHaveLength(1);
    expect(out[0].who).toBe("me");
  });

  it("trims the end of a shift that starts before and overlaps the start of the new one", () => {
    const existing = [{ id: "x", day: 0, start: 360, end: 450, who: "partner" }];
    const out = applyShift(existing, { days: [0], start: 420, end: 480, who: "me" });
    const trimmed = out.find((s) => s.who === "partner");
    expect(trimmed).toMatchObject({ id: "x", start: 360, end: 420 });
  });

  it("trims the start of a shift that overlaps the end of the new one", () => {
    const existing = [{ id: "x", day: 0, start: 450, end: 540, who: "partner" }];
    const out = applyShift(existing, { days: [0], start: 420, end: 480, who: "me" });
    const trimmed = out.find((s) => s.who === "partner");
    expect(trimmed).toMatchObject({ start: 480, end: 540 });
  });

  it("splits a shift that fully contains the new one into two fragments with distinct ids", () => {
    const existing = [{ id: "x", day: 0, start: 360, end: 600, who: "partner" }];
    const out = applyShift(existing, { days: [0], start: 420, end: 480, who: "me" });
    const fragments = out.filter((s) => s.who === "partner");
    expect(fragments).toHaveLength(2);
    expect(fragments.map((f) => [f.start, f.end]).sort((a, b) => a[0] - b[0])).toEqual([[360, 420], [480, 600]]);
    expect(new Set(fragments.map((f) => f.id)).size).toBe(2);
  });

  it("does not touch a shift that doesn't overlap at all", () => {
    const existing = [{ id: "x", day: 0, start: 360, end: 420, who: "partner" }];
    const out = applyShift(existing, { days: [0], start: 600, end: 660, who: "me" });
    expect(out.find((s) => s.id === "x")).toMatchObject({ start: 360, end: 420 });
  });

  it("lets the new shift share an edge (back-to-back) without overlap", () => {
    const existing = [{ id: "x", day: 0, start: 360, end: 420, who: "partner" }];
    const out = applyShift(existing, { days: [0], start: 420, end: 480, who: "me" });
    expect(out).toHaveLength(2);
    expect(out.find((s) => s.id === "x").end).toBe(420);
  });

  it("replaces the shift named by replaceId (editing) instead of layering on top of it", () => {
    const existing = [{ id: "x", day: 0, start: 360, end: 420, who: "me" }];
    const out = applyShift(existing, { days: [0], start: 360, end: 480, who: "partner" }, "x");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ start: 360, end: 480, who: "partner" });
  });

  it("gives an 'other' shift a label, defaulting sensibly", () => {
    const out = applyShift([], { days: [0], start: 360, end: 420, who: "other", label: "Nanny" });
    expect(out[0].label).toBe("Nanny");
    const out2 = applyShift([], { days: [0], start: 360, end: 420, who: "other" });
    expect(out2[0].label).toBe("Someone else");
  });
});

describe("coverFor", () => {
  it("returns an hour's cover from the shift covering its half-hour mark", () => {
    const shifts = [{ day: 0, start: 360, end: 720, who: "me", label: "" }];
    const cells = coverFor(shifts, 0);
    expect(cells).toHaveLength(24);
    expect(cells[6]).toEqual({ who: "me", label: "" }); // 6-7am covered
    expect(cells[11]).toEqual({ who: "me", label: "" }); // 11-12 covered (shift ends at 12:00)
    expect(cells[12]).toBeNull(); // shift ended exactly at the 12:30 mid-point check boundary
    expect(cells[5]).toBeNull();
  });

  it("returns all null for a day with no shifts", () => {
    expect(coverFor([], 3).every((c) => c === null)).toBe(true);
  });

  it("only looks at shifts for the given day", () => {
    const shifts = [{ day: 1, start: 360, end: 420, who: "me", label: "" }];
    expect(coverFor(shifts, 0).every((c) => c === null)).toBe(true);
  });
});

describe("fromHourCells", () => {
  it("turns a run of identical cells into one shift, applied to every weekday", () => {
    const cells = Array(24).fill(null);
    for (let h = 6; h < 12; h += 1) cells[h] = { who: "me", label: "" };
    const shifts = fromHourCells(cells);
    expect(shifts).toHaveLength(7); // one per weekday
    expect(shifts.every((s) => s.start === 360 && s.end === 720 && s.who === "me")).toBe(true);
    expect(new Set(shifts.map((s) => s.day))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]));
  });

  it("splits a run when the label changes even with the same who", () => {
    const cells = Array(24).fill(null);
    cells[6] = { who: "other", label: "Nanny" };
    cells[7] = { who: "other", label: "Helper" };
    const shifts = fromHourCells(cells).filter((s) => s.day === 0);
    expect(shifts).toHaveLength(2);
    expect(shifts[0].label).toBe("Nanny");
    expect(shifts[1].label).toBe("Helper");
  });

  it("skips null/unknown cells", () => {
    const cells = Array(24).fill(null);
    cells[6] = { who: "bogus" };
    expect(fromHourCells(cells)).toEqual([]);
  });

  it("returns [] for a non-array", () => {
    expect(fromHourCells(null)).toEqual([]);
    expect(fromHourCells(undefined)).toEqual([]);
  });

  it("returns [] for an all-empty day", () => {
    expect(fromHourCells(Array(24).fill(null))).toEqual([]);
  });
});
