import { describe, expect, it } from "vitest";
import { BMSG_ROOMS, BMSG_SOURCE } from "@/app/data/bmsgRooms";
import { ROOM_FEATURES } from "@/app/utils/roomHelpers";

const DASH = /[–—]/;
const strings = (value) => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
};

describe("BMSG directory data", () => {
  it("names the source", () => {
    expect(BMSG_SOURCE).toMatchObject({
      name: "Breastfeeding Mothers' Support Group, Nursing Room Directory",
      url: "https://breastfeeding.org.sg/nursing-room-directory/",
      retrieved: "2026-10-11",
      pageUpdated: "2026-04-13",
    });
    expect(BMSG_SOURCE.note).toContain("does not have jurisdiction");
  });
  it("has unique ids", () => {
    const ids = BMSG_ROOMS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("has finite coordinates inside Singapore and a non empty address", () => {
    for (const r of BMSG_ROOMS) {
      expect(Number.isFinite(r.lat)).toBe(true);
      expect(Number.isFinite(r.lng)).toBe(true);
      expect(r.lat).toBeGreaterThanOrEqual(1.15);
      expect(r.lat).toBeLessThanOrEqual(1.48);
      expect(r.lng).toBeGreaterThanOrEqual(103.6);
      expect(r.lng).toBeLessThanOrEqual(104.1);
      expect(r.address.trim()).not.toBe("");
      expect(r.name.trim()).not.toBe("");
    }
  });
  it("is verified, sourced and uses only known feature labels", () => {
    const labels = ROOM_FEATURES.map(([, label]) => label);
    for (const r of BMSG_ROOMS) {
      expect(r.status).toBe("verified");
      expect(r.source).toBeTruthy();
      expect(r.sourceUrl).toBeTruthy();
      expect(["mall", "public", "worship"]).toContain(r.kind);
      for (const f of r.features) expect(labels).toContain(f);
    }
  });
  it("leaves out the embassy, which the public cannot walk into", () => {
    expect(BMSG_ROOMS.some((r) => /embassy/i.test(r.name))).toBe(false);
  });
  it("has no em or en dashes in any string", () => {
    for (const text of [...strings(BMSG_SOURCE), ...BMSG_ROOMS.flatMap(strings)]) {
      expect(text).not.toMatch(DASH);
    }
  });
});
