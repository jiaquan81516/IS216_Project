import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import Landing from "./index.vue";

function mountLanding() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  return mount(Landing, { global: { plugins: [router] } });
}

describe("Landing", () => {
  it("renders the headline", () => {
    const wrapper = mountLanding();
    expect(wrapper.get("h1").text()).toBe("Look after the baby together. Look after each other too.");
  });

  it("links the Create your household button to sign up", () => {
    const wrapper = mountLanding();
    const buttons = wrapper.findAll("a").filter((a) => a.text() === "Create your household");
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0].attributes("href")).toBe("/signup");
  });
});
