import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { createPinia, setActivePinia } from "pinia";
import { ROUTES } from "@/app/routes";

const state = vi.hoisted(() => ({ members: [], household: null, handovers: [] }));

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("@/app/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("@/composables/useAuth", async () => {
  const { ref } = await import("vue");
  const currentUser = ref({ uid: "u1", displayName: "daniel Tan", email: "daniel@example.com" });
  return { useAuth: () => ({ currentUser, logout: vi.fn() }) };
});
vi.mock("@/app/api/profile", async (importOriginal) => ({
  ...(await importOriginal()),
  getUserProfile: vi.fn(async () => ({ displayName: "daniel Tan", householdId: "h1" })),
  getHousehold: vi.fn(async () => state.household),
  getHouseholdMembers: vi.fn(async () => state.members),
}));

vi.mock("@/app/api/entries", () => ({
  subscribeEntries: (_id, onData) => {
    queueMicrotask(() => onData([]));
    return () => {};
  },
}));
vi.mock("@/app/api/handovers", () => ({
  HANDOVERS_MAX: 30,
  subscribeHandovers: (_id, onData) => {
    queueMicrotask(() => onData(state.handovers));
    return () => {};
  },
}));

import AppShell from "./AppShell.vue";

async function mountShell() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: ROUTES.HOME, component: { template: "<p>Page</p>" } },
      { path: "/:pathMatch(.*)*", component: { template: "<div />" } },
    ],
  });
  router.push(ROUTES.HOME);
  await router.isReady();
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(AppShell, { global: { plugins: [router, pinia] } });
  await flushPromises();
  return { wrapper, router };
}

beforeEach(() => {
  state.household = { inviteCode: "NT-4F7K", babyName: "Aria", babyStatus: "born", babyDate: "2000-01-01" };
  state.members = [
    { uid: "u1", displayName: "daniel Tan", role: "parent" },
    { uid: "u2", displayName: "Mei Lin", role: "partner" },
  ];
  state.handovers = [];
});

describe("App app shell", () => {
  it("renders the main nav with eight items and Today as the current page", async () => {
    const { wrapper } = await mountShell();
    const links = wrapper.findAll('nav[aria-label="Main"] a');
    expect(links.map((a) => a.text())).toEqual([
      "Today",
      "Care log",
      "Handover",
      "Sleep rota",
      "Return to work",
      "Calendar",
      "Wellness",
      "Support",
    ]);
    expect(links.map((a) => a.attributes("href"))).toEqual([
      "/home",
      "/care-log",
      "/handover",
      "/rota",
      "/return-to-work",
      "/calendar",
      "/wellness",
      "/support",
    ]);
    expect(links[0].attributes("aria-current")).toBe("page");
    expect(links.slice(1).every((a) => !a.attributes("aria-current"))).toBe(true);
  });

  it("badges the Handover nav item only while one is waiting for me", async () => {
    const { wrapper } = await mountShell();
    expect(wrapper.find(".side__count").exists()).toBe(false);

    state.handovers = [
      { id: "ho1", from: "u2", to: "u1", sentAt: new Date(), acceptedAt: null },
      { id: "ho0", from: "u1", to: "u2", sentAt: new Date(), acceptedAt: null },
    ];
    const second = await mountShell();
    const badge = second.wrapper.get(".side__count");
    expect(badge.text()).toBe("1");
    expect(badge.attributes("aria-hidden")).toBe("true");
    const link = second.wrapper.findAll('nav[aria-label="Main"] a')[2];
    expect(link.text()).toContain("1 handover waiting for you");
  });

  it("drops the badge once it has been accepted", async () => {
    state.handovers = [{ id: "ho1", from: "u2", to: "u1", sentAt: new Date(), acceptedAt: new Date() }];
    const { wrapper } = await mountShell();
    expect(wrapper.find(".side__count").exists()).toBe(false);
  });

  it("shows the household chip with both parents and the baby line", async () => {
    const { wrapper } = await mountShell();
    expect(wrapper.text()).toContain("Daniel & Mei");
    expect(wrapper.text()).toContain("Baby Aria");
    expect(wrapper.get(".side__chip-baby").text()).toBe("Baby Aria");
    expect(wrapper.get(".side__chip-age").text()).toMatch(/old$/);
  });

  it("shows no baby lines when there is no baby info", async () => {
    state.household = {};
    const { wrapper } = await mountShell();
    expect(wrapper.find(".side__chip-baby").exists()).toBe(false);
    expect(wrapper.find(".side__chip-age").exists()).toBe(false);
  });

  it("shows only the first name when no partner has joined", async () => {
    state.members = [{ uid: "u1", displayName: "daniel Tan", role: "parent" }];
    const { wrapper } = await mountShell();
    expect(wrapper.get(".side__chip-names").text()).toBe("Daniel");
  });

  it("toggles the menu button's aria-expanded and closes on Escape", async () => {
    const { wrapper } = await mountShell();
    const button = wrapper.get(".side__menu");
    expect(button.attributes("aria-expanded")).toBe("false");
    expect(button.attributes("aria-controls")).toBe("app-side-panel");
    await button.trigger("click");
    expect(button.attributes("aria-expanded")).toBe("true");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(button.attributes("aria-expanded")).toBe("false");
    wrapper.unmount();
  });

  it("turns the user row into an account menu with Profile, Settings and Sign out", async () => {
    const { wrapper } = await mountShell();
    const trigger = wrapper.get(".side__user button");
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(trigger.text()).toContain("Daniel");
    // The two new pages are reachable from here and are not in the main nav.
    expect(wrapper.findAll('nav[aria-label="Main"] a[href="/settings"]')).toHaveLength(0);
    expect(wrapper.findAll('nav[aria-label="Main"] a[href="/profile"]')).toHaveLength(0);

    await trigger.trigger("click");
    await flushPromises();
    const items = wrapper.findAll("#app-user-menu [role=menuitem]");
    expect(items.map((i) => i.text())).toEqual(["Profile", "Settings", "Sign out"]);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(trigger.attributes("aria-expanded")).toBe("false");
    wrapper.unmount();
  });
});
