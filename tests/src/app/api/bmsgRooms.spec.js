import { describe, expect, it } from "vitest";
import { bmsgToRoom, loadBmsgRooms } from "@/app/api/bmsgRooms";
import { BMSG_ROOMS } from "@/app/data/bmsgRooms";
import { isVerified, verificationText } from "@/app/api/mapHelpers";

const fixture = [
  { id: "bmsg-test", name: "Test Mall", address: "1 Test Road, Singapore 000001", lat: 1.3, lng: 103.8, kind: "mall", details: "Nursing room, Level 1", features: ["Sink"], facilities: ["Water dispenser"], feedback: "Clean." },
  { id: "bmsg-test", name: "Test Mall", address: "duplicate", lat: 1.3, lng: 103.8 },
  { id: "bmsg-nocoords", name: "No Coordinates", address: "x" },
  { id: "bmsg-noname", name: "", address: "x", lat: 1.3, lng: 103.8 },
];
const source = { name: "Fixture", shortName: "Fixture directory", url: "https://example.test", retrieved: "2026-10-11" };

describe("BMSG rooms loader", () => {
  it("turns records into verified rooms, skipping duplicates and bad rows", async () => {
    const now = new Date("2026-10-14T04:00:00Z");
    const rooms = await loadBmsgRooms(fixture, source, now);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({
      id: "bmsg-test",
      kind: "mall",
      status: "verified",
      features: ["Sink"],
      facilities: ["Water dispenser"],
      feedback: "Clean.",
      source: "Fixture",
      sourceLabel: "Fixture directory",
      sourceUrl: "https://example.test",
      verifiedDaysAgo: 3,
      seed: false,
    });
    expect(isVerified(rooms[0])).toBe(true);
    expect(verificationText(rooms[0])).toBe("Verified 3 days ago");
  });
  it("rejects a record without a finite position", () => {
    expect(bmsgToRoom({ id: "a", name: "A", lat: "x", lng: 1 })).toBeNull();
  });
  it("ships every directory room as a verified room", async () => {
    const rooms = await loadBmsgRooms();
    expect(rooms).toHaveLength(BMSG_ROOMS.length);
    expect(rooms.length).toBeGreaterThan(0);
    for (const r of rooms) {
      expect(r.status).toBe("verified");
      expect(isVerified(r)).toBe(true);
      expect(r.sourceUrl).toBe("https://breastfeeding.org.sg/nursing-room-directory/");
    }
  });
});
