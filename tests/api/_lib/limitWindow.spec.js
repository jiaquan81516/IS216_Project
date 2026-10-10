import { describe, expect, it } from "vitest";
import { decide, LIMITS, pruneStamps, retryAfterSeconds, WINDOW_MS } from "../../../api/_lib/limitWindow.js";

const NOW = 1_760_000_000_000;

describe("the server side sliding window", () => {
  it("drops the stamps that fall outside the window", () => {
    const stamps = [NOW - WINDOW_MS - 1, NOW - WINDOW_MS + 1, NOW - 1000, NOW];
    expect(pruneStamps(stamps, NOW)).toEqual([NOW - WINDOW_MS + 1, NOW - 1000, NOW]);
  });

  it("ignores rubbish in the stored array", () => {
    expect(pruneStamps(["x", null, undefined, NaN, NOW + 5000, NOW - 10], NOW)).toEqual([NOW - 10]);
    expect(pruneStamps(null, NOW)).toEqual([]);
  });

  it("allows calls up to the limit and records each one", () => {
    let stamps = [];
    for (let i = 0; i < 3; i += 1) {
      const outcome = decide(stamps, NOW + i, 3);
      expect(outcome.allowed).toBe(true);
      stamps = outcome.stamps;
    }
    expect(stamps.length).toBe(3);
    const blocked = decide(stamps, NOW + 3, 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.stamps.length).toBe(3);
  });

  it("says how long to wait, counted from the oldest call in the window", () => {
    const stamps = [NOW - 60_000, NOW - 30_000, NOW - 10_000];
    const blocked = decide(stamps, NOW, 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(WINDOW_MS - 60_000);
    expect(retryAfterSeconds(blocked.retryAfterMs)).toBe(540);
  });

  it("lets the user through again once the oldest call ages out", () => {
    const stamps = [NOW - 60_000, NOW - 30_000, NOW - 10_000];
    const later = NOW + WINDOW_MS - 59_000;
    expect(decide(stamps, later, 3).allowed).toBe(true);
  });

  it("counts down what is left", () => {
    expect(decide([], NOW, 3).remaining).toBe(2);
    expect(decide([NOW - 1, NOW - 2], NOW, 3).remaining).toBe(0);
  });

  it("never asks for a wait of less than a second", () => {
    expect(retryAfterSeconds(0)).toBe(1);
    expect(retryAfterSeconds(1)).toBe(1);
    expect(retryAfterSeconds(2500)).toBe(3);
  });

  it("keeps the limits the client guard uses", () => {
    expect(LIMITS.accountDelete).toBe(3);
    expect(LIMITS.googleConnect).toBe(10);
    expect(WINDOW_MS).toBe(600_000);
  });
});
