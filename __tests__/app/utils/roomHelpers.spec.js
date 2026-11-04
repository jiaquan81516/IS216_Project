import { describe, it, expect } from "vitest";
import {
  statusText,
  ROOM_FEATURES,
  featureLabels,
  featureMap,
  BASEMENT_FLOORS,
  UPPER_FLOORS,
  roomDetails,
  daysSince,
  roomView,
  tidyCaps,
} from "@/app/utils/roomHelpers";

describe("statusText", () => {
  it("is 'Pending review' when approval is pending, regardless of status", () => {
    expect(statusText({ approval: "pending", status: "verified" })).toBe("Pending review");
  });

  it("is 'Needs verification' when status is not verified", () => {
    expect(statusText({ status: "needs verification" })).toBe("Needs verification");
  });

  it("is 'Verified today'/'Verified 1 day ago' for 0/1 days", () => {
    expect(statusText({ status: "verified", verifiedDaysAgo: 0 })).toBe("Verified today");
    expect(statusText({ status: "verified", verifiedDaysAgo: 1 })).toBe("Verified 1 day ago");
  });

  it("is 'Verified N days ago' otherwise, treating a missing count as 0", () => {
    expect(statusText({ status: "verified", verifiedDaysAgo: 7 })).toBe("Verified 7 days ago");
    expect(statusText({ status: "verified" })).toBe("Verified 0 days ago");
  });
});

describe("featureLabels / featureMap round-trip", () => {
  it("featureLabels reads a Firestore feature map into labels, in canonical order", () => {
    expect(featureLabels({ power: true, chair: true })).toEqual(["Chair", "Power outlet"]);
  });

  it("featureLabels passes an array straight through as strings", () => {
    expect(featureLabels(["Sink", "Chair"])).toEqual(["Sink", "Chair"]);
  });

  it("featureLabels returns [] for null/undefined/non-object", () => {
    expect(featureLabels(null)).toEqual([]);
    expect(featureLabels(undefined)).toEqual([]);
  });

  it("featureMap builds a full feature map with only the chosen keys true", () => {
    expect(featureMap(["Chair", "Sink"])).toEqual({
      chair: true, power: false, lockable: false, sink: true, stroller: false,
    });
  });

  it("featureMap defaults to an all-false map when nothing is chosen", () => {
    expect(featureMap()).toEqual({ chair: false, power: false, lockable: false, sink: false, stroller: false });
  });

  it("round-trips labels -> map -> labels", () => {
    const labels = ["Lockable", "Stroller access"];
    expect(featureLabels(featureMap(labels)).sort()).toEqual([...labels].sort());
  });

  it("ROOM_FEATURES is frozen and has 5 entries", () => {
    expect(Object.isFrozen(ROOM_FEATURES)).toBe(true);
    expect(ROOM_FEATURES).toHaveLength(5);
  });
});

describe("floor lists", () => {
  it("BASEMENT_FLOORS runs deepest-sounding first as given (B3, B2, B1)", () => {
    expect(BASEMENT_FLOORS).toEqual(["Basement 3", "Basement 2", "Basement 1"]);
  });

  it("UPPER_FLOORS has 12 levels then Rooftop", () => {
    expect(UPPER_FLOORS).toHaveLength(13);
    expect(UPPER_FLOORS[0]).toBe("Level 1");
    expect(UPPER_FLOORS[11]).toBe("Level 12");
    expect(UPPER_FLOORS[12]).toBe("Rooftop");
  });
});

describe("roomDetails", () => {
  it("is just the floor when there is no landmark", () => {
    expect(roomDetails("Level 3")).toBe("Level 3");
    expect(roomDetails("Level 3", "")).toBe("Level 3");
    expect(roomDetails("Level 3", "   ")).toBe("Level 3");
  });

  it("appends a trimmed landmark", () => {
    expect(roomDetails("Level 3", "  the lifts  ")).toBe("Level 3, near the lifts");
  });
});

describe("daysSince", () => {
  it("returns null when value is not a usable date", () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince(undefined)).toBeNull();
  });

  it("returns whole days elapsed", () => {
    const now = new Date("2026-11-04T12:00:00Z");
    const then = new Date("2026-11-01T12:00:00Z");
    expect(daysSince(then, now)).toBe(3);
  });

  it("floors partial days", () => {
    const now = new Date("2026-11-04T23:00:00Z");
    const then = new Date("2026-11-04T01:00:00Z");
    expect(daysSince(then, now)).toBe(0);
  });

  it("clamps a future timestamp to 0, never negative", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    const future = new Date("2026-11-05T00:00:00Z");
    expect(daysSince(future, now)).toBe(0);
  });
});

describe("roomView", () => {
  it("normalises a verified room, computing verifiedDaysAgo", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    const data = {
      name: "Raffles City", address: "252 North Bridge Rd", details: "Level 3",
      lat: 1.3, lng: 103.8, status: "verified", verifiedAt: new Date("2026-11-01T00:00:00Z"),
      features: { chair: true },
    };
    const out = roomView("r1", data, now);
    expect(out).toMatchObject({
      id: "r1", name: "Raffles City", address: "252 North Bridge Rd", details: "Level 3",
      lat: 1.3, lng: 103.8, status: "verified", verifiedDaysAgo: 3, features: ["Chair"],
      approval: "approved", seed: false,
    });
  });

  it("defaults status to 'needs verification' and verifiedDaysAgo to null when not verified", () => {
    const out = roomView("r2", { name: "X" });
    expect(out.status).toBe("needs verification");
    expect(out.verifiedDaysAgo).toBeNull();
  });

  it("coerces missing/invalid lat/lng to null rather than NaN", () => {
    const out = roomView("r3", { lat: "oops", lng: undefined });
    expect(out.lat).toBeNull();
    expect(out.lng).toBeNull();
  });

  it("defaults approval to 'approved' when absent, and respects an explicit value", () => {
    expect(roomView("r4", {}).approval).toBe("approved");
    expect(roomView("r5", { approval: "pending" }).approval).toBe("pending");
  });

  it("always marks the result as not a seed room", () => {
    expect(roomView("r6", { seed: true }).seed).toBe(false);
  });
});

describe("tidyCaps", () => {
  it("title-cases an all-caps string", () => {
    expect(tidyCaps("31 BENCOOLEN STREET")).toBe("31 Bencoolen Street");
  });

  it("leaves mixed-case text alone", () => {
    expect(tidyCaps("Raffles City")).toBe("Raffles City");
  });

  it("leaves lowercase text alone", () => {
    expect(tidyCaps("already lower")).toBe("already lower");
  });

  it("keeps known acronyms upper (MRT, NUS, HDB)", () => {
    expect(tidyCaps("NEAR NUS MRT STATION")).toBe("Near NUS MRT Station");
  });

  it("keeps a station-code-like word with a digit upper", () => {
    expect(tidyCaps("EXIT DT21 NOW")).toBe("Exit DT21 Now");
  });

  it("returns '' for empty/null/undefined", () => {
    expect(tidyCaps("")).toBe("");
    expect(tidyCaps(null)).toBe("");
    expect(tidyCaps(undefined)).toBe("");
  });

  it("handles a string with no letters unchanged", () => {
    expect(tidyCaps("123")).toBe("123");
  });
});
