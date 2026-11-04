import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WELCOME_MS, wait, waitUntil, SIGN_IN_MESSAGES, SETUP_MESSAGES } from "@/app/utils/pause";

describe("pause constants", () => {
  it("WELCOME_MS is 4000", () => {
    expect(WELCOME_MS).toBe(4000);
  });

  it("SIGN_IN_MESSAGES and SETUP_MESSAGES are frozen 3-item arrays", () => {
    expect(Object.isFrozen(SIGN_IN_MESSAGES)).toBe(true);
    expect(Object.isFrozen(SETUP_MESSAGES)).toBe(true);
    expect(SIGN_IN_MESSAGES).toHaveLength(3);
    expect(SETUP_MESSAGES).toHaveLength(3);
  });
});

describe("wait", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves only after the given ms", async () => {
    let resolved = false;
    wait(1000).then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(999);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);
  });
});

describe("waitUntil", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits the remaining time so the total matches ms", async () => {
    const startedAt = Date.now();
    vi.advanceTimersByTime(1500); // 1.5s of "work" already elapsed
    let resolved = false;
    waitUntil(startedAt, 4000).then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(2499);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);
  });

  it("resolves immediately (0 extra wait) when the work already took longer than ms", async () => {
    const startedAt = Date.now();
    vi.advanceTimersByTime(10000); // way past the 4000ms budget
    let resolved = false;
    waitUntil(startedAt, 4000).then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(true);
  });

  it("defaults to WELCOME_MS when no ms is given", async () => {
    const startedAt = Date.now();
    let resolved = false;
    waitUntil(startedAt).then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(WELCOME_MS - 1);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);
  });
});
