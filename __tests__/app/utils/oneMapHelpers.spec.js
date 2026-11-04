import { describe, it, expect } from "vitest";
import { ONEMAP_HOME_URL, ONEMAP_CENTER, ONEMAP_ISLAND_ZOOM, ONEMAP_PLACE_ZOOM, oneMapEmbedUrl, oneMapPlaceUrl } from "@/app/utils/oneMapHelpers";

describe("constants", () => {
  it("ONEMAP_HOME_URL points at onemap.gov.sg", () => {
    expect(ONEMAP_HOME_URL).toBe("https://www.onemap.gov.sg/");
  });
  it("ONEMAP_CENTER is Singapore and frozen", () => {
    expect(ONEMAP_CENTER).toEqual({ lat: 1.3521, lng: 103.8198 });
    expect(Object.isFrozen(ONEMAP_CENTER)).toBe(true);
  });
});

describe("oneMapEmbedUrl", () => {
  it("defaults to the island view with no args", () => {
    const url = oneMapEmbedUrl();
    expect(url).toContain(`zoomLevel=${ONEMAP_ISLAND_ZOOM}`);
    expect(url).toContain(`latLng=${ONEMAP_CENTER.lat},${ONEMAP_CENTER.lng}`);
    expect(url).not.toContain("marker=");
  });

  it("centres on and marks a single lat/lng, zoomed to place level", () => {
    const url = oneMapEmbedUrl({ lat: 1.3, lng: 103.8 });
    expect(url).toContain(`zoomLevel=${ONEMAP_PLACE_ZOOM}`);
    expect(url).toContain("latLng=1.3,103.8");
    expect(url).toContain("marker=latLng:1.3,103.8!colour:red");
    expect(url).toContain("popupWidth=200");
  });

  it("uses a custom marker colour when given", () => {
    const url = oneMapEmbedUrl({ markers: [{ lat: 1.3, lng: 103.8, colour: "blue" }] });
    expect(url).toContain("colour:blue");
  });

  it("adds one marker per point in a markers array", () => {
    const url = oneMapEmbedUrl({ markers: [{ lat: 1.1, lng: 103.1 }, { lat: 1.2, lng: 103.2 }] });
    expect(url).toContain("marker=latLng:1.1,103.1!colour:red");
    expect(url).toContain("marker=latLng:1.2,103.2!colour:red");
    expect(url.match(/marker=/g)).toHaveLength(2);
  });

  it("falls back to the island centre and zoom for 3+ markers with no explicit centre", () => {
    const url = oneMapEmbedUrl({ markers: [{ lat: 1.1, lng: 103.1 }, { lat: 1.2, lng: 103.2 }, { lat: 1.3, lng: 103.3 }] });
    expect(url).toContain(`latLng=${ONEMAP_CENTER.lat},${ONEMAP_CENTER.lng}`);
  });

  it("filters out invalid points from a markers array", () => {
    const url = oneMapEmbedUrl({ markers: [{ lat: NaN, lng: 1 }, { lat: 1.5, lng: 103.5 }] });
    expect(url.match(/marker=/g)).toHaveLength(1);
    expect(url).toContain("1.5,103.5");
  });

  it("respects an explicit zoom level", () => {
    expect(oneMapEmbedUrl({ zoom: 10 })).toContain("zoomLevel=10");
  });

  it("prefers the explicit lat/lng as centre even when markers are also given", () => {
    const url = oneMapEmbedUrl({ lat: 9, lng: 9, markers: [{ lat: 1, lng: 1 }] });
    expect(url).toContain("latLng=9,9");
  });
});

describe("oneMapPlaceUrl", () => {
  it("returns a zoom-18 embed url for a valid point", () => {
    const url = oneMapPlaceUrl(1.3, 103.8);
    expect(url).toContain("zoomLevel=18");
    expect(url).toContain("latLng=1.3,103.8");
  });

  it("returns '' for invalid coordinates", () => {
    expect(oneMapPlaceUrl(NaN, 103.8)).toBe("");
    expect(oneMapPlaceUrl(undefined, undefined)).toBe("");
  });
});
