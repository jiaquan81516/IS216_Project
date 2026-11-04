import { describe, it, expect, beforeEach, vi } from "vitest";
import { LEGACY_ROTA_KEY, LEGACY_CALENDAR_KEY, readLegacy, clearLegacy, legacyOwner } from "@/app/utils/legacy";

describe("legacy keys", () => {
  it("are distinct, namespaced strings", () => {
    expect(LEGACY_ROTA_KEY).toBe("nt.app.rota");
    expect(LEGACY_CALENDAR_KEY).toBe("nt.app.calendar");
  });
});

describe("readLegacy", () => {
  beforeEach(() => localStorage.clear());

  it("returns the parsed object when present", () => {
    localStorage.setItem("k", JSON.stringify({ a: 1 }));
    expect(readLegacy("k")).toEqual({ a: 1 });
  });

  it("returns null when nothing is stored", () => {
    expect(readLegacy("missing")).toBeNull();
  });

  it("returns null for malformed JSON instead of throwing", () => {
    localStorage.setItem("k", "{not json");
    expect(readLegacy("k")).toBeNull();
  });

  it("returns null when the stored value is not an object (e.g. a bare number or string)", () => {
    localStorage.setItem("k", JSON.stringify(42));
    expect(readLegacy("k")).toBeNull();
    localStorage.setItem("k2", JSON.stringify("hello"));
    expect(readLegacy("k2")).toBeNull();
  });

  it("returns null when localStorage throws (blocked storage)", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(readLegacy("k")).toBeNull();
    spy.mockRestore();
  });
});

describe("clearLegacy", () => {
  beforeEach(() => localStorage.clear());

  it("removes the stored key", () => {
    localStorage.setItem("k", "x");
    clearLegacy("k");
    expect(localStorage.getItem("k")).toBeNull();
  });

  it("does not throw when localStorage.removeItem is blocked", () => {
    const spy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => clearLegacy("k")).not.toThrow();
    spy.mockRestore();
  });
});

describe("legacyOwner", () => {
  it("passes through 'both' and 'open' unchanged", () => {
    expect(legacyOwner("both", "me1", "p1")).toBe("both");
    expect(legacyOwner("open", "me1", "p1")).toBe("open");
  });

  it("maps 'me' to meUid, or null when meUid is unknown", () => {
    expect(legacyOwner("me", "me1", "p1")).toBe("me1");
    expect(legacyOwner("me", "", "p1")).toBeNull();
    expect(legacyOwner("me", null, "p1")).toBeNull();
  });

  it("maps 'partner' to partnerUid, or null when partnerUid is unknown", () => {
    expect(legacyOwner("partner", "me1", "p1")).toBe("p1");
    expect(legacyOwner("partner", "me1", "")).toBeNull();
  });

  it("returns null for anything else", () => {
    expect(legacyOwner("other", "me1", "p1")).toBeNull();
    expect(legacyOwner(undefined, "me1", "p1")).toBeNull();
    expect(legacyOwner("", "me1", "p1")).toBeNull();
  });
});
