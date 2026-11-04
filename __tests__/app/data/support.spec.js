import { describe, it, expect } from "vitest";
import { SUPPORT_GUIDES, TRUSTED_RESOURCES, contactHref } from "@/app/data/support";

describe("SUPPORT_GUIDES", () => {
  it("has unique slugs and well-formed entries", () => {
    expect(SUPPORT_GUIDES.length).toBeGreaterThan(0);
    const slugs = SUPPORT_GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of SUPPORT_GUIDES) {
      expect(g.title).toBeTruthy();
      expect(Array.isArray(g.steps)).toBe(true);
      expect(Array.isArray(g.callIf)).toBe(true);
    }
  });
});

describe("TRUSTED_RESOURCES", () => {
  it("has unique ids and a name/purpose for every contact", () => {
    const ids = TRUSTED_RESOURCES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of TRUSTED_RESOURCES) {
      expect(r.name).toBeTruthy();
      expect(r.purpose).toBeTruthy();
    }
  });
  it("gives every contact with a tel a tel: link", () => {
    for (const r of TRUSTED_RESOURCES.filter((r) => r.tel !== null)) {
      expect(r.tel).toMatch(/^tel:/);
    }
  });
});

describe("contactHref", () => {
  it("uses the built-in tel: link directly", () => {
    expect(contactHref({ tel: "tel:995", telLabel: "995" })).toBe("tel:995");
  });
  it("builds a link from telLabel digits when there's no tel", () => {
    expect(contactHref({ tel: null, telLabel: "6225 5554" })).toBe("tel:62255554");
  });
  it("keeps a leading + in the digits", () => {
    expect(contactHref({ tel: "", telLabel: "+65 9860 7453" })).toBe("tel:+6598607453");
  });
  it("returns null when there's nothing to dial", () => {
    expect(contactHref({ tel: null, telLabel: "" })).toBeNull();
    expect(contactHref({ tel: null, telLabel: null })).toBeNull();
  });
});
