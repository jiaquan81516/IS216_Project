import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import {
  browserCanPush, describePushError, disablePush, enablePush,
  listenPush, permissionState, refreshPush, vapidKey,
} from "@/api/push";
import { usePush, usePushMessages } from "@/app/composables/usePush";

vi.mock("@/api/push", () => ({
  browserCanPush: vi.fn(() => true),
  describePushError: vi.fn(() => "Push failed"),
  disablePush: vi.fn().mockResolvedValue(undefined),
  enablePush: vi.fn().mockResolvedValue(undefined),
  listenPush: vi.fn(() => vi.fn()),
  permissionState: vi.fn(() => "default"),
  refreshPush: vi.fn().mockResolvedValue(undefined),
  vapidKey: vi.fn(() => "a-vapid-key"),
}));

beforeEach(() => {
  vi.clearAllMocks();
  browserCanPush.mockReturnValue(true);
  permissionState.mockReturnValue("default");
  vapidKey.mockReturnValue("a-vapid-key");
  describePushError.mockReturnValue("Push failed");
  enablePush.mockResolvedValue(undefined);
  disablePush.mockResolvedValue(undefined);
  refreshPush.mockResolvedValue(undefined);
  listenPush.mockImplementation(() => vi.fn());
});

describe("usePush", () => {
  it("reports supported/configured/permission from the api layer", () => {
    const { supported, configured, permission } = usePush(() => "me1");
    expect(supported).toBe(true);
    expect(configured).toBe(true);
    expect(permission.value).toBe("default");
  });

  it("configured is false when there is no vapid key", () => {
    vapidKey.mockReturnValue("");
    const { configured } = usePush(() => "me1");
    expect(configured).toBe(false);
  });

  it("supported is false when the browser cannot push", () => {
    browserCanPush.mockReturnValue(false);
    const { supported } = usePush(() => "me1");
    expect(supported).toBe(false);
  });

  describe("enable", () => {
    it("calls enablePush with the uid from the given function, and refreshes permission", async () => {
      permissionState.mockReturnValueOnce("default").mockReturnValueOnce("granted");
      const { enable, permission, busy } = usePush(() => "me1");
      const ok = await enable();
      expect(ok).toBe(true);
      expect(enablePush).toHaveBeenCalledWith("me1");
      expect(permission.value).toBe("granted");
      expect(busy.value).toBe(false);
    });

    it("sets busy while in flight", async () => {
      let resolveEnable;
      enablePush.mockImplementationOnce(() => new Promise((resolve) => { resolveEnable = resolve; }));
      const { enable, busy } = usePush(() => "me1");
      const promise = enable();
      expect(busy.value).toBe(true);
      resolveEnable();
      await promise;
      expect(busy.value).toBe(false);
    });

    it("returns false and sets a friendly error on failure", async () => {
      enablePush.mockRejectedValueOnce({ code: "denied" });
      const { enable, error } = usePush(() => "me1");
      const ok = await enable();
      expect(ok).toBe(false);
      expect(error.value).toBe("Push failed");
    });

    it("clears any previous error on a fresh call", async () => {
      enablePush.mockRejectedValueOnce({ code: "denied" });
      const { enable, error } = usePush(() => "me1");
      await enable();
      expect(error.value).toBe("Push failed");
      enablePush.mockResolvedValueOnce(undefined);
      await enable();
      expect(error.value).toBe("");
    });
  });

  describe("disable", () => {
    it("calls disablePush with the uid and refreshes permission", async () => {
      permissionState.mockReturnValueOnce("granted").mockReturnValueOnce("default");
      const { disable, permission } = usePush(() => "me1");
      await disable();
      expect(disablePush).toHaveBeenCalledWith("me1");
      expect(permission.value).toBe("default");
    });

    it("still refreshes permission and clears busy even if disablePush throws", async () => {
      disablePush.mockRejectedValueOnce(new Error("boom"));
      const { disable, busy } = usePush(() => "me1");
      await expect(disable()).rejects.toThrow("boom");
      expect(busy.value).toBe(false);
    });
  });

  describe("refresh", () => {
    it("calls refreshPush with the current uid", () => {
      const { refresh } = usePush(() => "me1");
      refresh();
      expect(refreshPush).toHaveBeenCalledWith("me1");
    });

    it("reads the uid afresh each call, not just at setup time", () => {
      let current = "me1";
      const { refresh } = usePush(() => current);
      current = "me2";
      refresh();
      expect(refreshPush).toHaveBeenCalledWith("me2");
    });
  });
});

describe("usePushMessages", () => {
  function mountHost(handler) {
    const Host = defineComponent({
      setup() {
        usePushMessages(handler);
        return () => h("div");
      },
    });
    return mount(Host);
  }

  it("registers the handler via listenPush", () => {
    const handler = vi.fn();
    mountHost(handler);
    expect(listenPush).toHaveBeenCalledWith(handler);
  });

  it("stops listening on unmount", () => {
    const stop = vi.fn();
    listenPush.mockImplementationOnce(() => stop);
    const wrapper = mountHost(vi.fn());
    wrapper.unmount();
    expect(stop).toHaveBeenCalled();
  });
});
