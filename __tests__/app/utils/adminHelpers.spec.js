import { describe, it, expect } from "vitest";
import { formatDate } from "@/app/utils/adminHelpers";

function tsFor(date) {
  return { toDate: () => date };
}

describe("formatDate", () => {
  it("formats a Firestore-like Timestamp as 'D Mon YYYY'", () => {
    expect(formatDate(tsFor(new Date(2026, 9, 27)))).toBe("27 Oct 2026");
  });

  it("pads nothing but matches en-SG day/month/year order", () => {
    expect(formatDate(tsFor(new Date(2026, 0, 1)))).toBe("1 Jan 2026");
  });

  it("returns '' for null", () => {
    expect(formatDate(null)).toBe("");
  });

  it("returns '' for undefined", () => {
    expect(formatDate(undefined)).toBe("");
  });

  it("returns '' when the value has no toDate method", () => {
    expect(formatDate({})).toBe("");
    expect(formatDate("2026-10-27")).toBe("");
    expect(formatDate(123)).toBe("");
  });

  it("returns '' when toDate() itself returns a falsy value", () => {
    expect(formatDate({ toDate: () => null })).toBe("");
  });
});
