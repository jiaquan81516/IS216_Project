import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { V3_ROUTES } from "@/v3/routes";
import Landing from "./index.vue";

function mountLanding() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  return mount(Landing, { global: { plugins: [router] } });
}

describe("V3 landing", () => {
  it("renders exactly one h1 with the headline", () => {
    const wrapper = mountLanding();
    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.get("h1").text()).toBe("Who is up tonight? Now you both know.");
  });

  it("has exactly one solid primary button, linked to the journey step", () => {
    const wrapper = mountLanding();
    const primary = wrapper.findAll(".v3-btn--primary");
    expect(primary).toHaveLength(1);
    expect(primary[0].text()).toBe("Get started");
    expect(primary[0].attributes("href")).toBe(V3_ROUTES.JOURNEY);
  });

  it("repeats the journey link as an outline button in the final row", () => {
    const wrapper = mountLanding();
    const outline = wrapper.get(".v3-btn--outline");
    expect(outline.text()).toBe("Set up your household");
    expect(outline.attributes("href")).toBe(V3_ROUTES.JOURNEY);
  });

  it("links the three journey tiles to the journey route", () => {
    const wrapper = mountLanding();
    const tiles = wrapper.findAll(".landing__tile");
    expect(tiles).toHaveLength(3);
    tiles.forEach((t) => expect(t.attributes("href")).toBe(V3_ROUTES.JOURNEY));
    expect(tiles.map((t) => t.get(".landing__tile-title").text())).toEqual([
      "Expecting",
      "New at home",
      "Going back to work",
    ]);
  });

  it("has no YoursAlone box", () => {
    const wrapper = mountLanding();
    expect(wrapper.find(".nt-yours-alone").exists()).toBe(false);
    expect(wrapper.find(".landing__private").exists()).toBe(false);
  });

  it("marks the product preview as decorative", () => {
    const wrapper = mountLanding();
    expect(wrapper.get(".landing__preview").attributes("aria-hidden")).toBe("true");
  });

  it("links Sign in to the V3 sign in page", () => {
    const wrapper = mountLanding();
    const signIn = wrapper.findAll("a").find((a) => a.text() === "Sign in");
    expect(signIn.attributes("href")).toBe(V3_ROUTES.SIGN_IN);
  });
});
