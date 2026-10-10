import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import RoomFilterPanel from "@/app/components/RoomFilterPanel.vue";

describe("RoomFilterPanel", () => {
  it("offers the four features and Verified only", () => {
    const w = mount(RoomFilterPanel, { props: { modelValue: { features: [], verifiedOnly: false } } });
    expect(w.findAll("label").map((l) => l.text())).toEqual(["Chair", "Power outlet", "Lockable", "Sink", "Verified only"]);
    expect(w.text()).not.toContain("Clear filters");
  });
  it("emits the next value when a feature or Verified only is toggled", async () => {
    const w = mount(RoomFilterPanel, { props: { modelValue: { features: ["Chair"], verifiedOnly: false } } });
    const boxes = w.findAll('input[type="checkbox"]');
    await boxes[1].setValue(true);
    expect(w.emitted("update:modelValue")[0][0]).toEqual({ features: ["Chair", "Power outlet"], verifiedOnly: false });
    await boxes[0].setValue(false);
    expect(w.emitted("update:modelValue")[1][0].features).toEqual([]);
    await boxes[4].setValue(true);
    expect(w.emitted("update:modelValue")[2][0].verifiedOnly).toBe(true);
  });
  it("clears everything", async () => {
    const w = mount(RoomFilterPanel, { props: { modelValue: { features: ["Sink"], verifiedOnly: true } } });
    await w.get(".rf__clear").trigger("click");
    expect(w.emitted("update:modelValue")[0][0]).toEqual({ features: [], verifiedOnly: false });
  });
});
