import { describe, it, expect } from "vitest";
import { NAV, ADMIN_SECTIONS } from "@/app/data/nav";

describe("NAV", () => {
  it("has unique keys and valid groups", () => {
    const keys = NAV.map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(NAV.every((n) => ["primary", "secondary"].includes(n.group))).toBe(true);
  });
  it("gives every item a label, icon and route", () => {
    for (const item of NAV) {
      expect(item.label).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(item.to).toBeTruthy();
    }
  });
  it("is frozen", () => {
    expect(Object.isFrozen(NAV)).toBe(true);
  });
});

describe("ADMIN_SECTIONS", () => {
  it("has unique ids", () => {
    const ids = ADMIN_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("gives every section a label and icon", () => {
    for (const s of ADMIN_SECTIONS) {
      expect(s.label).toBeTruthy();
      expect(s.icon).toBeTruthy();
    }
  });
});
