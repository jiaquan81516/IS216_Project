import { describe, it, expect } from "vitest";
import {
  DEFAULT_CENTER,
  hasCoords,
  haversineMeters,
  formatDistance,
  sortByDistance,
  normalizeName,
  isDuplicate,
  mergeRooms,
  prepareCommunityRooms,
  isVerified,
  verificationText,
  applyFilters,
  activeFilterCount,
} from "@/app/utils/mapHelpers";

describe("DEFAULT_CENTER", () => {
  it("is Singapore and frozen", () => {
    expect(DEFAULT_CENTER).toEqual({ lat: 1.3521, lng: 103.8198 });
    expect(Object.isFrozen(DEFAULT_CENTER)).toBe(true);
  });
});

describe("hasCoords", () => {
  it("is true for finite lat/lng", () => {
    expect(hasCoords({ lat: 1.3, lng: 103.8 })).toBe(true);
  });
  it("is false for missing, null, NaN or non-numeric coords", () => {
    expect(hasCoords({})).toBe(false);
    expect(hasCoords(null)).toBe(false);
    expect(hasCoords(undefined)).toBe(false);
    expect(hasCoords({ lat: null, lng: 1 })).toBe(false);
    expect(hasCoords({ lat: NaN, lng: 1 })).toBe(false);
    expect(hasCoords({ lat: "1.3", lng: 103.8 })).toBe(false);
  });
});

describe("haversineMeters", () => {
  it("is 0 for identical points", () => {
    expect(haversineMeters({ lat: 1.3, lng: 103.8 }, { lat: 1.3, lng: 103.8 })).toBeCloseTo(0, 5);
  });

  it("matches a known distance (~1.11km per 0.01 degree latitude at the equator-ish)", () => {
    const d = haversineMeters({ lat: 1.3521, lng: 103.8198 }, { lat: 1.3621, lng: 103.8198 });
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1200);
  });

  it("is symmetric", () => {
    const a = { lat: 1.3, lng: 103.8 };
    const b = { lat: 1.35, lng: 103.9 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe("formatDistance", () => {
  it("rounds sub-km distances to the nearest 10m", () => {
    expect(formatDistance(847)).toBe("850 m");
    expect(formatDistance(4)).toBe("0 m");
    expect(formatDistance(0)).toBe("0 m");
  });

  it("shows km with one decimal at or above 1000m", () => {
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(2400)).toBe("2.4 km");
  });

  it("returns '' for invalid input", () => {
    expect(formatDistance(NaN)).toBe("");
    expect(formatDistance(-5)).toBe("");
    expect(formatDistance(undefined)).toBe("");
    expect(formatDistance(null)).toBe("");
  });

  it("boundary: exactly 995m rounds up to 1000 -> still under-km branch (1000 < 1000 is false) shows km", () => {
    // 995 rounds to 1000 (nearest 10), and 1000 is NOT < 1000, so it takes the km branch.
    expect(formatDistance(995)).toBe("1.0 km");
  });
});

describe("sortByDistance", () => {
  const origin = { lat: 1.3, lng: 103.8 };
  it("sorts nearest first", () => {
    const rooms = [
      { id: "far", name: "Far", lat: 1.5, lng: 103.8 },
      { id: "near", name: "Near", lat: 1.301, lng: 103.8 },
    ];
    const sorted = sortByDistance(rooms, origin);
    expect(sorted.map((r) => r.id)).toEqual(["near", "far"]);
    expect(sorted[0].distance).toBeLessThan(sorted[1].distance);
  });

  it("puts rooms without coordinates last, in name order", () => {
    const rooms = [
      { id: "b", name: "Bravo" },
      { id: "a", name: "Alpha", lat: 1.3, lng: 103.8 },
      { id: "c", name: "Charlie" },
    ];
    const sorted = sortByDistance(rooms, origin);
    expect(sorted.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(sorted[1].distance).toBeNull();
    expect(sorted[2].distance).toBeNull();
  });

  it("treats a missing origin the same as every room having no distance (sorted by name)", () => {
    const rooms = [
      { id: "b", name: "Bravo", lat: 1.3, lng: 103.8 },
      { id: "a", name: "Alpha", lat: 1.3, lng: 103.8 },
    ];
    const sorted = sortByDistance(rooms, null);
    expect(sorted.map((r) => r.id)).toEqual(["a", "b"]);
    expect(sorted.every((r) => r.distance === null)).toBe(true);
  });

  it("breaks a distance tie by name", () => {
    const rooms = [
      { id: "z", name: "Zulu", lat: 1.3, lng: 103.8 },
      { id: "a", name: "Alpha", lat: 1.3, lng: 103.8 },
    ];
    const sorted = sortByDistance(rooms, origin);
    expect(sorted.map((r) => r.id)).toEqual(["a", "z"]);
  });

  it("does not mutate the input array", () => {
    const rooms = [{ id: "a", name: "Alpha", lat: 1.3, lng: 103.8 }];
    const original = [...rooms];
    sortByDistance(rooms, origin);
    expect(rooms).toEqual(original);
    expect(rooms[0].distance).toBeUndefined();
  });
});

describe("normalizeName", () => {
  it("lowercases and strips filler words/punctuation", () => {
    expect(normalizeName("Raffles City Family Room")).toBe(normalizeName("Raffles City"));
  });

  it("maps & to 'and'", () => {
    expect(normalizeName("Mothers & Family")).toContain("and");
  });

  it("returns '' for empty/missing input", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName(undefined)).toBe("");
    expect(normalizeName(null)).toBe("");
  });

  it("strips all non-alphanumerics", () => {
    expect(normalizeName("A-B_C!!")).toBe("abc");
  });
});

describe("isDuplicate", () => {
  it("is true when placeId matches, regardless of distance/name", () => {
    expect(isDuplicate({ placeId: "p1", name: "A", lat: 0, lng: 0 }, { placeId: "p1", name: "Z", lat: 50, lng: 50 })).toBe(true);
  });

  it("is false when neither room has coordinates and placeIds differ/absent", () => {
    expect(isDuplicate({ name: "A" }, { name: "A" })).toBe(false);
  });

  it("is false when farther than 100m apart", () => {
    const a = { name: "Raffles City", lat: 1.3, lng: 103.8 };
    const b = { name: "Raffles City", lat: 1.31, lng: 103.8 };
    expect(isDuplicate(a, b)).toBe(false);
  });

  it("is true within 100m when normalized names match or contain one another", () => {
    const a = { name: "Raffles City Nursing Room", lat: 1.3, lng: 103.8 };
    const b = { name: "Raffles City", lat: 1.3, lng: 103.8 };
    expect(isDuplicate(a, b)).toBe(true);
  });

  it("is false within 100m when names are unrelated", () => {
    const a = { name: "Raffles City", lat: 1.3, lng: 103.8 };
    const b = { name: "Suntec City", lat: 1.3, lng: 103.8 };
    expect(isDuplicate(a, b)).toBe(false);
  });

  it("is false when a normalized name is empty (e.g. name was only filler words)", () => {
    const a = { name: "The Room", lat: 1.3, lng: 103.8 };
    const b = { name: "Family Room", lat: 1.3, lng: 103.8 };
    expect(isDuplicate(a, b)).toBe(false);
  });
});

describe("mergeRooms", () => {
  it("drops a listed/seed room that duplicates a real community room", () => {
    const community = [{ id: "c1", name: "Raffles City", lat: 1.3, lng: 103.8, seed: false }];
    const listed = [{ id: "l1", name: "Raffles City", lat: 1.3, lng: 103.8 }];
    const out = mergeRooms(community, listed);
    expect(out.map((r) => r.id)).toEqual(["c1"]);
  });

  it("orders real community rooms before listed rooms before seed rooms", () => {
    const community = [
      { id: "seed1", name: "Example Mall", seed: true },
      { id: "real1", name: "Real Mall", seed: false },
    ];
    const listed = [{ id: "listed1", name: "Listed Mall" }];
    const out = mergeRooms(community, listed);
    expect(out.map((r) => r.id)).toEqual(["real1", "listed1", "seed1"]);
  });

  it("keeps non-duplicate rooms from every tier", () => {
    const community = [{ id: "real1", name: "Alpha Mall", lat: 1.1, lng: 103.1, seed: false }];
    const listed = [{ id: "listed1", name: "Beta Mall", lat: 1.2, lng: 103.2 }];
    const out = mergeRooms(community, listed);
    expect(out).toHaveLength(2);
  });
});

describe("prepareCommunityRooms", () => {
  it("tags a non-seed room as kind:community, unchanged otherwise", () => {
    const [out] = prepareCommunityRooms([{ id: "a", seed: false, status: "verified" }]);
    expect(out.kind).toBe("community");
    expect(out.status).toBe("verified");
  });

  it("forces a seed room to needs-verification with null verifiedDaysAgo and applies seed coords", () => {
    const [out] = prepareCommunityRooms(
      [{ id: "s1", seed: true, status: "verified", verifiedDaysAgo: 5 }],
      { s1: { lat: 1.4, lng: 103.9 } },
    );
    expect(out.kind).toBe("seed");
    expect(out.status).toBe("needs verification");
    expect(out.verifiedDaysAgo).toBeNull();
    expect(out.lat).toBe(1.4);
    expect(out.lng).toBe(103.9);
  });
});

describe("isVerified", () => {
  it("is true only for a non-seed, verified room", () => {
    expect(isVerified({ seed: false, status: "verified" })).toBe(true);
    expect(isVerified({ seed: true, status: "verified" })).toBe(false);
    expect(isVerified({ seed: false, status: "needs verification" })).toBe(false);
  });
});

describe("verificationText", () => {
  it("prioritises pending approval over everything else", () => {
    expect(verificationText({ approval: "pending", seed: true, status: "verified" })).toBe("Pending review");
  });

  it("labels a seed room as an example, not confirmed", () => {
    expect(verificationText({ seed: true })).toBe("Example room, not confirmed");
  });

  it("says needs verification for an unverified real room", () => {
    expect(verificationText({ seed: false, status: "needs verification" })).toBe("Needs verification");
  });

  it("reports days since verification for a verified room", () => {
    expect(verificationText({ seed: false, status: "verified", verifiedDaysAgo: 0 })).toBe("Verified today");
    expect(verificationText({ seed: false, status: "verified", verifiedDaysAgo: 1 })).toBe("Verified 1 day ago");
    expect(verificationText({ seed: false, status: "verified", verifiedDaysAgo: 5 })).toBe("Verified 5 days ago");
    expect(verificationText({ seed: false, status: "verified", verifiedDaysAgo: null })).toBe("Verified 0 days ago");
  });
});

describe("applyFilters", () => {
  const rooms = [
    { id: "a", name: "Raffles City", address: "252 North Bridge Rd", details: "Level 3", features: ["Chair", "Power outlet"], status: "verified", seed: false },
    { id: "b", name: "Suntec", address: "3 Temasek Blvd", details: "Basement 1", features: ["Sink"], status: "needs verification", seed: false },
  ];

  it("filters by free text across name/address/details, case-insensitively", () => {
    expect(applyFilters(rooms, { text: "raffles" }).map((r) => r.id)).toEqual(["a"]);
    expect(applyFilters(rooms, { text: "TEMASEK" }).map((r) => r.id)).toEqual(["b"]);
    expect(applyFilters(rooms, { text: "level 3" }).map((r) => r.id)).toEqual(["a"]);
  });

  it("filters by required features (every feature must be present)", () => {
    expect(applyFilters(rooms, { features: ["Chair"] }).map((r) => r.id)).toEqual(["a"]);
    expect(applyFilters(rooms, { features: ["Chair", "Sink"] })).toEqual([]);
  });

  it("filters to verified-only rooms", () => {
    expect(applyFilters(rooms, { verifiedOnly: true }).map((r) => r.id)).toEqual(["a"]);
  });

  it("combines filters with AND semantics", () => {
    expect(applyFilters(rooms, { text: "raffles", verifiedOnly: true }).map((r) => r.id)).toEqual(["a"]);
    expect(applyFilters(rooms, { text: "raffles", verifiedOnly: true, features: ["Sink"] })).toEqual([]);
  });

  it("returns every room when no filter is active", () => {
    expect(applyFilters(rooms, {})).toHaveLength(2);
    expect(applyFilters(rooms)).toHaveLength(2);
  });
});

describe("activeFilterCount", () => {
  it("counts selected features plus one for verifiedOnly", () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ features: ["Chair"] })).toBe(1);
    expect(activeFilterCount({ features: ["Chair", "Sink"], verifiedOnly: true })).toBe(3);
  });
});
