import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { V3_ROUTES } from "@/v3/routes";
import V3UserMenu from "./V3UserMenu.vue";

async function mountMenu() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: V3_ROUTES.HOME, component: { template: "<p>Home</p>" } },
      { path: V3_ROUTES.PROFILE, component: { template: "<p>Profile</p>" } },
      { path: V3_ROUTES.SETTINGS, component: { template: "<p>Settings</p>" } },
    ],
  });
  router.push(V3_ROUTES.HOME);
  await router.isReady();
  const wrapper = mount(V3UserMenu, {
    props: { name: "Daniel" },
    attachTo: document.body,
    global: { plugins: [router] },
  });
  await flushPromises();
  return { wrapper, router };
}

describe("V3UserMenu", () => {
  it("is closed to start, with aria-expanded false and no panel", async () => {
    const { wrapper } = await mountMenu();
    const button = wrapper.get("button");
    expect(button.attributes("aria-expanded")).toBe("false");
    expect(button.attributes("aria-controls")).toBe("v3-user-menu");
    expect(wrapper.find("#v3-user-menu").exists()).toBe(false);
    expect(wrapper.text()).toContain("Daniel");
    wrapper.unmount();
  });

  it("opens with Profile, Settings and Sign out, and moves focus to the first item", async () => {
    const { wrapper } = await mountMenu();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    const panel = wrapper.get("#v3-user-menu");
    expect(panel.attributes("role")).toBe("menu");
    const items = panel.findAll("[role=menuitem]");
    expect(items.map((i) => i.text())).toEqual(["Profile", "Settings", "Sign out"]);
    expect(items[0].attributes("href")).toBe("/profile");
    expect(items[1].attributes("href")).toBe("/settings");
    expect(document.activeElement).toBe(items[0].element);
    wrapper.unmount();
  });

  it("walks the items with the arrow keys, wrapping round", async () => {
    const { wrapper } = await mountMenu();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    const items = wrapper.findAll("[role=menuitem]").map((i) => i.element);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(document.activeElement).toBe(items[1]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(document.activeElement).toBe(items[2]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(document.activeElement).toBe(items[0]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(document.activeElement).toBe(items[2]);
    wrapper.unmount();
  });

  it("closes on Escape and gives focus back to the button", async () => {
    const { wrapper } = await mountMenu();
    const button = wrapper.get("button");
    await button.trigger("click");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(button.attributes("aria-expanded")).toBe("false");
    expect(wrapper.find("#v3-user-menu").exists()).toBe(false);
    expect(document.activeElement).toBe(button.element);
    wrapper.unmount();
  });

  it("closes on a click outside, and stays open on a click inside", async () => {
    const { wrapper } = await mountMenu();
    const button = wrapper.get("button");
    await button.trigger("click");
    document.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    await flushPromises();
    expect(button.attributes("aria-expanded")).toBe("false");

    await button.trigger("click");
    wrapper.get("#v3-user-menu").element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    await flushPromises();
    expect(button.attributes("aria-expanded")).toBe("true");
    wrapper.unmount();
  });

  it("closes when the route changes", async () => {
    const { wrapper, router } = await mountMenu();
    const button = wrapper.get("button");
    await button.trigger("click");
    await router.push(V3_ROUTES.SETTINGS);
    await flushPromises();
    expect(button.attributes("aria-expanded")).toBe("false");
    wrapper.unmount();
  });

  it("asks the shell to sign out and closes itself", async () => {
    const { wrapper } = await mountMenu();
    await wrapper.get("button").trigger("click");
    await wrapper.findAll("[role=menuitem]")[2].trigger("click");
    expect(wrapper.emitted("sign-out")).toHaveLength(1);
    expect(wrapper.find("#v3-user-menu").exists()).toBe(false);
    wrapper.unmount();
  });
});
