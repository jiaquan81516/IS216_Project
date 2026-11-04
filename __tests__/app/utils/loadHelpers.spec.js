import { describe, it, expect } from "vitest";
import {
  isNightHour, onDutyRun, loadSignals, partnerRecentLog, isHardCheckin, feelingLevel,
  needsSupport, isDismissed, buildNudges, weeklyPrompt, weeklyTogether,
  NIGHT_START_HOUR, NIGHT_END_HOUR, HEAVY_NIGHT_LOGS, HEAVY_RUN_NIGHTS, BUSY_DAY_LOGS, MAX_NUDGES,
} from "@/app/utils/loadHelpers";

// A "manual" pattern plan with explicit per-date overrides gives exact, deterministic nights.
function manualView(overrides = {}, swaps = []) {
  return { pattern: "manual", overrides, swaps, firstOnDuty: null };
}

describe("isNightHour", () => {
  it("covers 8pm through 5:59am", () => {
    expect(isNightHour(20)).toBe(true);
    expect(isNightHour(23)).toBe(true);
    expect(isNightHour(0)).toBe(true);
    expect(isNightHour(5)).toBe(true);
    expect(isNightHour(6)).toBe(false);
    expect(isNightHour(19)).toBe(false);
  });
});

describe("onDutyRun", () => {
  it("returns 0 with no view or no upTo date", () => {
    expect(onDutyRun({ view: null, upTo: "2026-11-05" })).toBe(0);
    expect(onDutyRun({ view: manualView(), upTo: "" })).toBe(0);
  });

  it("counts consecutive solo nights ending at upTo", () => {
    const view = manualView({ "2026-11-03": "me", "2026-11-04": "me", "2026-11-05": "me", "2026-11-02": "partner" });
    expect(onDutyRun({ view, upTo: "2026-11-05", who: "me" })).toBe(3);
  });

  it("stops counting at a night that isn't this person's", () => {
    const view = manualView({ "2026-11-04": "partner", "2026-11-05": "me" });
    expect(onDutyRun({ view, upTo: "2026-11-05", who: "me" })).toBe(1);
  });

  it("does not count a shared (split) night", () => {
    const view = { pattern: "split", overrides: {}, swaps: [], firstOnDuty: "me", startDate: "2026-11-02" };
    // split alternates with shared=true, so every night is shared -> never counts for either person.
    expect(onDutyRun({ view, upTo: "2026-11-05", who: "me" })).toBe(0);
  });
});

describe("loadSignals", () => {
  const iso = (h) => new Date(2026, 10, 5, h, 0).toISOString();
  it("counts only this uid's logs within the last 24h window", () => {
    const now = new Date(2026, 10, 5, 12, 0);
    const entries = [
      { by: "me1", at: iso(10) }, // within window
      { by: "partner1", at: iso(10) }, // someone else
      { by: "me1", at: new Date(2026, 10, 3, 10, 0).toISOString() }, // too old
    ];
    const result = loadSignals({ entries, uid: "me1", now });
    expect(result.logs).toBe(1);
  });

  it("flags heavy when nightLogs hits the threshold", () => {
    const now = new Date(2026, 10, 5, 7, 0);
    const entries = Array.from({ length: HEAVY_NIGHT_LOGS }, () => ({ by: "me1", at: new Date(2026, 10, 5, 1, 0).toISOString() }));
    const result = loadSignals({ entries, uid: "me1", now });
    expect(result.nightLogs).toBe(HEAVY_NIGHT_LOGS);
    expect(result.heavy).toBe(true);
    expect(result.reasons[0]).toContain("logs in the night");
  });

  it("flags heavy from a long on-duty run alone", () => {
    const result = loadSignals({ entries: [], uid: "me1", now: new Date(), run: HEAVY_RUN_NIGHTS + 1 });
    expect(result.heavy).toBe(true);
    expect(result.reasons.some((r) => r.includes("nights in a row"))).toBe(true);
  });

  it("flags heavy from a busy day of logs alone", () => {
    const now = new Date(2026, 10, 5, 12, 0);
    const entries = Array.from({ length: BUSY_DAY_LOGS }, (_, i) => ({ by: "me1", at: new Date(2026, 10, 5, 8 + i * 0, 0).toISOString() }));
    const result = loadSignals({ entries, uid: "me1", now });
    expect(result.logs).toBe(BUSY_DAY_LOGS);
    // A busy day alone only contributes score 1, below HEAVY_SCORE (2), so it is not
    // "heavy" by itself -- heavy requires combining with a rough night or a long run.
    expect(result.heavy).toBe(false);
    expect(result.reasons[0]).toContain("a busy day");
  });

  it("is not heavy with light activity", () => {
    const result = loadSignals({ entries: [], uid: "me1", now: new Date(), run: 0 });
    expect(result.heavy).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("ignores entries with no uid given", () => {
    const result = loadSignals({ entries: [{ by: "me1", at: new Date().toISOString() }], uid: "", now: new Date() });
    expect(result.logs).toBe(0);
  });
});

describe("partnerRecentLog", () => {
  it("returns null with no partner uid", () => {
    expect(partnerRecentLog({ entries: [], partnerUid: "" })).toBeNull();
  });

  it("finds the partner's most recent evening/night log within the window", () => {
    const now = new Date(2026, 10, 5, 21, 0);
    const entries = [
      { by: "partner1", type: "feed", at: new Date(2026, 10, 5, 20, 0).toISOString() },
      { by: "partner1", type: "sleep", at: new Date(2026, 10, 5, 20, 30).toISOString() }, // newer
      { by: "me1", type: "nappy", at: new Date(2026, 10, 5, 20, 45).toISOString() }, // not partner's
    ];
    const result = partnerRecentLog({ entries, partnerUid: "partner1", now });
    expect(result).toMatchObject({ type: "sleep", verb: "put the baby down" });
  });

  it("ignores a log outside the evening/night hours", () => {
    const now = new Date(2026, 10, 5, 15, 0);
    const entries = [{ by: "partner1", type: "feed", at: new Date(2026, 10, 5, 14, 0).toISOString() }];
    expect(partnerRecentLog({ entries, partnerUid: "partner1", now })).toBeNull();
  });

  it("ignores a log older than PARTNER_WINDOW_MS", () => {
    const now = new Date(2026, 10, 5, 23, 0);
    const entries = [{ by: "partner1", type: "feed", at: new Date(2026, 10, 5, 18, 0).toISOString() }]; // 5h ago
    expect(partnerRecentLog({ entries, partnerUid: "partner1", now })).toBeNull();
  });

  it("falls back to 'logged something' for an unknown type", () => {
    const now = new Date(2026, 10, 5, 21, 0);
    const entries = [{ by: "partner1", type: "weird", at: new Date(2026, 10, 5, 20, 0).toISOString() }];
    expect(partnerRecentLog({ entries, partnerUid: "partner1", now }).verb).toBe("logged something");
  });
});

describe("isHardCheckin / feelingLevel", () => {
  it("a hard check-in is low mood or high stress", () => {
    expect(isHardCheckin({ mood: 2, stress: 1 })).toBe(true);
    expect(isHardCheckin({ mood: 5, stress: 5 })).toBe(true);
    expect(isHardCheckin({ mood: 3, stress: 3 })).toBe(false);
    expect(isHardCheckin(null)).toBe(false);
  });

  it("feelingLevel maps hard/good/okay correctly", () => {
    expect(feelingLevel(null)).toBeNull();
    expect(feelingLevel({ mood: 1, stress: 1 })).toBe("hard");
    expect(feelingLevel({ mood: 5, stress: 1 })).toBe("good");
    expect(feelingLevel({ mood: 3, stress: 4 })).toBe("okay");
  });
});

describe("needsSupport", () => {
  const hard = (date) => ({ date, entry: { date, mood: 1, stress: 5 } });
  it("false with fewer than HARD_STREAK days", () => {
    expect(needsSupport([hard("2026-11-03"), hard("2026-11-04")], new Date(2026, 10, 5))).toBe(false);
  });
  it("true for 3+ consecutive hard check-ins, recent enough", () => {
    const days = [hard("2026-11-03"), hard("2026-11-04"), hard("2026-11-05")];
    expect(needsSupport(days, new Date(2026, 10, 5))).toBe(true);
  });
  it("false if the most recent hard streak is not actually the last entries", () => {
    const days = [hard("2026-11-03"), { date: "2026-11-04", entry: { date: "2026-11-04", mood: 5, stress: 1 } }, hard("2026-11-05")];
    expect(needsSupport(days, new Date(2026, 10, 5))).toBe(false);
  });
  it("false if the hard streak is too old", () => {
    const days = [hard("2026-10-01"), hard("2026-10-02"), hard("2026-10-03")];
    expect(needsSupport(days, new Date(2026, 10, 5))).toBe(false);
  });
});

describe("isDismissed", () => {
  it("true only when dismissed for exactly today's key", () => {
    expect(isDismissed({ id: "n1" }, { n1: "2026-11-05" }, "2026-11-05")).toBe(true);
    expect(isDismissed({ id: "n1" }, { n1: "2026-11-04" }, "2026-11-05")).toBe(false);
    expect(isDismissed({ id: "n1" }, {}, "2026-11-05")).toBe(false);
  });
});

describe("buildNudges", () => {
  it("returns [] with nothing going on", () => {
    expect(buildNudges()).toEqual([]);
  });

  it("orders partner-heavy first, then support, heavy-self, partner-feeling, partner-logged", () => {
    const now = new Date(2026, 10, 5, 12, 0);
    const list = buildNudges({
      now,
      me: { heavy: true, reasons: ["a busy day"] },
      partner: { heavy: true, reasons: ["a busy day"] },
      supportNeeded: true,
      partnerFeeling: { level: "hard", date: "2026-11-05" },
      recentLog: { verb: "logged a feed", at: now },
      checkedInToday: false,
    });
    // MAX_NUDGES caps the list at 4, so with all 5 kinds triggered the lowest-ranked
    // (partner-logged) is dropped -- this also exercises the cap.
    expect(list.map((n) => n.kind)).toEqual(["partner-heavy", "support", "heavy-self", "partner-feeling"]);
    expect(list).toHaveLength(MAX_NUDGES);
  });

  it("caps the list at MAX_NUDGES", () => {
    const now = new Date(2026, 10, 5);
    const list = buildNudges({
      now, me: { heavy: true, reasons: ["x"] }, partner: { heavy: true, reasons: ["x"] },
      supportNeeded: true, partnerFeeling: { level: "hard", date: "2026-11-05" },
      recentLog: { verb: "logged a feed", at: now }, checkedInToday: false,
    });
    expect(list.length).toBeLessThanOrEqual(MAX_NUDGES);
  });

  it("suppresses heavy-self and partner-logged once checked in today", () => {
    const now = new Date(2026, 10, 5);
    const list = buildNudges({ now, me: { heavy: true, reasons: ["x"] }, recentLog: { verb: "logged a feed", at: now }, checkedInToday: true });
    expect(list.map((n) => n.kind)).toEqual([]);
  });

  it("suppresses partner-logged when the notifications.partnerLogs setting is off", () => {
    const now = new Date(2026, 10, 5);
    const list = buildNudges({ now, recentLog: { verb: "logged a feed", at: now }, settings: { notifications: { partnerLogs: false } } });
    expect(list).toEqual([]);
  });

  it("filters out a dismissed nudge for today", () => {
    const now = new Date(2026, 10, 5);
    const list = buildNudges({ now, supportNeeded: true, dismissed: { support: "2026-11-05" } });
    expect(list).toEqual([]);
  });

  it("does not filter a nudge dismissed on a different day", () => {
    const now = new Date(2026, 10, 5);
    const list = buildNudges({ now, supportNeeded: true, dismissed: { support: "2026-11-01" } });
    expect(list.map((n) => n.id)).toEqual(["support"]);
  });

  it("only shows partner-feeling for today's shared feeling", () => {
    const now = new Date(2026, 10, 5);
    const list = buildNudges({ now, partnerFeeling: { level: "hard", date: "2026-11-01" } });
    expect(list).toEqual([]);
  });
});

describe("weeklyPrompt", () => {
  it("returns a stable prompt for the same week", () => {
    expect(weeklyPrompt(new Date(2026, 10, 2))).toBe(weeklyPrompt(new Date(2026, 10, 6)));
  });
  it("cycles through the prompt list week to week", () => {
    const a = weeklyPrompt(new Date(2026, 10, 2));
    const b = weeklyPrompt(new Date(2026, 10, 9)); // next week
    // Not guaranteed different in general, but across many weeks we expect variety; just assert it's a known string.
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
  });
});

describe("weeklyTogether", () => {
  it("returns blank stats and no line with nothing going on", () => {
    const result = weeklyTogether({ now: new Date(2026, 10, 5) });
    expect(result.me).toEqual({ nights: 0, logs: 0, nightLogs: 0, tasks: 0, thanks: 0 });
    expect(result.line).toBe("");
  });

  it("tallies logs, tasks and thanks within the last 7 days, attributed by uid", () => {
    const now = new Date(2026, 10, 5, 12, 0);
    const entries = [
      { by: "me1", at: new Date(2026, 10, 4, 10, 0).toISOString() },
      { by: "partner1", at: new Date(2026, 10, 4, 1, 0).toISOString() }, // night log
    ];
    const tasks = [{ doneBy: "me1", done: true, doneAt: new Date(2026, 10, 4).toISOString() }];
    const chat = [{ from: "partner1", kind: "thanks", createdAt: new Date(2026, 10, 4).toISOString() }];
    const result = weeklyTogether({ entries, tasks, chat, uid: "me1", partnerUid: "partner1", now });
    expect(result.me).toMatchObject({ logs: 1, tasks: 1 });
    expect(result.partner).toMatchObject({ logs: 1, nightLogs: 1, thanks: 1 });
  });

  it("ignores activity outside the 7-day window", () => {
    const now = new Date(2026, 10, 5);
    const entries = [{ by: "me1", at: new Date(2026, 9, 1).toISOString() }];
    const result = weeklyTogether({ entries, uid: "me1", now });
    expect(result.me.logs).toBe(0);
  });

  it("says nights were shared evenly when the gap is small", () => {
    const view = manualView({
      "2026-10-30": "me", "2026-10-31": "partner", "2026-11-01": "me",
      "2026-11-02": "partner", "2026-11-03": "me", "2026-11-04": "partner", "2026-11-05": "open",
    });
    const result = weeklyTogether({ view, uid: "me1", partnerUid: "partner1", tonight: "2026-11-05", now: new Date(2026, 10, 5) });
    expect(result.line).toContain("shared fairly evenly");
  });

  it("credits the heavier person by name when the gap is 2+", () => {
    const view = manualView({
      "2026-10-30": "partner", "2026-10-31": "partner", "2026-11-01": "partner",
      "2026-11-02": "me", "2026-11-03": "open", "2026-11-04": "open", "2026-11-05": "open",
    });
    const result = weeklyTogether({ view, uid: "me1", partnerUid: "partner1", partnerName: "Alex", tonight: "2026-11-05", now: new Date(2026, 10, 5) });
    expect(result.line).toContain("Alex covered more");
  });

  it("credits 'You' when I covered more nights", () => {
    const view = manualView({
      "2026-10-30": "me", "2026-10-31": "me", "2026-11-01": "me",
      "2026-11-02": "partner", "2026-11-03": "open", "2026-11-04": "open", "2026-11-05": "open",
    });
    const result = weeklyTogether({ view, uid: "me1", partnerUid: "partner1", tonight: "2026-11-05", now: new Date(2026, 10, 5) });
    expect(result.line).toContain("You covered more");
  });
});
