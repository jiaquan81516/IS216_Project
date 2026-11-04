import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useLocate } from "@/app/composables/useLocate";

const originalGeo = globalThis.navigator?.geolocation;

afterEach(() => {
  if (originalGeo === undefined) delete globalThis.navigator.geolocation;
  else globalThis.navigator.geolocation = originalGeo;
});

describe("useLocate", () => {
  it("shows a message and does not set locating when geolocation is unavailable", () => {
    delete globalThis.navigator.geolocation;
    const { locating, message, locate } = useLocate();
    const onFix = vi.fn();
    locate(onFix);
    expect(locating.value).toBe(false);
    expect(message.value).toContain("not available");
    expect(onFix).not.toHaveBeenCalled();
  });

  it("sets locating, then calls onFix with lat/lng on success", () => {
    globalThis.navigator.geolocation = {
      getCurrentPosition: (success) => success({ coords: { latitude: 1.3, longitude: 103.8 } }),
    };
    const { locating, locate } = useLocate();
    const onFix = vi.fn();
    locate(onFix);
    expect(onFix).toHaveBeenCalledWith({ lat: 1.3, lng: 103.8 });
    expect(locating.value).toBe(false);
  });

  it("maps PERMISSION_DENIED (code 1) to a blocked-location message", () => {
    globalThis.navigator.geolocation = {
      getCurrentPosition: (_success, failure) => failure({ code: 1 }),
    };
    const { message, locate } = useLocate();
    locate(vi.fn());
    expect(message.value).toContain("blocked");
  });

  it("maps TIMEOUT (code 3) to a timed-out message", () => {
    globalThis.navigator.geolocation = {
      getCurrentPosition: (_success, failure) => failure({ code: 3 }),
    };
    const { message, locate } = useLocate();
    locate(vi.fn());
    expect(message.value).toContain("took too long");
  });

  it("maps any other failure to a generic message", () => {
    globalThis.navigator.geolocation = {
      getCurrentPosition: (_success, failure) => failure({ code: 2 }),
    };
    const { message, locate } = useLocate();
    locate(vi.fn());
    expect(message.value).toContain("could not find");
  });

  it("clears any previous message on a fresh call", () => {
    globalThis.navigator.geolocation = {
      getCurrentPosition: (_success, failure) => failure({ code: 1 }),
    };
    const { message, locate } = useLocate();
    locate(vi.fn());
    expect(message.value).not.toBe("");
    globalThis.navigator.geolocation.getCurrentPosition = (success) => success({ coords: { latitude: 1, longitude: 1 } });
    locate(vi.fn());
    expect(message.value).toBe("");
  });

  it("passes a 10s timeout and 60s maximumAge to getCurrentPosition", () => {
    const getCurrentPosition = vi.fn();
    globalThis.navigator.geolocation = { getCurrentPosition };
    const { locate } = useLocate();
    locate(vi.fn());
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function), expect.any(Function), { timeout: 10000, maximumAge: 60000 },
    );
  });
});
