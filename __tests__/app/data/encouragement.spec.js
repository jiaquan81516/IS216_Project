import { describe, it, expect } from "vitest";
import { isNight, encouragementFor } from "@/app/data/encouragement";

describe("isNight", () => {
  it("is night from 10 PM to just before 5 AM", () => {
    expect(isNight(new Date(2026, 9, 14, 21, 0, 0))).toBe(false);
    expect(isNight(new Date(2026, 9, 14, 22, 0, 0))).toBe(true);
    expect(isNight(new Date(2026, 9, 14, 23, 59, 0))).toBe(true);
    expect(isNight(new Date(2026, 9, 14, 0, 0, 0))).toBe(true);
    expect(isNight(new Date(2026, 9, 14, 4, 59, 0))).toBe(true);
    expect(isNight(new Date(2026, 9, 14, 5, 0, 0))).toBe(false);
    expect(isNight(new Date(2026, 9, 14, 12, 0, 0))).toBe(false);
  });
});

describe("encouragementFor", () => {
  it("returns the documented line for a known day/time", () => {
    expect(encouragementFor(new Date(2026, 9, 14, 12, 0, 0)))
      .toBe("You are not behind. There is no schedule you are meant to be keeping up with.");
  });
  it("is deterministic for the same date", () => {
    const a = encouragementFor(new Date(2026, 9, 14, 9, 0, 0));
    const b = encouragementFor(new Date(2026, 9, 14, 17, 0, 0));
    expect(a).toBe(b);
  });
  it("picks from the night set late at night, a different line than daytime", () => {
    const day = encouragementFor(new Date(2026, 9, 14, 12, 0, 0));
    const night = encouragementFor(new Date(2026, 9, 14, 23, 0, 0));
    expect(day).not.toBe(night);
  });
  it("always returns a non-empty string", () => {
    for (let h = 0; h < 24; h += 1) {
      expect(encouragementFor(new Date(2026, 9, 14, h, 0, 0))).toBeTruthy();
    }
  });
});
