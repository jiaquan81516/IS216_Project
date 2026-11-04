import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { subscribePendingRooms, subscribeReviewedRooms } from "@/api/roomApproval";
import { useAdminRooms } from "@/app/composables/useAdminRooms";

vi.mock("@/api/roomApproval", () => ({
  subscribePendingRooms: vi.fn(() => vi.fn()),
  subscribeReviewedRooms: vi.fn(() => vi.fn()),
}));

function mountHost() {
  let api;
  const Host = defineComponent({
    setup() {
      api = useAdminRooms();
      return () => h("div");
    },
  });
  return { wrapper: mount(Host), api: () => api };
}

beforeEach(() => {
  vi.clearAllMocks();
  subscribePendingRooms.mockImplementation(() => vi.fn());
  subscribeReviewedRooms.mockImplementation(() => vi.fn());
});

describe("useAdminRooms", () => {
  it("starts both lists loading with nothing in them", () => {
    const { api } = mountHost();
    expect(api().pending.loading.value).toBe(true);
    expect(api().reviewed.loading.value).toBe(true);
    expect(api().pending.list.value).toEqual([]);
  });

  it("subscribes both lists on mount", () => {
    mountHost();
    expect(subscribePendingRooms).toHaveBeenCalledTimes(1);
    expect(subscribeReviewedRooms).toHaveBeenCalledTimes(1);
  });

  it("populates pending rooms independently of reviewed rooms", () => {
    const { api } = mountHost();
    const onPendingData = subscribePendingRooms.mock.calls[0][0];
    onPendingData([{ id: "r1" }]);
    expect(api().pending.list.value).toEqual([{ id: "r1" }]);
    expect(api().pending.loading.value).toBe(false);
    expect(api().reviewed.loading.value).toBe(true);
  });

  it("surfaces a friendly error distinct per list", () => {
    const { api } = mountHost();
    const onPendingError = subscribePendingRooms.mock.calls[0][1];
    onPendingError();
    expect(api().pending.error.value).toContain("Pending rooms");
    expect(api().reviewed.error.value).toBe("");
  });

  it("clears an error once good data arrives", () => {
    const { api } = mountHost();
    const [onData, onError] = subscribePendingRooms.mock.calls[0];
    onError();
    expect(api().pending.error.value).not.toBe("");
    onData([{ id: "r1" }]);
    expect(api().pending.error.value).toBe("");
  });

  it("unsubscribes both lists on unmount", () => {
    const stopPending = vi.fn();
    const stopReviewed = vi.fn();
    subscribePendingRooms.mockImplementationOnce(() => stopPending);
    subscribeReviewedRooms.mockImplementationOnce(() => stopReviewed);
    const { wrapper } = mountHost();
    wrapper.unmount();
    expect(stopPending).toHaveBeenCalled();
    expect(stopReviewed).toHaveBeenCalled();
  });
});
