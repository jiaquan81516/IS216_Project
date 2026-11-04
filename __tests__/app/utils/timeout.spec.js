import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout } from "@/app/utils/timeout";

describe("withTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves with the promise's value when it settles before the timeout", async () => {
    const promise = withTimeout(Promise.resolve("ok"), 1000);
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toBe("ok");
  });

  it("rejects with a timeout error when the promise never settles in time", async () => {
    const never = new Promise(() => {});
    const promise = withTimeout(never, 1000);
    const assertion = expect(promise).rejects.toMatchObject({
      message: "The database did not answer in time.",
      code: "unavailable",
    });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("propagates the original rejection when the promise rejects before the timeout", async () => {
    const boom = new Error("boom");
    const promise = withTimeout(Promise.reject(boom), 1000);
    await expect(promise).rejects.toBe(boom);
  });

  it("defaults the timeout to 10000ms", async () => {
    const never = new Promise(() => {});
    const promise = withTimeout(never);
    let settled = false;
    promise.catch(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(9999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
  });

  it("clears its internal timer so it does not leak/fire after resolving", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    await withTimeout(Promise.resolve("fine"), 500);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
