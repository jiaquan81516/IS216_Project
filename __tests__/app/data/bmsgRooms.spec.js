import { describe, it, expect } from "vitest";
import { BMSG_ROOMS, BMSG_SOURCE } from "@/app/data/bmsgRooms";

describe("BMSG_ROOMS", () => {
  it("has one room per directory entry with a unique id", () => {
    expect(BMSG_ROOMS.length).toBe(6);
    const ids = BMSG_ROOMS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("bmsg-"))).toBe(true);
  });

  it("maps BMSG wording to the app's filter features, sorted and de-duplicated", () => {
    const raffles = BMSG_ROOMS.find((r) => r.name === "Raffles City Shopping Centre");
    expect(raffles.features).toEqual(["Power outlet", "Lockable", "Sink"]);
  });

  it("de-dupes 'Stroller access' when both single and double pram wording are present", () => {
    const waterway = BMSG_ROOMS.find((r) => r.name === "Waterway Point");
    expect(waterway.features.filter((f) => f === "Stroller access")).toHaveLength(1);
  });

  it("puts anything unmapped into facilities instead of features", () => {
    const raffles = BMSG_ROOMS.find((r) => r.name === "Raffles City Shopping Centre");
    expect(raffles.facilities).toEqual([
      "Diaper changing station", "Water dispenser", "Multiple nursing cubicles available", "Family-friendly access",
    ]);
  });

  it("joins type and level into details, or just the type when level is blank", () => {
    const raffles = BMSG_ROOMS.find((r) => r.name === "Raffles City Shopping Centre");
    expect(raffles.details).toBe("Nursing room, Level 3");
    const taka = BMSG_ROOMS.find((r) => r.name === "Takashimaya");
    expect(taka.details).toBe("Nursing room");
  });

  it("carries the BMSG source and a 'verified' status on every room", () => {
    for (const r of BMSG_ROOMS) {
      expect(r.source).toBe(BMSG_SOURCE.name);
      expect(r.sourceUrl).toBe(BMSG_SOURCE.url);
      expect(r.status).toBe("verified");
      expect(r.verifiedOn).toBe(BMSG_SOURCE.retrieved);
    }
  });

  it("gives every room valid Singapore coordinates and a non-empty address", () => {
    for (const r of BMSG_ROOMS) {
      expect(r.address).toBeTruthy();
      expect(r.lat).toBeGreaterThan(1);
      expect(r.lat).toBeLessThan(2);
      expect(r.lng).toBeGreaterThan(103);
      expect(r.lng).toBeLessThan(104.5);
    }
  });

  it("is deeply frozen", () => {
    expect(Object.isFrozen(BMSG_ROOMS)).toBe(true);
    expect(Object.isFrozen(BMSG_ROOMS[0])).toBe(true);
    expect(Object.isFrozen(BMSG_ROOMS[0].features)).toBe(true);
    expect(Object.isFrozen(BMSG_ROOMS[0].facilities)).toBe(true);
  });
});
