import { beforeEach, describe, expect, it } from "vitest";
import { formatPrefTime, resetV3Display, setV3Display, useV3Prefs } from "./useV3Prefs";
import { weekdayLabels } from "@/v3/api/calendarHelpers";

beforeEach(() => resetV3Display());

describe("formatPrefTime", () => {
  const at = new Date(2026, 9, 10, 21, 5);
  it("writes 12 hour and 24 hour the same way on every browser", () => {
    expect(formatPrefTime(at, "12h")).toBe("9:05 PM");
    expect(formatPrefTime(at, "24h")).toBe("21:05");
    expect(formatPrefTime(new Date(2026, 9, 10, 0, 7), "12h")).toBe("12:07 AM");
    expect(formatPrefTime(new Date(2026, 9, 10, 9, 0), "24h")).toBe("09:00");
  });
  it("falls back to 12 hour and handles nothing", () => {
    expect(formatPrefTime(at)).toBe("9:05 PM");
    expect(formatPrefTime(null, "24h")).toBe("");
  });
});

describe("useV3Prefs", () => {
  it("starts on the documented defaults", () => {
    const prefs = useV3Prefs();
    expect(prefs.timeFormat.value).toBe("12h");
    expect(prefs.weekStartsOn.value).toBe("mon");
    expect(prefs.weekStart.value).toBe(1);
    expect(prefs.reduceMotion.value).toBe(false);
  });

  it("changes the time rendering and the calendar week start together", () => {
    const prefs = useV3Prefs();
    expect(weekdayLabels(prefs.weekStart.value)[0]).toBe("Mon");
    setV3Display({ timeFormat: "24h", weekStartsOn: "sun", reduceMotion: true });
    expect(prefs.formatTime(new Date(2026, 9, 10, 21, 5))).toBe("21:05");
    expect(prefs.weekStart.value).toBe(0);
    expect(weekdayLabels(prefs.weekStart.value)[0]).toBe("Sun");
    expect(document.documentElement.getAttribute("data-v3-motion")).toBe("reduce");
  });

  it("fills in anything the stored document is missing", () => {
    const prefs = useV3Prefs();
    setV3Display({ timeFormat: "24h" });
    expect(prefs.weekStartsOn.value).toBe("mon");
    resetV3Display();
    expect(prefs.timeFormat.value).toBe("12h");
    expect(document.documentElement.getAttribute("data-v3-motion")).toBeNull();
  });
});
