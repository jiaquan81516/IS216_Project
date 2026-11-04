import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { effectScope, ref, nextTick } from "vue";
import { subscribeEntries } from "@/api/entries";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";
import { useEntries, ENTRIES_PAGE_SIZE } from "@/app/composables/useEntries";

vi.mock("@/api/entries", () => ({ subscribeEntries: vi.fn(() => vi.fn()) }));

function withScope(fn) {
  const scope = effectScope();
  const result = scope.run(fn);
  return { ...result, dispose: () => scope.stop() };
}

beforeEach(() => {
  vi.clearAllMocks();
  subscribeEntries.mockImplementation(() => vi.fn());
  const { babies, selectBaby } = useSelectedBaby();
  babies.value = [{ id: "primary", babyName: "Alex" }];
  selectBaby("primary");
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useEntries", () => {
  it("stays loading with no error while householdId is empty", () => {
    const householdId = ref("");
    const { loading, error } = withScope(() => useEntries(householdId));
    expect(loading.value).toBe(true);
    expect(error.value).toBeNull();
    expect(subscribeEntries).not.toHaveBeenCalled();
  });

  it("subscribes once householdId has a value, with the default page size", () => {
    const householdId = ref("house1");
    withScope(() => useEntries(householdId));
    expect(subscribeEntries).toHaveBeenCalledWith("house1", expect.any(Function), expect.any(Function), { max: ENTRIES_PAGE_SIZE });
  });

  it("honours a custom max", () => {
    const householdId = ref("house1");
    withScope(() => useEntries(householdId, { max: 10 }));
    expect(subscribeEntries).toHaveBeenCalledWith("house1", expect.any(Function), expect.any(Function), { max: 10 });
  });

  it("populates entries and stops loading once data arrives", () => {
    const householdId = ref("house1");
    const { loading, raw } = withScope(() => useEntries(householdId));
    const onData = subscribeEntries.mock.calls[0][1];
    onData([{ id: "e1", babyId: "primary" }]);
    expect(loading.value).toBe(false);
    expect(raw.value).toEqual([{ id: "e1", babyId: "primary" }]);
  });

  it("filters entries down to the selected baby, treating a missing babyId as 'primary'", () => {
    const householdId = ref("house1");
    const { entries } = withScope(() => useEntries(householdId));
    const onData = subscribeEntries.mock.calls[0][1];
    onData([
      { id: "e1", babyId: "baby2" },
      { id: "e2" }, // no babyId -> counts as primary
      { id: "e3", babyId: "primary" },
    ]);
    expect(entries.value.map((e) => e.id).sort()).toEqual(["e2", "e3"]);
  });

  it("does not expose an archived baby's entries when there is no active baby", () => {
    const { babies, selectBaby } = useSelectedBaby();
    babies.value = [];
    selectBaby("");
    const householdId = ref("house1");
    const { entries } = withScope(() => useEntries(householdId));
    subscribeEntries.mock.calls[0][1]([{ id: "e1", babyId: "primary" }]);
    expect(entries.value).toEqual([]);
  });

  it("surfaces a subscription error", () => {
    const householdId = ref("house1");
    const { error, loading } = withScope(() => useEntries(householdId));
    const onError = subscribeEntries.mock.calls[0][2];
    onError({ code: "permission-denied" });
    expect(error.value).toEqual({ code: "permission-denied" });
    expect(loading.value).toBe(false);
  });

  it("fails with a timeout if nothing arrives within 15s", () => {
    const householdId = ref("house1");
    const { error, loading } = withScope(() => useEntries(householdId));
    vi.advanceTimersByTime(15000);
    expect(error.value).toEqual({ code: "timeout" });
    expect(loading.value).toBe(false);
  });

  it("does not time out if data arrives before the deadline", () => {
    const householdId = ref("house1");
    const { error, loading, raw } = withScope(() => useEntries(householdId));
    const onData = subscribeEntries.mock.calls[0][1];
    onData([]);
    vi.advanceTimersByTime(15000);
    expect(error.value).toBeNull();
    expect(loading.value).toBe(false);
  });

  it("ignores a stale callback after the householdId changes", async () => {
    const householdId = ref("house1");
    const { raw } = withScope(() => useEntries(householdId));
    const firstOnData = subscribeEntries.mock.calls[0][1];
    householdId.value = "house2";
    await nextTick();
    firstOnData([{ id: "stale" }]);
    expect(raw.value).toEqual([]);
  });

  it("re-subscribes with the new id, unsubscribing the previous listener", async () => {
    const stop1 = vi.fn();
    const stop2 = vi.fn();
    subscribeEntries.mockImplementationOnce(() => stop1).mockImplementationOnce(() => stop2);
    const householdId = ref("house1");
    withScope(() => useEntries(householdId));
    householdId.value = "house2";
    await nextTick();
    expect(stop1).toHaveBeenCalled();
    expect(subscribeEntries).toHaveBeenNthCalledWith(2, "house2", expect.any(Function), expect.any(Function), { max: ENTRIES_PAGE_SIZE });
  });

  it("retry re-runs start() from scratch", () => {
    const householdId = ref("house1");
    const { retry, raw } = withScope(() => useEntries(householdId));
    subscribeEntries.mock.calls[0][1]([{ id: "e1" }]);
    retry();
    expect(raw.value).toEqual([]);
    expect(subscribeEntries).toHaveBeenCalledTimes(2);
  });

  it("stop() unsubscribes and clears the pending timeout", () => {
    const householdId = ref("house1");
    const { stop } = withScope(() => useEntries(householdId));
    const unsub = subscribeEntries.mock.results[0].value;
    stop();
    expect(unsub).toHaveBeenCalled();
    vi.advanceTimersByTime(15000); // should not throw / set error after stop
  });

  it("unsubscribes automatically when the owning scope is disposed", () => {
    const householdId = ref("house1");
    const { dispose } = withScope(() => useEntries(householdId));
    const unsub = subscribeEntries.mock.results[0].value;
    dispose();
    expect(unsub).toHaveBeenCalled();
  });
});
