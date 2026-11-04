import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, effectScope, nextTick } from "vue";
import { useDelayedFlag } from "@/app/composables/useDelayedFlag";

// onBeforeUnmount needs an active effect scope (or component) to register against.
function withScope(fn) {
  const scope = effectScope();
  const result = scope.run(fn);
  return { ...result, dispose: () => scope.stop() };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useDelayedFlag", () => {
  it("starts false when the source starts false", () => {
    const source = ref(false);
    const { shown } = withScope(() => ({ shown: useDelayedFlag(source) }));
    expect(shown.value).toBe(false);
  });

  it("does not show until the delay has elapsed", async () => {
    const source = ref(false);
    const { shown } = withScope(() => ({ shown: useDelayedFlag(source, { delay: 250, min: 500 }) }));
    source.value = true;
    await nextTick();
    expect(shown.value).toBe(false);
    vi.advanceTimersByTime(249);
    expect(shown.value).toBe(false);
    vi.advanceTimersByTime(1);
    expect(shown.value).toBe(true);
  });

  it("never shows at all for a quick on/off faster than the delay", async () => {
    const source = ref(false);
    const { shown } = withScope(() => ({ shown: useDelayedFlag(source, { delay: 250, min: 500 }) }));
    source.value = true;
    await nextTick();
    vi.advanceTimersByTime(100);
    source.value = false;
    await nextTick();
    vi.advanceTimersByTime(1000);
    expect(shown.value).toBe(false);
  });

  it("stays shown for at least `min` ms even if the source turns off immediately", async () => {
    const source = ref(false);
    const { shown } = withScope(() => ({ shown: useDelayedFlag(source, { delay: 0, min: 500 }) }));
    source.value = true;
    await nextTick();
    expect(shown.value).toBe(true); // delay: 0 shows immediately
    source.value = false;
    await nextTick();
    expect(shown.value).toBe(true); // still within `min`
    vi.advanceTimersByTime(499);
    expect(shown.value).toBe(true);
    vi.advanceTimersByTime(1);
    expect(shown.value).toBe(false);
  });

  it("hides immediately if it had already been shown for longer than `min`", async () => {
    const source = ref(false);
    const { shown } = withScope(() => ({ shown: useDelayedFlag(source, { delay: 0, min: 500 }) }));
    source.value = true;
    await nextTick();
    vi.advanceTimersByTime(600);
    source.value = false;
    await nextTick();
    vi.advanceTimersByTime(0);
    expect(shown.value).toBe(false);
  });

  it("accepts a function for `delay`, evaluated each time it turns on", async () => {
    const source = ref(false);
    const delayFn = vi.fn(() => 100);
    const { shown } = withScope(() => ({ shown: useDelayedFlag(source, { delay: delayFn, min: 0 }) }));
    source.value = true;
    await nextTick();
    expect(delayFn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(shown.value).toBe(true);
  });

  it("does not restart the show timer if the source flips true again while already pending", async () => {
    const source = ref(false);
    const { shown } = withScope(() => ({ shown: useDelayedFlag(source, { delay: 250, min: 0 }) }));
    source.value = true;
    await nextTick();
    vi.advanceTimersByTime(200);
    source.value = true; // still true -- watch won't even fire since the value didn't change
    await nextTick();
    vi.advanceTimersByTime(50);
    expect(shown.value).toBe(true);
  });

  it("clears pending timers on scope dispose without throwing", async () => {
    const source = ref(false);
    const { shown, dispose } = withScope(() => ({ shown: useDelayedFlag(source, { delay: 250, min: 500 }) }));
    source.value = true;
    await nextTick();
    expect(() => dispose()).not.toThrow();
  });
});
