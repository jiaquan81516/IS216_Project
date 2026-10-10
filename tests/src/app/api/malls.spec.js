import { describe, expect, it } from "vitest";
import { loadMalls, mallToRoom, MALL_LABEL } from "@/app/api/malls";
import { FALLBACK_MALLS } from "@/app/data/malls.fallback";
import { verificationText } from "@/app/api/mapHelpers";

const fixture = [
  { name: "Test Mall", address: "1 Test Road, Singapore 000001", lat: 1.3, lng: 103.8 },
  { name: "Test Mall", address: "duplicate", lat: 1.3, lng: 103.8 },
  { name: "No Coordinates", address: "x" },
  { name: "", address: "x", lat: 1.3, lng: 103.8 },
];

describe("malls loader", () => {
  it("turns records into unconfirmed mall rooms, skipping duplicates and bad rows", async () => {
    const rooms = await loadMalls(fixture, { name: "Fixture", url: "https://example.test" });
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({
      id: "mall-test-mall",
      kind: "mall",
      status: "mall",
      features: [],
      source: "Fixture",
      sourceUrl: "https://example.test",
    });
    expect(verificationText(rooms[0])).toBe(MALL_LABEL);
  });
  it("rejects a record without a finite position", () => {
    expect(mallToRoom({ name: "A", lat: "x", lng: 1 })).toBeNull();
  });
  it("ships a starter list of at most 25 malls with real looking coordinates in Singapore", async () => {
    const rooms = await loadMalls();
    expect(rooms.length).toBe(FALLBACK_MALLS.length);
    expect(rooms.length).toBeLessThanOrEqual(25);
    for (const r of rooms) {
      expect(r.lat).toBeGreaterThan(1.1);
      expect(r.lat).toBeLessThan(1.5);
      expect(r.lng).toBeGreaterThan(103.6);
      expect(r.lng).toBeLessThan(104.1);
    }
  });
});
