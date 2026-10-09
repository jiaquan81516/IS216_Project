import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { V3_ROUTES } from "@/v3/routes";

const state = vi.hoisted(() => ({ members: [], household: null }));

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("@/v3/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("@/composables/useAuth", async () => {
  const { ref } = await import("vue");
  const currentUser = ref({ uid: "u1", displayName: "daniel Tan", email: "daniel@example.com" });
  return { useAuth: () => ({ currentUser, logout: vi.fn() }) };
});
vi.mock("@/v3/api/profile", async (importOriginal) => ({
  ...(await importOriginal()),
  getUserProfile: vi.fn(async () => ({ displayName: "daniel Tan", householdId: "h1" })),
  getHousehold: vi.fn(async () => state.household),
  getHouseholdMembers: vi.fn(async () => state.members),
}));

vi.mock("@/v3/api/entries", () => ({
  subscribeEntries: (_id, onData) => {
    queueMicrotask(() => onData([]));
    return () => {};
  },
}));

import V3AppShell from "./V3AppShell.vue";

async function mountShell() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: V3_ROUTES.HOME, component: { template: "<p>Page</p>" } },
      { path: "/:pathMatch(.*)*", component: { template: "<div />" } },
    ],
  });
  router.push(V3_ROUTES.HOME);
  await router.isReady();
  const wrapper = mount(V3AppShell, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

beforeEach(() => {
  state.household = { inviteCode: "NT-4F7K", babyName: "Aria", babyStatus: "born", babyDate: "2000-01-01" };
  state.members = [
    { uid: "u1", displayName: "daniel Tan", role: "parent" },
    { uid: "u2", displayName: "Mei Lin", role: "partner" },
  ];
});

describe("V3 app shell", () => {
  it("renders the main nav with seven items and Today as the current page", async () => {
    const { wrapper } = await mountShell();
    const links = wrapper.findAll('nav[aria-label="Main"] a');
    expect(links.map((a) => a.text())).toEqual([
      "Today",
      "Care log",
      "Sleep rota",
      "Return to work",
      "Calendar",
      "Wellness",
      "Support",
    ]);
    expect(links.map((a) => a.attributes("href"))).toEqual([
      "/v3/home",
      "/v3/care-log",
      "/v3/rota",
      "/v3/return-to-work",
      "/v3/calendar",
      "/v3/wellness",
      "/v3/support",
    ]);
    expect(links[0].attributes("aria-current")).toBe("page");
    expect(links.slice(1).every((a) => !a.attributes("aria-current"))).toBe(true);
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
    expect(button.attributes("aria-controls")).toBe("v3-side-panel");
    await button.trigger("click");
    expect(button.attributes("aria-expanded")).toBe("true");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(button.attributes("aria-expanded")).toBe("false");
    wrapper.unmount();
  });
});
