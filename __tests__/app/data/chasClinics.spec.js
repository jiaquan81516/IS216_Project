import { describe, it, expect } from "vitest";
import chasClinics from "@/app/data/chasClinics.json";

describe("chasClinics.json", () => {
  it("has a meta block whose count matches the clinics array length", () => {
    expect(Array.isArray(chasClinics.clinics)).toBe(true);
    expect(chasClinics.meta.count).toBe(chasClinics.clinics.length);
  });

  it("has unique clinic ids", () => {
    const ids = chasClinics.clinics.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every clinic a name, address and valid Singapore coordinates", () => {
    for (const c of chasClinics.clinics) {
      expect(c.name).toBeTruthy();
      expect(c.address).toBeTruthy();
      expect(typeof c.lat).toBe("number");
      expect(typeof c.lng).toBe("number");
      expect(c.lat).toBeGreaterThan(1);
      expect(c.lat).toBeLessThan(2);
      expect(c.lng).toBeGreaterThan(103);
      expect(c.lng).toBeLessThan(104.5);
    }
  });

  it("records a retrieval date and source on the dataset", () => {
    expect(chasClinics.meta.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(chasClinics.meta.sourceUrl).toMatch(/^https:\/\//);
  });
});
