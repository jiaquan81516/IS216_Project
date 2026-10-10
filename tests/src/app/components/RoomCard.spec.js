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
  it("never calls a mall verified", () => {
    const w = mountCard({ kind: "mall", status: "mall", features: [], details: "Shopping mall" });
    expect(w.text()).toContain("Mall, nursing room not confirmed");
    expect(w.text()).not.toContain("Verified");
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
