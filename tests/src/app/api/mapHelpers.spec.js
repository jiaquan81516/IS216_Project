import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  applyFilters,
  clusterLabel,
  clusterRooms,
  formatDistance,
  haversineMeters,
  isDuplicate,
  mergeRooms,
  pinSvg,
  prepareCommunityRooms,
  sortByDistance,
  verificationText,
} from "@/app/api/mapHelpers";

const room = (over = {}) => ({
  id: "r1",
  name: "Room",
  address: "1 Road",
  details: "",
  placeId: "",
  lat: 1.3,
  lng: 103.85,
  features: [],
  status: "needs verification",
  kind: "community",
  seed: false,
  ...over,
});

describe("haversine and distance text", () => {
  it("is zero for the same point and about 111 km per degree of latitude", () => {
    expect(haversineMeters({ lat: 1.3, lng: 103.8 }, { lat: 1.3, lng: 103.8 })).toBe(0);
    const d = haversineMeters({ lat: 1, lng: 103.8 }, { lat: 2, lng: 103.8 });
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(111400);
  });
  it("formats metres and kilometres", () => {
    expect(formatDistance(850)).toBe("850 m");
    expect(formatDistance(852)).toBe("850 m");
    expect(formatDistance(2400)).toBe("2.4 km");
    expect(formatDistance(999.6)).toBe("1.0 km");
    expect(formatDistance(null)).toBe("");
  });
});

describe("sortByDistance", () => {
  it("puts the nearest first and rooms without coordinates last", () => {
    const rooms = [
      room({ id: "far", name: "Far", lat: 1.4, lng: 103.9 }),
      room({ id: "none", name: "None", lat: null, lng: null }),
      room({ id: "near", name: "Near", lat: 1.301, lng: 103.851 }),
    ];
    const sorted = sortByDistance(rooms, { lat: 1.3, lng: 103.85 });
    expect(sorted.map((r) => r.id)).toEqual(["near", "far", "none"]);
    expect(sorted[0].distance).toBeGreaterThan(0);
    expect(sorted[2].distance).toBeNull();
  });
  it("keeps name order when there is no origin", () => {
    const sorted = sortByDistance([room({ id: "b", name: "B" }), room({ id: "a", name: "A" })], null);
    expect(sorted.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("clusterRooms", () => {
  const close = [room({ id: "a", lat: 1.3, lng: 103.85 }), room({ id: "b", lat: 1.3001, lng: 103.8501 })];
  const far = room({ id: "c", lat: 1.43, lng: 103.78 });
  it("groups pins that share a grid cell and keeps distant ones apart", () => {
    const items = clusterRooms([...close, far], 12);
    const cluster = items.find((i) => i.count > 1);
    expect(cluster.count).toBe(2);
    expect(cluster.id.startsWith("cluster:")).toBe(true);
    expect(items.find((i) => i.id === "c").room.id).toBe("c");
    expect(clusterLabel(8)).toBe("8 rooms");
  });
  it("splits clusters when zoomed in and ignores rooms with no coordinates", () => {
    expect(clusterRooms(close, 17).every((i) => i.count === 1)).toBe(true);
    expect(clusterRooms([room({ lat: null, lng: null })], 12)).toEqual([]);
  });
});

describe("merge and de-duplicate", () => {
  const mall = (over) => room({ id: "bmsg-x", kind: "mall", status: "verified", ...over });
  it("drops a mall that matches a real room by placeId", () => {
    const real = room({ id: "fs1", name: "Mall nursing room", placeId: "P1", lat: 1.3, lng: 103.85 });
    const merged = mergeRooms([real], [mall({ name: "Other", placeId: "P1", lat: 1.5, lng: 103.9 })]);
    expect(merged.map((r) => r.id)).toEqual(["fs1"]);
  });
  it("drops a mall with a near identical name within 100 m but keeps one 1 km away", () => {
    const real = room({ id: "fs1", name: "Raffles City Family Room", lat: 1.2939, lng: 103.853 });
    const same = mall({ id: "m1", name: "Raffles City", lat: 1.29395, lng: 103.85305 });
    const away = mall({ id: "m2", name: "Raffles City", lat: 1.3039, lng: 103.853 });
    expect(isDuplicate(real, same)).toBe(true);
    expect(mergeRooms([real], [same, away]).map((r) => r.id)).toEqual(["fs1", "m2"]);
  });
  it("keeps real rooms first, then malls, then seeds that no mall covers", () => {
    const real = room({ id: "fs1", name: "Alpha Lounge", lat: 1.35, lng: 103.9 });
    const seedCovered = room({ id: "seed-raffles-city", name: "Raffles City Family Room", seed: true, kind: "seed", lat: 1.29389, lng: 103.85312 });
    const seedKept = room({ id: "seed-smu-library", name: "SMU Library Nursing Room", seed: true, kind: "seed", lat: 1.29666, lng: 103.8501 });
    const m = mall({ id: "m1", name: "Raffles City Shopping Centre", lat: 1.29389, lng: 103.85312 });
    expect(mergeRooms([seedCovered, seedKept, real], [m]).map((r) => r.id)).toEqual(["fs1", "m1", "seed-smu-library"]);
  });
  it("gives seed rooms coordinates and never a verified label", () => {
    const [seed] = prepareCommunityRooms(
      [{ id: "s", name: "S", seed: true, status: "verified", verifiedDaysAgo: 4, features: [] }],
      { s: { lat: 1.2, lng: 103.8 } },
    );
    expect(seed).toMatchObject({ lat: 1.2, lng: 103.8, kind: "seed", status: "needs verification" });
    expect(verificationText(seed)).toBe("Example room, not confirmed");
  });
});

describe("verification text and filters", () => {
  it("only a verified database room says Verified", () => {
    expect(verificationText(room({ status: "verified", verifiedDaysAgo: 0 }))).toBe("Verified today");
    expect(verificationText(room({ status: "verified", verifiedDaysAgo: 3 }))).toBe("Verified 3 days ago");
    expect(verificationText(room())).toBe("Needs verification");
    expect(verificationText(room({ kind: "mall", status: "verified", verifiedDaysAgo: 0 }))).toBe("Verified today");
  });
  it("filters by text, features and verified only", () => {
    const rooms = [
      room({ id: "a", name: "Alpha", features: ["Chair", "Sink"], status: "verified", verifiedDaysAgo: 1 }),
      room({ id: "b", name: "Beta", address: "Tampines", features: ["Chair"] }),
      room({ id: "m", name: "Gamma Mall", kind: "mall", status: "needs verification", features: [] }),
    ];
    expect(applyFilters(rooms, { text: "tampines" }).map((r) => r.id)).toEqual(["b"]);
    expect(applyFilters(rooms, { features: ["Chair", "Sink"] }).map((r) => r.id)).toEqual(["a"]);
    expect(applyFilters(rooms, { verifiedOnly: true }).map((r) => r.id)).toEqual(["a"]);
    const listed = room({ id: "bmsg-y", name: "Listed", kind: "mall", status: "verified", verifiedDaysAgo: 0 });
    expect(applyFilters([...rooms, listed], { verifiedOnly: true }).map((r) => r.id)).toEqual(["a", "bmsg-y"]);
    expect(activeFilterCount({ features: ["Chair"], verifiedOnly: true })).toBe(2);
  });
  it("draws a plum pin with no gradient", () => {
    const svg = pinSvg();
    expect(svg).toContain("#3B2F3F");
    expect(svg).not.toContain("Gradient");
  });
});
