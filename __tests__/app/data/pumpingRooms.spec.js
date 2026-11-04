import { describe, it, expect } from "vitest";
import { SEED_ROOMS, SEED_COORDS, FILTER_FEATURES } from "@/app/data/pumpingRooms";

describe("SEED_ROOMS", () => {
  it("has unique ids and valid features from the filter list", () => {
    const ids = SEED_ROOMS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of SEED_ROOMS) {
      expect(r.name).toBeTruthy();
      expect(Array.isArray(r.features)).toBe(true);
      for (const f of r.features) expect(FILTER_FEATURES).toContain(f);
      expect(r.seed).toBe(true);
    }
  });

  it("has a matching coordinate entry for every seed room", () => {
    for (const r of SEED_ROOMS) {
      expect(SEED_COORDS[r.id]).toBeDefined();
      expect(typeof SEED_COORDS[r.id].lat).toBe("number");
      expect(typeof SEED_COORDS[r.id].lng).toBe("number");
    }
  });
});

describe("FILTER_FEATURES", () => {
  it("has no duplicate feature names", () => {
    expect(new Set(FILTER_FEATURES).size).toBe(FILTER_FEATURES.length);
  });
});
