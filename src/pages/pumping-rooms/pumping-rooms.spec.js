import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import PumpingRooms from "./index.vue";
import { FILTERS, filterRooms, resetRooms, rooms } from "@/data/pumpingRooms";

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
}

describe("pumping rooms filters", () => {
  beforeEach(() => resetRooms());

  it("narrows the data when the power point filter is on", () => {
    const power = filterRooms(rooms.value, "All", ["power"]);
    expect(power.length).toBeGreaterThan(0);
    expect(power.length).toBeLessThan(rooms.value.length);
    expect(power.every((r) => r.features.power.state === "yes")).toBe(true);
    expect(FILTERS.map((f) => f.label)).toContain("Power point");
  });

  it("narrows the rendered list when Power point is toggled", async () => {
    const router = makeRouter();
    await router.push("/pumping-rooms");
    await router.isReady();
    const wrapper = mount(PumpingRooms, { global: { plugins: [router] } });

    expect(wrapper.findAll("a.room")).toHaveLength(10);
    const button = wrapper.findAll("button.filter").find((b) => b.text() === "Power point");
    await button.trigger("click");

    const shown = wrapper.findAll("a.room").length;
    expect(shown).toBeLessThan(10);
    expect(shown).toBe(filterRooms(rooms.value, "All", ["power"]).length);
    expect(wrapper.text()).toContain(`${shown} of 10 rooms shown`);
  });
});
