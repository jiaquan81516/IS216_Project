import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { HOME_KEY } from "@/app/composables/useHome";

const state = vi.hoisted(() => ({ providers: [{ providerId: "password" }] }));
const api = vi.hoisted(() => ({ saveProfile: vi.fn(async () => {}) }));

vi.mock("@/api/firebase", () => ({
  default: {},
  auth: { get currentUser() { return { uid: "u1", providerData: state.providers }; } },
}));
vi.mock("@/app/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("firebase/auth", () => ({ deleteUser: vi.fn() }));
vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: { value: { uid: "u1" } } }) }));
vi.mock("@/app/api/account", async (importOriginal) => ({
  ...(await importOriginal()),
  saveProfile: (...a) => api.saveProfile(...a),
}));

import ProfilePage from "./index.vue";

function makeHome(overrides = {}) {
  return {
    loading: ref(false),
    error: ref(""),
    reload: vi.fn(async () => {}),
    me: ref({ uid: "u1", firstName: "daniel", displayName: "daniel Tan", email: "daniel@example.com" }),
    partner: ref(null),
    profile: ref({ displayName: "daniel Tan", email: "daniel@example.com", role: "dad", householdId: "h1" }),
    household: ref({}),
    householdId: ref("h1"),
    baby: ref({ name: "", line: "" }),
    inviteCode: ref("NT-4F7K"),
    settings: ref({}),
    ...overrides,
  };
}

async function mountPage(home = makeHome()) {
  const wrapper = mount(ProfilePage, { global: { provide: { [HOME_KEY]: home } } });
  await flushPromises();
  return { wrapper, home };
}

const btn = (wrapper, text) => wrapper.findAll("button").find((b) => b.text() === text);

beforeEach(() => {
  api.saveProfile.mockClear();
  api.saveProfile.mockResolvedValue(undefined);
  state.providers = [{ providerId: "password" }];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("App profile page", () => {
  it("shows the stored name, the chosen role chip and the read only email", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.get("h1").text()).toBe("Profile");
    expect(wrapper.get("#pf-name").element.value).toBe("daniel Tan");
    expect(wrapper.get("#pf-name").attributes("maxlength")).toBe("40");
    expect(wrapper.get("#pf-name").attributes("required")).toBeDefined();
    const chips = wrapper.findAll(".app-chip");
    expect(chips.map((c) => c.text())).toEqual(["Mum", "Dad", "Carer"]);
    expect(chips[1].attributes("aria-pressed")).toBe("true");
    expect(wrapper.text()).toContain("daniel@example.com");
    expect(wrapper.text()).toContain("comes from the sign-in method");
    expect(wrapper.find("input#pf-email").exists()).toBe(false);
  });

  it("names the sign in method from the Firebase provider data", async () => {
    const first = await mountPage();
    expect(first.wrapper.text()).toContain("Signed in with email and password");
    first.wrapper.unmount();
    state.providers = [{ providerId: "google.com" }];
    const second = await mountPage();
    expect(second.wrapper.text()).toContain("Signed in with Google");
  });

  it("has exactly one solid button, Save changes", async () => {
    const { wrapper } = await mountPage();
    const solid = wrapper.findAll("button.btn-primary");
    expect(solid).toHaveLength(1);
    expect(solid[0].text()).toBe("Save changes");
  });

  it("saves the name and role, and confirms in a status region", async () => {
    const { wrapper, home } = await mountPage();
    await wrapper.get("#pf-name").setValue("  Daniel  Tan  ");
    await wrapper.findAll(".app-chip")[2].trigger("click");
    await btn(wrapper, "Save changes").trigger("click");
    await flushPromises();
    expect(api.saveProfile).toHaveBeenCalledWith("u1", "h1", { displayName: "Daniel Tan", role: "carer" });
    expect(home.reload).toHaveBeenCalled();
    expect(wrapper.get('[role="status"]').text()).toContain("Saved");
  });

  it("clears the role when the chosen chip is tapped again", async () => {
    const { wrapper } = await mountPage();
    await wrapper.findAll(".app-chip")[1].trigger("click");
    expect(wrapper.findAll(".app-chip")[1].attributes("aria-pressed")).toBe("false");
    await btn(wrapper, "Save changes").trigger("click");
    await flushPromises();
    expect(api.saveProfile).toHaveBeenCalledWith("u1", "h1", { displayName: "daniel Tan", role: null });
  });

  it("refuses an empty name without writing anything", async () => {
    const { wrapper } = await mountPage();
    await wrapper.get("#pf-name").setValue("   ");
    await btn(wrapper, "Save changes").trigger("click");
    await flushPromises();
    expect(api.saveProfile).not.toHaveBeenCalled();
    expect(wrapper.get("#pf-name-err").text()).toBe("Enter the name your partner will see.");
    expect(wrapper.get("#pf-name").attributes("aria-invalid")).toBe("true");
  });

  it("explains a rules error without losing what was typed", async () => {
    api.saveProfile.mockRejectedValue({ code: "permission-denied" });
    const { wrapper } = await mountPage();
    await btn(wrapper, "Save changes").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toMatch(/firestore\.rules/);
  });

  it("ignores a role stored by the old onboarding instead of showing a wrong chip", async () => {
    const home = makeHome();
    home.profile.value = { displayName: "Mei", role: "partner", householdId: "h1" };
    const { wrapper } = await mountPage(home);
    expect(wrapper.findAll(".app-chip").every((c) => c.attributes("aria-pressed") === "false")).toBe(true);
  });

  it("offers Try again when the household could not be loaded", async () => {
    const home = makeHome();
    home.error.value = "We could not load your household.";
    const { wrapper } = await mountPage(home);
    expect(wrapper.get('[role="alert"]').text()).toContain("could not load");
    await btn(wrapper, "Try again").trigger("click");
    expect(home.reload).toHaveBeenCalled();
  });
});
