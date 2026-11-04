import { describe, it, expect } from "vitest";
import {
  KIDS_VIEWS, DEFAULT_KIDS_VIEW, SAVED_KIDS_KEY, PAGE_SIZE,
  normalizeView, telHref, filterPlaces, byName, countText, formatDate, isStale, clinicToPlace,
} from "@/app/utils/kidsCareHelpers";

describe("constants", () => {
  it("KIDS_VIEWS has emergency and clinics, default is clinics", () => {
    expect(KIDS_VIEWS).toEqual(["emergency", "clinics"]);
    expect(DEFAULT_KIDS_VIEW).toBe("clinics");
  });
  it("PAGE_SIZE is 25", () => expect(PAGE_SIZE).toBe(25));
  it("SAVED_KIDS_KEY is namespaced", () => expect(SAVED_KIDS_KEY).toBe("nurturetrack:saved-kids-care"));
});

describe("normalizeView", () => {
  it("passes through a valid view", () => {
    expect(normalizeView("emergency")).toBe("emergency");
    expect(normalizeView("clinics")).toBe("clinics");
  });

  it("falls back to the default for an unknown value", () => {
    expect(normalizeView("bogus")).toBe(DEFAULT_KIDS_VIEW);
    expect(normalizeView(undefined)).toBe(DEFAULT_KIDS_VIEW);
    expect(normalizeView(null)).toBe(DEFAULT_KIDS_VIEW);
  });

  it("takes the first entry when given an array (e.g. a repeated query param)", () => {
    expect(normalizeView(["emergency", "clinics"])).toBe("emergency");
    expect(normalizeView(["bogus"])).toBe(DEFAULT_KIDS_VIEW);
  });
});

describe("telHref", () => {
  it("prefixes a local 8-digit number with +65", () => {
    expect(telHref("6357 8754")).toBe("tel:+6563578754");
  });

  it("keeps an explicit + international number as-is (digits only)", () => {
    expect(telHref("+65 6357 8754")).toBe("tel:+6563578754");
  });

  it("adds + to a bare 10-digit number already starting with 65", () => {
    expect(telHref("6563578754")).toBe("tel:+6563578754");
  });

  it("passes through a short number (e.g. a 3-digit emergency line) unprefixed", () => {
    expect(telHref("999")).toBe("tel:999");
  });

  it("returns '' for too-short or non-numeric input", () => {
    expect(telHref("12")).toBe("");
    expect(telHref("")).toBe("");
    expect(telHref(null)).toBe("");
    expect(telHref(undefined)).toBe("");
    expect(telHref("call us")).toBe("");
  });

  it("strips spaces, dashes and brackets", () => {
    expect(telHref("(6357) 8754")).toBe("tel:+6563578754");
    expect(telHref("6357-8754")).toBe("tel:+6563578754");
  });
});

describe("filterPlaces", () => {
  const places = [
    { name: "Family Clinic", address: "1 Street", postal: "123456", type: "gp" },
    { name: "Smile Dental", address: "2 Road", postal: "654321", type: "dental" },
  ];

  it("hides dental clinics by default", () => {
    expect(filterPlaces(places).map((p) => p.name)).toEqual(["Family Clinic"]);
  });

  it("includes dental clinics when asked", () => {
    expect(filterPlaces(places, { includeDental: true })).toHaveLength(2);
  });

  it("filters by text across name/address/postal, case-insensitively", () => {
    expect(filterPlaces(places, { includeDental: true, text: "smile" }).map((p) => p.name)).toEqual(["Smile Dental"]);
    expect(filterPlaces(places, { text: "123456" }).map((p) => p.name)).toEqual(["Family Clinic"]);
  });

  it("returns [] when text matches nothing", () => {
    expect(filterPlaces(places, { text: "nowhere" })).toEqual([]);
  });

  it("defaults to no filters when called with no options", () => {
    expect(filterPlaces(places)).toHaveLength(1); // dental still hidden by default
  });
});

describe("byName", () => {
  it("sorts alphabetically without mutating the input", () => {
    const places = [{ name: "Zebra" }, { name: "Alpha" }];
    const sorted = byName(places);
    expect(sorted.map((p) => p.name)).toEqual(["Alpha", "Zebra"]);
    expect(places.map((p) => p.name)).toEqual(["Zebra", "Alpha"]);
  });
});

describe("countText", () => {
  it("pluralises correctly", () => {
    expect(countText(1, "nearby")).toBe("1 place nearby");
    expect(countText(0, "nearby")).toBe("0 places nearby");
    expect(countText(5, "nearby")).toBe("5 places nearby");
  });
});

describe("formatDate", () => {
  it("formats YYYY-MM-DD as 'D Month YYYY'", () => {
    expect(formatDate("2026-11-04")).toBe("4 November 2026");
    expect(formatDate("2026-01-01")).toBe("1 January 2026");
  });

  it("tolerates extra trailing text after the date", () => {
    expect(formatDate("2026-11-04T00:00:00Z")).toBe("4 November 2026");
  });

  it("returns '' for an unparseable value", () => {
    expect(formatDate("not-a-date")).toBe("");
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
  });
});

describe("isStale", () => {
  const now = new Date("2026-11-04T00:00:00Z");

  it("is false for a recent date", () => {
    expect(isStale("2026-11-01", 90, now)).toBe(false);
  });

  it("is true once older than the given number of days", () => {
    expect(isStale("2026-01-01", 90, now)).toBe(true);
  });

  it("defaults the threshold to 90 days", () => {
    const justUnder = new Date(now.getTime() - 89 * 86400000).toISOString().slice(0, 10);
    const justOver = new Date(now.getTime() - 91 * 86400000).toISOString().slice(0, 10);
    expect(isStale(justUnder, undefined, now)).toBe(false);
    expect(isStale(justOver, undefined, now)).toBe(true);
  });

  it("is false for an unparseable date (never flagged stale)", () => {
    expect(isStale("not-a-date", 1, now)).toBe(false);
    expect(isStale(null, 1, now)).toBe(false);
  });
});

describe("clinicToPlace", () => {
  it("maps a CHAS clinic record into a place card", () => {
    const out = clinicToPlace({ id: "001", name: "Family Clinic", address: "1 St", postal: "123456", lat: 1.3, lng: 103.8, phone: "6357 8754", type: "gp" });
    expect(out).toEqual({
      id: "chas-001", name: "Family Clinic", address: "1 St", postal: "123456",
      lat: 1.3, lng: 103.8, phone: "6357 8754", type: "gp", kind: "chas",
    });
  });

  it("defaults postal to '' and phone to null when missing", () => {
    const out = clinicToPlace({ id: "002", name: "X", address: "Y" });
    expect(out.postal).toBe("");
    expect(out.phone).toBeNull();
  });

  it("coerces invalid lat/lng to null", () => {
    const out = clinicToPlace({ id: "003", name: "X", address: "Y", lat: "oops" });
    expect(out.lat).toBeNull();
    expect(out.lng).toBeNull();
  });

  it("normalises any non-'dental' type to 'gp'", () => {
    expect(clinicToPlace({ id: "004", name: "X", address: "Y", type: "polyclinic" }).type).toBe("gp");
    expect(clinicToPlace({ id: "005", name: "X", address: "Y", type: "dental" }).type).toBe("dental");
    expect(clinicToPlace({ id: "006", name: "X", address: "Y" }).type).toBe("gp");
  });
});
