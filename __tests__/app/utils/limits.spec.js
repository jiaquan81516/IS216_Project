import { describe, it, expect, beforeEach } from "vitest";
import {
  LIMITS_KEY, WINDOW_MS, LIMIT_RULES, LIMIT_MESSAGE,
  pruneStamps, decide, retryAfterSeconds, checkLimit, takeLimit, resetLimits,
} from "@/app/utils/limits";

describe("constants", () => {
  it("WINDOW_MS is 10 minutes", () => expect(WINDOW_MS).toBe(600000));
  it("LIMIT_RULES is frozen and has sane rate caps", () => {
    expect(Object.isFrozen(LIMIT_RULES)).toBe(true);
    expect(LIMIT_RULES.roomReport.max).toBe(5);
    expect(LIMIT_RULES.entry.max).toBe(10);
  });
  it("LIMITS_KEY is namespaced", () => expect(LIMITS_KEY).toBe("nt.app.limits"));
});

describe("pruneStamps", () => {
  const now = 1000000;

  it("keeps only stamps within the window, up to and including now", () => {
    const stamps = [now - WINDOW_MS - 1, now - WINDOW_MS, now - WINDOW_MS + 1, now, now + 1];
    expect(pruneStamps(stamps, WINDOW_MS, now)).toEqual([now - WINDOW_MS + 1, now]);
  });

  it("excludes a stamp exactly at the window's start edge (strictly greater than, not >=)", () => {
    expect(pruneStamps([now - WINDOW_MS], WINDOW_MS, now)).toEqual([]);
  });

  it("excludes a future stamp", () => {
    expect(pruneStamps([now + 100], WINDOW_MS, now)).toEqual([]);
  });

  it("sorts the result oldest first regardless of input order", () => {
    expect(pruneStamps([now, now - 100, now - 50], WINDOW_MS, now)).toEqual([now - 100, now - 50, now]);
  });

  it("drops non-numeric/garbage entries", () => {
    expect(pruneStamps(["x", null, NaN, now], WINDOW_MS, now)).toEqual([now]);
  });

  it("returns [] for a non-array input", () => {
    expect(pruneStamps(undefined, WINDOW_MS, now)).toEqual([]);
    expect(pruneStamps(null, WINDOW_MS, now)).toEqual([]);
    expect(pruneStamps("not-array", WINDOW_MS, now)).toEqual([]);
  });
});

describe("decide", () => {
  const rule = { max: 3, windowMs: 1000 };
  const now = 10000;

  it("allows when fewer stamps than max are inside the window", () => {
    const out = decide([now - 500], rule, now);
    expect(out.allowed).toBe(true);
    expect(out.remaining).toBe(2);
    expect(out.retryAfterMs).toBe(0);
    expect(out.message).toBe("");
  });

  it("disallows once max stamps are inside the window", () => {
    const out = decide([now - 900, now - 500, now - 100], rule, now);
    expect(out.allowed).toBe(false);
    expect(out.remaining).toBe(0);
    expect(out.message).toBe(LIMIT_MESSAGE);
  });

  it("retryAfterMs is the time until the OLDEST kept stamp ages out", () => {
    const out = decide([now - 900, now - 500, now - 100], rule, now);
    // oldest is now-900; it ages out at (now-900)+1000 = now+100, i.e. 100ms from now.
    expect(out.retryAfterMs).toBe(100);
  });

  it("ignores stamps outside the window entirely when deciding", () => {
    const out = decide([now - 5000, now - 5000, now - 5000], rule, now);
    expect(out.allowed).toBe(true);
    expect(out.remaining).toBe(3);
  });

  it("treats missing/undefined stamps as none recorded yet", () => {
    const out = decide(undefined, rule, now);
    expect(out.allowed).toBe(true);
    expect(out.remaining).toBe(3);
  });
});

describe("retryAfterSeconds", () => {
  it("rounds up to the next whole second", () => {
    expect(retryAfterSeconds(1500)).toBe(2);
    expect(retryAfterSeconds(2000)).toBe(2);
  });

  it("is never less than 1, even for 0 or negative input", () => {
    expect(retryAfterSeconds(0)).toBe(1);
    expect(retryAfterSeconds(-500)).toBe(1);
  });

  it("treats a non-numeric input as 0ms (so 1 second)", () => {
    expect(retryAfterSeconds(undefined)).toBe(1);
    expect(retryAfterSeconds(NaN)).toBe(1);
  });
});

describe("checkLimit / takeLimit / resetLimits (localStorage-backed)", () => {
  beforeEach(() => resetLimits());

  it("checkLimit does not consume an action", () => {
    const before = checkLimit("roomReport", 1000);
    const after = checkLimit("roomReport", 1000);
    expect(before.remaining).toBe(after.remaining);
    expect(before.remaining).toBe(5);
  });

  it("takeLimit records a stamp and decrements remaining", () => {
    const now = 1000;
    const first = takeLimit("roomReport", now);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(4);
    const second = checkLimit("roomReport", now + 1);
    expect(second.remaining).toBe(4);
  });

  it("blocks once the max is reached, and reports a retry time", () => {
    const now = 1000;
    for (let i = 0; i < 5; i += 1) takeLimit("roomReport", now + i);
    const blocked = takeLimit("roomReport", now + 5);
    expect(blocked.allowed).toBe(false);
    expect(blocked.message).toBe(LIMIT_MESSAGE);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("does not record a stamp when already blocked (does not further shrink remaining below 0)", () => {
    const now = 1000;
    for (let i = 0; i < 5; i += 1) takeLimit("roomReport", now + i);
    takeLimit("roomReport", now + 100);
    const after = checkLimit("roomReport", now + 101);
    expect(after.remaining).toBe(0);
  });

  it("tracks each action independently", () => {
    takeLimit("roomReport", 1000);
    const entry = checkLimit("entry", 1000);
    expect(entry.remaining).toBe(LIMIT_RULES.entry.max);
  });

  it("allows again once the window has passed", () => {
    const now = 1000;
    for (let i = 0; i < 5; i += 1) takeLimit("roomReport", now + i);
    const later = checkLimit("roomReport", now + WINDOW_MS + 1000);
    expect(later.allowed).toBe(true);
    expect(later.remaining).toBe(5);
  });

  it("falls back to a default 10/10min rule for an unknown action", () => {
    const out = checkLimit("some-unknown-action", 1000);
    expect(out.remaining).toBe(10);
  });

  it("resetLimits clears all recorded actions", () => {
    takeLimit("roomReport", 1000);
    resetLimits();
    expect(checkLimit("roomReport", 1000).remaining).toBe(5);
  });

  it("survives malformed JSON in localStorage without throwing", () => {
    localStorage.setItem(LIMITS_KEY, "{not json");
    expect(() => checkLimit("roomReport", 1000)).not.toThrow();
    expect(checkLimit("roomReport", 1000).remaining).toBe(5);
  });
});
