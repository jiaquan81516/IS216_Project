import { describe, it, expect } from "vitest";
import { KIDS_EMERGENCY, KIDS_EMERGENCY_NUMBERS, RETRIEVED_AT } from "@/app/data/kidsEmergency";

describe("KIDS_EMERGENCY", () => {
  it("has at least one entry, each with an id, name, address and coordinates", () => {
    expect(KIDS_EMERGENCY.length).toBeGreaterThan(0);
    for (const e of KIDS_EMERGENCY) {
      expect(e.id).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.address).toBeTruthy();
      expect(typeof e.lat).toBe("number");
      expect(typeof e.lng).toBe("number");
      // Singapore's bounding box, roughly
      expect(e.lat).toBeGreaterThan(1);
      expect(e.lat).toBeLessThan(2);
      expect(e.lng).toBeGreaterThan(103);
      expect(e.lng).toBeLessThan(104.5);
    }
  });
  it("has unique ids", () => {
    const ids = KIDS_EMERGENCY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("gives every entry a valid retrievedAt matching RETRIEVED_AT or its own date format", () => {
    for (const e of KIDS_EMERGENCY) expect(e.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(RETRIEVED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("KIDS_EMERGENCY_NUMBERS", () => {
  it("has the Singapore ambulance numbers", () => {
    expect(KIDS_EMERGENCY_NUMBERS.ambulance).toBe("995");
    expect(KIDS_EMERGENCY_NUMBERS.nonEmergencyAmbulance).toBe("1777");
  });
});
