import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_SETTINGS, TIME_FORMATS, WEEK_STARTS,
  isTimeString, normaliseSettings, settingsPatch, weekStartIndex, debounce,
} from "@/app/utils/settingsHelpers";

describe("isTimeString", () => {
  it("accepts valid HH:mm strings", () => {
    expect(isTimeString("00:00")).toBe(true);
    expect(isTimeString("23:59")).toBe(true);
    expect(isTimeString("09:05")).toBe(true);
  });
  it("rejects malformed or out-of-range times", () => {
    expect(isTimeString("24:00")).toBe(false);
    expect(isTimeString("12:60")).toBe(false);
    expect(isTimeString("9:05")).toBe(false);
    expect(isTimeString("09-05")).toBe(false);
    expect(isTimeString("")).toBe(false);
    expect(isTimeString(null)).toBe(false);
    expect(isTimeString(930)).toBe(false);
  });
});

describe("normaliseSettings", () => {
  it("returns the defaults for undefined/null/non-object input", () => {
    expect(normaliseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings("x")).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it("returns the defaults for an empty object", () => {
    expect(normaliseSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("preserves valid provided values", () => {
    const out = normaliseSettings({
      notifications: {
        push: true,
        feedsDue: false,
        checkInReminder: { on: true, time: "08:00" },
        quietHours: { on: true, start: "22:00", end: "06:30" },
      },
      calendar: { connected: true, calendarId: "cal-1", syncOn: { rota: true } },
      display: { timeFormat: "24h", weekStartsOn: "sun", reduceMotion: true },
      privacy: { shareLastSeen: false },
    });
    expect(out.notifications.push).toBe(true);
    expect(out.notifications.feedsDue).toBe(false);
    expect(out.notifications.checkInReminder).toEqual({ on: true, time: "08:00" });
    expect(out.notifications.quietHours).toEqual({ on: true, start: "22:00", end: "06:30" });
    expect(out.calendar).toEqual({
      connected: true, calendarId: "cal-1",
      syncOn: { rota: true, appointments: true, myReminders: false },
      lastSyncedAt: null,
    });
    expect(out.display).toEqual({ timeFormat: "24h", weekStartsOn: "sun", reduceMotion: true });
    expect(out.privacy).toEqual({ shareLastSeen: false });
  });

  it("falls back field-by-field when values are the wrong type", () => {
    const out = normaliseSettings({
      notifications: { push: "yes", checkInReminder: { on: 1, time: "9:00" } },
      display: { timeFormat: "36h", weekStartsOn: "tue" },
      calendar: { calendarId: 123 },
    });
    expect(out.notifications.push).toBe(DEFAULT_SETTINGS.notifications.push);
    expect(out.notifications.checkInReminder.on).toBe(false);
    expect(out.notifications.checkInReminder.time).toBe("21:30");
    expect(out.display.timeFormat).toBe("12h");
    expect(out.display.weekStartsOn).toBe("mon");
    expect(out.calendar.calendarId).toBeNull();
  });

  it("drops unexpected extra fields", () => {
    const out = normaliseSettings({ notifications: { bogus: true }, extra: "nope" });
    expect(out).toEqual(DEFAULT_SETTINGS);
    expect(out.extra).toBeUndefined();
  });

  it("does not crash when a section is not an object", () => {
    expect(() => normaliseSettings({ notifications: "nope", calendar: 5, display: null, privacy: [] })).not.toThrow();
    expect(normaliseSettings({ notifications: "nope" })).toEqual(DEFAULT_SETTINGS);
  });

  it("passes lastSyncedAt through unvalidated (it may be a Firestore Timestamp)", () => {
    const ts = { seconds: 1, nanoseconds: 2 };
    expect(normaliseSettings({ calendar: { lastSyncedAt: ts } }).calendar.lastSyncedAt).toBe(ts);
  });

  it("does not mutate DEFAULT_SETTINGS when normalising, and its top level is frozen", () => {
    normaliseSettings({ notifications: { push: true } });
    expect(DEFAULT_SETTINGS.notifications.push).toBe(false);
    // Object.freeze is shallow: the top-level object can't be reassigned (ESM is strict
    // mode, so this throws rather than silently failing)...
    expect(() => { DEFAULT_SETTINGS.display = {}; }).toThrow(TypeError);
    expect(DEFAULT_SETTINGS.display.timeFormat).toBe("12h");
    // ...but nested objects (e.g. .notifications) are NOT frozen and remain mutable.
    // Nothing in the codebase mutates them directly (everyone spreads, e.g. usePrefs.js),
    // so this is a latent footgun rather than an active bug, and is documented by this test.
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_SETTINGS.notifications)).toBe(false);
  });
});

describe("settingsPatch", () => {
  it("builds a dotted settings.<path> key", () => {
    expect(settingsPatch("notifications.push", true)).toEqual({ "settings.notifications.push": true });
  });
  it("works for a top-level path too", () => {
    expect(settingsPatch("privacy", { shareLastSeen: false })).toEqual({ "settings.privacy": { shareLastSeen: false } });
  });
});

describe("weekStartIndex", () => {
  it("is 0 for sun and 1 for mon or anything else", () => {
    expect(weekStartIndex("sun")).toBe(0);
    expect(weekStartIndex("mon")).toBe(1);
    expect(weekStartIndex("bogus")).toBe(1);
    expect(weekStartIndex(undefined)).toBe(1);
  });
});

describe("TIME_FORMATS / WEEK_STARTS", () => {
  it("list the allowed values", () => {
    expect(TIME_FORMATS).toEqual(["12h", "24h"]);
    expect(WEEK_STARTS).toEqual(["mon", "sun"]);
  });
});

describe("debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls fn once, after the delay, with the last call's args", () => {
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d("a");
    d("b");
    d("c");
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("defaults to a 600ms delay", () => {
    const fn = vi.fn();
    const d = debounce(fn);
    d();
    vi.advanceTimersByTime(599);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("flush() runs immediately with the pending args and clears the timer", () => {
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d("x");
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("x");
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1); // no double call once the timer already fired via flush
  });

  it("flush() is a no-op when nothing is pending", () => {
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel() drops the pending call without invoking fn", () => {
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d("x");
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel() then flush() does nothing (timer already cleared)", () => {
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d("x");
    d.cancel();
    d.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it("supports multiple arguments", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1, 2, 3);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith(1, 2, 3);
  });
});
