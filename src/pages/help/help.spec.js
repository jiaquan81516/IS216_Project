import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import Help from "./index.vue";
import { guides, helpQuery } from "@/data/help";

function mountHelp() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  return mount(Help, { global: { plugins: [router] } });
}

describe("Help, Right now", () => {
  beforeEach(() => {
    helpQuery.value = "";
  });

  it("lists every guide by default", () => {
    const wrapper = mountHelp();
    expect(wrapper.findAll("[data-testid='guide-list'] li")).toHaveLength(guides.length);
  });

  it("filters the guide list as you type", async () => {
    const wrapper = mountHelp();
    await wrapper.get("input[type='search']").setValue("rash");
    const items = wrapper.findAll("[data-testid='guide-list'] li");
    expect(items).toHaveLength(1);
    expect(items[0].text()).toContain("Nappy rash");
  });

  it("shows a message when nothing matches", async () => {
    const wrapper = mountHelp();
    await wrapper.get("input[type='search']").setValue("zzzz");
    expect(wrapper.findAll("[data-testid='guide-list'] li")).toHaveLength(0);
    expect(wrapper.text()).toContain("No guides match");
  });
});
