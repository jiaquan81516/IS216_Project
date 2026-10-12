import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import OneMapEmbed from "@/app/components/OneMapEmbed.vue";

describe("OneMapEmbed", () => {
  it("defaults to the island, 360px high, with a title and attribution", () => {
    const w = mount(OneMapEmbed);
    const f = w.get("iframe");
    expect(f.attributes("src")).toContain("zoomLevel=12");
    expect(f.attributes("title")).toBe("Map of Singapore");
    expect(f.attributes("loading")).toBe("lazy");
    expect(f.attributes("referrerpolicy")).toBe("no-referrer-when-downgrade");
    expect(f.attributes("style")).toContain("height: 360px");
    const a = w.get("a");
    expect(a.attributes("href")).toBe("https://www.onemap.gov.sg/");
    expect(a.attributes("rel")).toBe("noopener noreferrer");
    expect(a.text()).toContain("Map by OneMap");
  });
  it("marks a point, titles it by label and accepts a height", () => {
    const w = mount(OneMapEmbed, { props: { lat: 1.3, lng: 103.8, label: "VivoCity", height: 280 } });
    const f = w.get("iframe");
    expect(f.attributes("src")).toContain("marker=latLng:1.3,103.8!colour:red");
    expect(f.attributes("title")).toBe("Map of VivoCity");
    expect(f.attributes("style")).toContain("height: 280px");
  });
  it("draws several markers", () => {
    const w = mount(OneMapEmbed, { props: { markers: [{ lat: 1.3, lng: 103.8 }, { lat: 1.4, lng: 103.9 }] } });
    expect(w.get("iframe").attributes("src").match(/marker=/g)).toHaveLength(2);
  });
});
