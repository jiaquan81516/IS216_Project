import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import TonightTimeline from "./TonightTimeline.vue";

const props = { meName: "Mel", partnerName: "Daniel" };
const at = (h, m = 0) => new Date(2026, 9, 9, h, m);

describe("TonightTimeline", () => {
  it("names both people in the aria label", () => {
    const wrapper = mount(TonightTimeline, { props: { ...props, now: at(21, 40) } });
    const label = wrapper.get('[role="img"]').attributes("aria-label");
    expect(label).toContain("Mel");
    expect(label).toContain("Daniel");
  });

  it("shows the marker and legend inside the window", () => {
    const wrapper = mount(TonightTimeline, { props: { ...props, now: at(21, 40) } });
    expect(wrapper.find('[data-testid="now-marker"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Now, 9:40 PM");
    expect(wrapper.get('[data-testid="now-marker"]').attributes("style")).toContain("left: 30.5");
  });

  it("positions the marker after midnight", () => {
    const wrapper = mount(TonightTimeline, { props: { ...props, now: at(3) } });
    expect(wrapper.get('[data-testid="now-marker"]').attributes("style")).toContain("75%");
  });

  it("hides the marker outside the window", () => {
    const wrapper = mount(TonightTimeline, { props: { ...props, now: at(12) } });
    expect(wrapper.find('[data-testid="now-marker"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Outside tonight's window");
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toContain("outside tonight's window");
  });

  it("has no floating labels on the bar", () => {
    const wrapper = mount(TonightTimeline, { props: { ...props, now: at(21, 40) } });
    expect(wrapper.text()).not.toContain("Fed ");
    expect(wrapper.text()).not.toContain("Feed due");
  });
});
