import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasMapsKey, installAuthHook, mapsState, resetAuthHookForTests, resetMapsState } from "@/app/api/mapsState";

describe("hasMapsKey", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["   ", false],
    ["PASTE_MAPS_KEY", false],
    ["paste-here", false],
    ["your-google-maps-browser-key", false],
    ["AIzaSyA1234567890abcdefghijklmnopqrstu", true],
  ])("%j gives %s", (key, expected) => {
    expect(hasMapsKey(key)).toBe(expected);
  });
});

describe("mapsState transitions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "AIzaTestKey1234567890");
    resetMapsState();
    resetAuthHookForTests();
    delete window.gm_authFailure;
    delete globalThis.google;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    document.head.querySelectorAll("script").forEach((s) => s.remove());
  });

  it("starts at loading with a key and no-key without one", () => {
    expect(mapsState.value).toBe("loading");
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "PASTE_MAPS_KEY");
    resetMapsState();
    expect(mapsState.value).toBe("no-key");
  });
  it("flips to failed when Google calls gm_authFailure", () => {
    installAuthHook();
    window.gm_authFailure();
    expect(mapsState.value).toBe("failed");
  });
  it("rejects with no-key and never adds a script", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const { loadGoogleMaps } = await import("@/app/api/googleMaps");
    const state = await import("@/app/api/mapsState");
    await expect(loadGoogleMaps()).rejects.toThrow();
    expect(state.mapsState.value).toBe("no-key");
    expect(document.head.querySelector("script[src*='maps.googleapis']")).toBeNull();
  });
  it("fails when the script errors", async () => {
    const { loadGoogleMaps } = await import("@/app/api/googleMaps");
    const state = await import("@/app/api/mapsState");
    const pending = loadGoogleMaps();
    document.head.querySelector("script[src*='maps.googleapis']").onerror();
    await expect(pending).rejects.toThrow();
    expect(state.mapsState.value).toBe("failed");
  });
  it("fails on the 10 second timeout", async () => {
    vi.useFakeTimers();
    const { loadGoogleMaps } = await import("@/app/api/googleMaps");
    const state = await import("@/app/api/mapsState");
    const pending = loadGoogleMaps();
    const caught = pending.catch((e) => e);
    await vi.advanceTimersByTimeAsync(10000);
    expect((await caught).message).toMatch(/too long/);
    expect(state.mapsState.value).toBe("failed");
  });
  it("becomes ready when the script calls back", async () => {
    const { loadGoogleMaps } = await import("@/app/api/googleMaps");
    const state = await import("@/app/api/mapsState");
    const pending = loadGoogleMaps();
    const src = document.head.querySelector("script[src*='maps.googleapis']").src;
    globalThis.google = { maps: {} };
    globalThis[new URL(src).searchParams.get("callback")]();
    await pending;
    expect(state.mapsState.value).toBe("ready");
  });
});
