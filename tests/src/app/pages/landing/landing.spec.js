import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { ROUTES } from "@/app/routes";
import Landing from "@/app/pages/landing/index.vue";

function mountLanding() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  return mount(Landing, { global: { plugins: [router] } });
}

describe("App landing", () => {
  it("renders exactly one h1 with the headline", () => {
    const wrapper = mountLanding();
    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.get("h1").text()).toBe("Share the care.Share the load.");
  });

  it("has two primary calls to action linked to the journey step", () => {
    const wrapper = mountLanding();
    const primary = wrapper.findAll(".app-btn--primary");
    expect(primary).toHaveLength(2);
    primary.forEach((button) => {
      expect(button.text()).toContain("Create your household");
      expect(button.attributes("href")).toBe(ROUTES.JOURNEY);
    });
  });

  it("links the three journey tiles to the journey route", () => {
    const wrapper = mountLanding();
    const tiles = wrapper.findAll(".journey-card__link");
    expect(tiles).toHaveLength(3);
    tiles.forEach((t) => expect(t.attributes("href")).toBe(ROUTES.JOURNEY));
    expect(tiles.map((t) => t.text())).toEqual([
      "Start with shared care →",
      "Prepare together →",
      "Build the roadmap →",
    ]);
  });

  it("has no YoursAlone box", () => {
    const wrapper = mountLanding();
    expect(wrapper.find(".nt-yours-alone").exists()).toBe(false);
    expect(wrapper.find(".landing__private").exists()).toBe(false);
  });

  it("labels the handover example", () => {
    const wrapper = mountLanding();
    expect(wrapper.get(".handover-demo").attributes("aria-label")).toBe("Example of an evening care handover");
  });

  it("links Sign in to the App sign in page", () => {
    const wrapper = mountLanding();
    const signIn = wrapper.findAll("a").find((a) => a.text() === "Sign in");
    expect(signIn.attributes("href")).toBe(ROUTES.SIGN_IN);
  });
});
