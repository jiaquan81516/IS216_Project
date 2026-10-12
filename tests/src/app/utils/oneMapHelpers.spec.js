import { describe, expect, it } from "vitest";
import { ONEMAP_HOME_URL, oneMapEmbedUrl, oneMapPlaceUrl } from "@/app/utils/oneMapHelpers";

const BASE = "https://www.onemap.gov.sg/amm/amm.html?";

describe("oneMapEmbedUrl", () => {
  it("shows the whole island centred on Singapore by default", () => {
    expect(oneMapEmbedUrl()).toBe(`${BASE}mapStyle=Default&zoomLevel=12&latLng=1.3521,103.8198`);
    expect(oneMapEmbedUrl({ lat: NaN, lng: 103 })).toBe(`${BASE}mapStyle=Default&zoomLevel=12&latLng=1.3521,103.8198`);
  });
  it("puts one red marker on a point and zooms in", () => {
    expect(oneMapEmbedUrl({ lat: 1.3, lng: 103.8 })).toBe(
      `${BASE}mapStyle=Default&zoomLevel=15&latLng=1.3,103.8&marker=latLng:1.3,103.8!colour:red&popupWidth=200`,
    );
  });
  it("takes a custom zoom", () => {
    expect(oneMapEmbedUrl({ lat: 1.3, lng: 103.8, zoom: 17 })).toContain("zoomLevel=17");
  });
  it("repeats marker for several points and keeps the island view", () => {
    const url = oneMapEmbedUrl({ markers: [{ lat: 1.3, lng: 103.8 }, { lat: 1.4, lng: 103.9, colour: "blue" }, { lat: null, lng: 1 }] });
    expect(url.match(/marker=/g)).toHaveLength(2);
    expect(url).toContain("marker=latLng:1.3,103.8!colour:red");
    expect(url).toContain("marker=latLng:1.4,103.9!colour:blue");
    expect(url).toContain("latLng=1.3521,103.8198");
    expect(url).toContain("zoomLevel=15");
  });
});

describe("oneMapPlaceUrl", () => {
  it("opens the OneMap embed page zoomed in on the place", () => {
    expect(oneMapPlaceUrl(1.3, 103.8)).toBe(`${BASE}mapStyle=Default&zoomLevel=18&latLng=1.3,103.8&marker=latLng:1.3,103.8!colour:red&popupWidth=200`);
  });
  it("gives an empty string without coordinates", () => {
    expect(oneMapPlaceUrl(null, null)).toBe("");
    expect(oneMapPlaceUrl(undefined, 103)).toBe("");
  });
  it("exports the OneMap home url", () => {
    expect(ONEMAP_HOME_URL).toBe("https://www.onemap.gov.sg/");
  });
});
