import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  byName,
  clinicToPlace,
  countText,
  embedUrl,
  filterPlaces,
  formatDate,
  oneMapPlaceUrl,
  normalizeView,
  telHref,
} from "@/app/api/kidsCareHelpers";
import { shapeSnapshot, loadChasClinics } from "@/app/api/chasClinics";
import { sortByDistance } from "@/app/api/mapHelpers";

const places = [
  { id: "a", name: "Zeta Clinic", address: "1 Road, Singapore 111111", postal: "111111", lat: 1.30, lng: 103.80, type: "gp" },
  { id: "b", name: "Alpha Clinic", address: "2 Lane, Singapore 222222", postal: "222222", lat: 1.40, lng: 103.90, type: "gp" },
  { id: "c", name: "Bright Dental", address: "3 Way, Singapore 333333", postal: "333333", lat: 1.31, lng: 103.81, type: "dental" },
];

describe("kids care helpers", () => {
  it("normalises the view and defaults to emergency", () => {
    expect(normalizeView("clinics")).toBe("clinics");
    expect(normalizeView(["clinics"])).toBe("clinics");
    expect(normalizeView("nope")).toBe("emergency");
    expect(normalizeView(undefined)).toBe("emergency");
  });
  it("builds the OneMap embed url", () => {
    expect(embedUrl(null)).toBe("https://www.onemap.gov.sg/amm/amm.html?mapStyle=Default&zoomLevel=12&latLng=1.3521,103.8198");
    expect(embedUrl(places[0])).toBe(
      "https://www.onemap.gov.sg/amm/amm.html?mapStyle=Default&zoomLevel=15&latLng=1.3,103.8&marker=latLng:1.3,103.8!colour:red&popupWidth=200",
    );
  });
  it("builds the OneMap place link from coordinates", () => {
    expect(oneMapPlaceUrl(places[0].lat, places[0].lng)).toContain("https://www.onemap.gov.sg/amm/amm.html?");
    expect(oneMapPlaceUrl(null, null)).toBe("");
  });
  it("builds tel links", () => {
    expect(telHref("6357 8754")).toBe("tel:+6563578754");
    expect(telHref("+65 6357 8754")).toBe("tel:+6563578754");
    expect(telHref("995")).toBe("tel:995");
    expect(telHref("")).toBe("");
    expect(telHref(null)).toBe("");
    expect(telHref("abc")).toBe("");
  });
  it("filters by name, address and postal, hiding dental by default", () => {
    expect(filterPlaces(places).map((p) => p.id)).toEqual(["a", "b"]);
    expect(filterPlaces(places, { includeDental: true })).toHaveLength(3);
    expect(filterPlaces(places, { text: "alpha" }).map((p) => p.id)).toEqual(["b"]);
    expect(filterPlaces(places, { text: "lane" }).map((p) => p.id)).toEqual(["b"]);
    expect(filterPlaces(places, { text: "111111" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterPlaces(places, { text: "bright", includeDental: true })).toHaveLength(1);
    expect(filterPlaces(places, { text: "bright" })).toHaveLength(0);
  });
  it("sorts by name and by distance from a point", () => {
    expect(byName(places).map((p) => p.id)).toEqual(["b", "c", "a"]);
    const sorted = sortByDistance(places, { lat: 1.301, lng: 103.801 });
    expect(sorted.map((p) => p.id)).toEqual(["a", "c", "b"]);
    expect(sorted[0].distance).toBeGreaterThan(0);
  });
  it("formats counts, dates and page size", () => {
    expect(countText(1, "in Singapore")).toBe("1 place in Singapore");
    expect(countText(3, "near you")).toBe("3 places near you");
    expect(formatDate("2026-10-11")).toBe("11 October 2026");
    expect(formatDate(null)).toBe("");
    expect(PAGE_SIZE).toBe(50);
  });
  it("shapes a compact clinic into a place", () => {
    expect(clinicToPlace({ id: "X1", name: "N", address: "A", lat: 1.3, lng: 103.8, phone: "", type: "dental" })).toMatchObject({
      id: "chas-X1",
      phone: null,
      type: "dental",
      kind: "chas",
    });
  });
});

describe("CHAS snapshot loader", () => {
  it("drops bad rows and duplicates", () => {
    const snap = shapeSnapshot({ meta: { retrievedAt: "2026-10-11", count: 2 }, clinics: [{ id: "1", name: "A", address: "x" }, { id: "1", name: "A", address: "x" }, { name: "no id" }, null] });
    expect(snap.clinics).toHaveLength(1);
    expect(snap.meta.retrievedAt).toBe("2026-10-11");
  });
  it("returns an honest empty list when the file is empty or fails", async () => {
    expect((await loadChasClinics(async () => ({ default: { clinics: [] } }))).clinics).toEqual([]);
    const failed = await loadChasClinics(async () => {
      throw new Error("boom");
    });
    expect(failed.failed).toBe(true);
    expect(failed.clinics).toEqual([]);
  });
});
