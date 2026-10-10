import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  debounce,
  DEFAULT_SETTINGS,
  isTimeString,
  normaliseSettings,
  settingsPatch,
  weekStartIndex,
} from "@/app/api/settingsHelpers";

describe("DEFAULT_SETTINGS", () => {
  it("has the four sections from docs/data-model.md", () => {
    expect(Object.keys(DEFAULT_SETTINGS)).toEqual(["notifications", "calendar", "display", "privacy"]);
    expect(DEFAULT_SETTINGS.notifications.push).toBe(false);
    expect(DEFAULT_SETTINGS.notifications.checkInReminder).toEqual({ on: false, time: "21:30" });
    expect(DEFAULT_SETTINGS.notifications.quietHours).toEqual({ on: false, start: "23:00", end: "05:00" });
    expect(DEFAULT_SETTINGS.calendar.syncOn).toEqual({ rota: false, appointments: true, myReminders: false });
    expect(DEFAULT_SETTINGS.display).toEqual({ timeFormat: "12h", weekStartsOn: "mon", reduceMotion: false });
    expect(DEFAULT_SETTINGS.privacy).toEqual({ shareLastSeen: true });
  });
});

describe("normaliseSettings", () => {
  it("fills in everything that is missing", () => {
    expect(normaliseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings("nonsense")).toEqual(DEFAULT_SETTINGS);
  });
  it("keeps the values it recognises", () => {
    const out = normaliseSettings({
      notifications: { push: true, quietHours: { on: true, start: "22:15" } },
      display: { timeFormat: "24h", weekStartsOn: "sun", reduceMotion: true },
      privacy: { shareLastSeen: false },
    });
    expect(out.notifications.push).toBe(true);
    expect(out.notifications.quietHours).toEqual({ on: true, start: "22:15", end: "05:00" });
    expect(out.display).toEqual({ timeFormat: "24h", weekStartsOn: "sun", reduceMotion: true });
    expect(out.privacy.shareLastSeen).toBe(false);
  });
  it("throws away values of the wrong shape and anything unexpected", () => {
    const out = normaliseSettings({
      notifications: { push: "yes", quietHours: { start: "25:00" } },
      display: { timeFormat: "36h", weekStartsOn: "tue" },
      somethingElse: { nope: 1 },
    });
    expect(out.notifications.push).toBe(false);
    expect(out.notifications.quietHours.start).toBe("23:00");
    expect(out.display.timeFormat).toBe("12h");
    expect(out.display.weekStartsOn).toBe("mon");
    expect(out.somethingElse).toBeUndefined();
  });
  it("checks time strings", () => {
    expect(isTimeString("00:00")).toBe(true);
    expect(isTimeString("23:59")).toBe(true);
    expect(isTimeString("24:00")).toBe(false);
    expect(isTimeString("9:30")).toBe(false);
    expect(isTimeString(930)).toBe(false);
  });
});

describe("settingsPatch", () => {
  it("writes one dotted path, so two sections never overwrite each other", () => {
    expect(settingsPatch("notifications.quietHours.start", "22:00")).toEqual({
      "settings.notifications.quietHours.start": "22:00",
    });
    expect(settingsPatch("display.timeFormat", "24h")).toEqual({ "settings.display.timeFormat": "24h" });
  });
});

describe("weekStartIndex", () => {
  it("is 1 for Monday and 0 for Sunday", () => {
    expect(weekStartIndex("mon")).toBe(1);
    expect(weekStartIndex("sun")).toBe(0);
    expect(weekStartIndex(undefined)).toBe(1);
  });
});

describe("debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls once, with the last arguments, after the wait", () => {
    const fn = vi.fn();
    const wrapped = debounce(fn, 600);
    wrapped("a");
    wrapped("b");
    wrapped("c");
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(599);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("flushes early and cancels", () => {
    const fn = vi.fn();
    const wrapped = debounce(fn, 600);
    wrapped(1);
    wrapped.flush();
    expect(fn).toHaveBeenCalledWith(1);
    wrapped.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    wrapped(2);
    wrapped.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
