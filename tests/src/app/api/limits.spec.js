import { beforeEach, describe, expect, it } from "vitest";
import {
  checkLimit,
  decide,
  LIMIT_MESSAGE,
  LIMIT_RULES,
  LIMITS_KEY,
  pruneStamps,
  resetLimits,
  takeLimit,
} from "@/app/api/limits";

const RULE = { max: 3, windowMs: 1000 };

beforeEach(() => localStorage.clear());

describe("pruneStamps", () => {
  it("keeps only the stamps inside the window, oldest first", () => {
    expect(pruneStamps([500, 100, 950], 1000, 1000)).toEqual([100, 500, 950]);
    expect(pruneStamps([5, 100], 1000, 1050)).toEqual([100]);
  });
  it("drops rubbish and anything in the future", () => {
    expect(pruneStamps(["x", null, NaN, 2000], 1000, 1000)).toEqual([]);
    expect(pruneStamps(undefined, 1000, 1000)).toEqual([]);
  });
});

describe("decide", () => {
  it("allows up to max inside the window", () => {
    expect(decide([], RULE, 1000).allowed).toBe(true);
    expect(decide([900, 950], RULE, 1000).remaining).toBe(1);
    const blocked = decide([900, 950, 999], RULE, 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.message).toBe(LIMIT_MESSAGE);
  });
  it("says how long until the oldest stamp leaves the window", () => {
    expect(decide([900, 950, 999], RULE, 1000).retryAfterMs).toBe(900);
  });
  it("lets the window slide, so old stamps stop counting", () => {
    expect(decide([10, 20, 30], RULE, 2000).allowed).toBe(true);
  });
});

describe("the real actions", () => {
  it("limits room reports to 5 in ten minutes", () => {
    expect(LIMIT_RULES.roomReport).toEqual({ max: 5, windowMs: 600000 });
    expect(LIMIT_RULES.entry.max).toBe(10);
    expect(LIMIT_RULES.inviteRegenerate.max).toBe(3);
  });

  it("records each take and blocks the sixth report", () => {
    const start = 1_700_000_000_000;
    for (let i = 0; i < 5; i += 1) {
      expect(takeLimit("roomReport", start + i).allowed).toBe(true);
    }
    const blocked = takeLimit("roomReport", start + 5);
    expect(blocked.allowed).toBe(false);
    expect(blocked.message).toBe(LIMIT_MESSAGE);
    // Ten minutes later the window has moved on.
    expect(takeLimit("roomReport", start + 600001).allowed).toBe(true);
  });

  it("keeps one action's count away from another's", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 3; i += 1) takeLimit("inviteRegenerate", now + i);
    expect(checkLimit("inviteRegenerate", now + 4).allowed).toBe(false);
    expect(checkLimit("roomReport", now + 4).allowed).toBe(true);
  });

  it("stores the stamps under one key and forgets them on reset", () => {
    takeLimit("roomReport", 1000);
    expect(JSON.parse(localStorage.getItem(LIMITS_KEY))).toEqual({ roomReport: [1000] });
    resetLimits();
    expect(localStorage.getItem(LIMITS_KEY)).toBeNull();
  });

  it("survives unreadable storage", () => {
    localStorage.setItem(LIMITS_KEY, "not json");
    expect(takeLimit("roomReport", 1000).allowed).toBe(true);
  });
});
