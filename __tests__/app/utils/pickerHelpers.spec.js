import { describe, it, expect } from "vitest";
import { formatIsoDate, formatHhmm } from "@/app/utils/pickerHelpers";

describe("formatIsoDate", () => {
  it("formats a valid ISO date with weekday, day, month, year", () => {
    expect(formatIsoDate("2026-11-02")).toBe("Mon, 2 Nov 2026");
  });

  it("does not zero-pad the day number", () => {
    expect(formatIsoDate("2026-01-05")).toBe("Mon, 5 Jan 2026");
  });

  it("handles every month label correctly", () => {
    expect(formatIsoDate("2026-12-25")).toBe("Fri, 25 Dec 2026");
    expect(formatIsoDate("2026-07-04")).toBe("Sat, 4 Jul 2026");
  });

  it("returns '' for null/undefined/empty", () => {
    expect(formatIsoDate(null)).toBe("");
    expect(formatIsoDate(undefined)).toBe("");
    expect(formatIsoDate("")).toBe("");
  });

  it("returns '' for a malformed string", () => {
    expect(formatIsoDate("2026-11-2")).toBe("");
    expect(formatIsoDate("not-a-date")).toBe("");
    expect(formatIsoDate("2026/11/02")).toBe("");
  });

  it("returns '' for an impossible calendar date", () => {
    expect(formatIsoDate("2026-13-01")).toBe("");
    expect(formatIsoDate("2026-02-30")).toBe("");
  });
});

describe("formatHhmm", () => {
  it("formats midnight, noon and a PM time in 12h (default)", () => {
    expect(formatHhmm("00:00")).toBe("12:00 AM");
    expect(formatHhmm("12:00")).toBe("12:00 PM");
    expect(formatHhmm("21:05")).toBe("9:05 PM");
  });

  it("formats a single-digit 12h hour without a leading zero", () => {
    expect(formatHhmm("09:30")).toBe("9:30 AM");
  });

  it("formats 23:59 correctly", () => {
    expect(formatHhmm("23:59")).toBe("11:59 PM");
  });

  it("returns the raw HH:mm string unchanged in 24h mode", () => {
    expect(formatHhmm("21:05", "24h")).toBe("21:05");
    expect(formatHhmm("00:00", "24h")).toBe("00:00");
  });

  it("returns '' for null/undefined/empty/malformed", () => {
    expect(formatHhmm(null)).toBe("");
    expect(formatHhmm(undefined)).toBe("");
    expect(formatHhmm("")).toBe("");
    expect(formatHhmm("9:30")).toBe("");
    expect(formatHhmm("21:5")).toBe("");
    expect(formatHhmm("2130")).toBe("");
  });
});
