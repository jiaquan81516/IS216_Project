import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import RoomCard from "@/app/components/RoomCard.vue";

const base = {
  id: "r1",
  name: "Level 3 Lounge",
  address: "1 Test Road",
  details: "Level 3, beside the lift",
  features: ["Chair", "Sink"],
  status: "verified",
  verifiedDaysAgo: 2,
  kind: "community",
  distance: 850,
};
const mountCard = (room = {}, props = {}) =>
  mount({ components: { RoomCard }, props: ["room", "p"], template: '<ul><RoomCard :room="room" v-bind="p" /></ul>' }, { props: { room: { ...base, ...room }, p: props } });

describe("RoomCard", () => {
  it("shows name, address, details, chips, verification and distance", () => {
    const w = mountCard();
    expect(w.text()).toContain("Level 3 Lounge");
    expect(w.text()).toContain("1 Test Road");
    expect(w.text()).toContain("Level 3, beside the lift");
    expect(w.findAll(".app-pill").map((p) => p.text())).toEqual(["Chair", "Sink"]);
    expect(w.text()).toContain("Verified 2 days ago");
    expect(w.text()).toContain("850 m away");
  });
  it("marks the selected card with aria-current", () => {
    expect(mountCard({}, { selected: true }).get("li").attributes("aria-current")).toBe("true");
    expect(mountCard().get("li").attributes("aria-current")).toBeUndefined();
  });
  it("shows a BMSG room as verified with its source link, facilities and feedback", () => {
    const w = mountCard({
      id: "bmsg-x",
      kind: "mall",
      features: ["Sink"],
      facilities: ["Diaper changing station", "Water dispenser"],
      feedback: "Clean and spacious.",
      sourceUrl: "https://breastfeeding.org.sg/nursing-room-directory/",
      sourceLabel: "BMSG Nursing Room Directory",
      verifiedDaysAgo: 0,
    });
    expect(w.text()).toContain("Verified today");
    expect(w.text()).not.toContain("not confirmed");
    const src = w.findAll("a").find((a) => a.text().startsWith("Source:"));
    expect(src.text()).toContain("Source: BMSG Nursing Room Directory");
    expect(src.text()).toContain("opens in a new tab");
    expect(src.attributes("href")).toBe("https://breastfeeding.org.sg/nursing-room-directory/");
    expect(src.attributes("target")).toBe("_blank");
    expect(src.attributes("rel")).toBe("noopener noreferrer");
    expect(w.text()).toContain("Diaper changing station, Water dispenser");
    expect(w.text()).toContain("Clean and spacious.");
    expect(w.findAll(".app-pill").map((p) => p.text())).toEqual(["Sink"]);
  });
  it("shows no source, facilities or feedback line for a community room", () => {
    const w = mountCard();
    expect(w.text()).not.toContain("Source:");
    expect(w.text()).not.toContain("Parent feedback");
  });
  it("offers Show on map, Open in Google Maps and Directions links", async () => {
    const w = mount(RoomCard, { props: { room: { ...base } } });
    const links = w.findAll("a").filter((a) => !a.text().startsWith("Source:")).map((a) => a.text());
    expect(links[0]).toContain("Open in Google Maps");
    expect(links[1]).toContain("Directions");
    await w.findAll("button").find((b) => b.text().startsWith("Show on map")).trigger("click");
    expect(w.emitted("select")).toHaveLength(1);
  });
  it("emits select from the name and toggle-save from the save button", async () => {
    const w = mount(RoomCard, { props: { room: { ...base } } });
    await w.get(".rc__name-btn").trigger("click");
    await w.get(".app-textbtn").trigger("click");
    expect(w.emitted("select")).toHaveLength(1);
    expect(w.emitted("toggle-save")).toHaveLength(1);
    expect(w.get(".app-textbtn").attributes("aria-pressed")).toBe("false");
  });
});
