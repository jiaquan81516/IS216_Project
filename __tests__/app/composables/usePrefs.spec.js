import { describe, it, expect, beforeEach } from "vitest";
import { usePrefs, setDisplay, formatPrefTime } from "@/app/composables/usePrefs";
import { DEFAULT_SETTINGS } from "@/app/utils/settingsHelpers";

beforeEach(() => {
  setDisplay({ ...DEFAULT_SETTINGS.display });
});

describe("formatPrefTime", () => {
  it("formats 12h with no leading zero on the hour", () => {
    expect(formatPrefTime(new Date(2026, 10, 5, 21, 5), "12h")).toBe("9:05 PM");
    expect(formatPrefTime(new Date(2026, 10, 5, 0, 5), "12h")).toBe("12:05 AM");
    expect(formatPrefTime(new Date(2026, 10, 5, 12, 0), "12h")).toBe("12:00 PM");
  });
  it("formats 24h with a leading zero", () => {
    expect(formatPrefTime(new Date(2026, 10, 5, 9, 5), "24h")).toBe("09:05");
    expect(formatPrefTime(new Date(2026, 10, 5, 21, 5), "24h")).toBe("21:05");
  });
  it("returns '' for an unparseable value", () => {
    expect(formatPrefTime("not a date")).toBe("");
    expect(formatPrefTime(null)).toBe("");
  });
});

describe("usePrefs", () => {
  it("defaults to the default display settings", () => {
    const { timeFormat, weekStartsOn, reduceMotion } = usePrefs();
    expect(timeFormat.value).toBe("12h");
    expect(weekStartsOn.value).toBe("mon");
    expect(reduceMotion.value).toBe(false);
  });

  it("weekStart resolves 'mon' to 1 and 'sun' to 0", () => {
    setDisplay({ weekStartsOn: "sun" });
    expect(usePrefs().weekStart.value).toBe(0);
    setDisplay({ weekStartsOn: "mon" });
    expect(usePrefs().weekStart.value).toBe(1);
  });

  it("setDisplay updates every instance's computed values (shared module state)", () => {
    const a = usePrefs();
    setDisplay({ timeFormat: "24h" });
    expect(a.timeFormat.value).toBe("24h");
    const b = usePrefs();
    expect(b.timeFormat.value).toBe("24h");
  });

  it("formatTime reflects the current preference", () => {
    setDisplay({ timeFormat: "24h" });
    const { formatTime } = usePrefs();
    expect(formatTime(new Date(2026, 10, 5, 21, 5))).toBe("21:05");
  });

  it("setDisplay fills in any missing fields from the defaults", () => {
    setDisplay({ timeFormat: "24h" });
    expect(usePrefs().weekStartsOn.value).toBe("mon");
    expect(usePrefs().reduceMotion.value).toBe(false);
  });

  it("toggling reduceMotion sets the data-app-motion attribute on <html>", () => {
    setDisplay({ reduceMotion: true });
    expect(document.documentElement.getAttribute("data-app-motion")).toBe("reduce");
    setDisplay({ reduceMotion: false });
    expect(document.documentElement.hasAttribute("data-app-motion")).toBe(false);
  });
});
