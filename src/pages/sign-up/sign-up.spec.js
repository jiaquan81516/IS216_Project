import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, RouterLinkStub } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import SignUp from "./index.vue";

const push = vi.fn();

vi.mock("vue-router", async (orig) => ({ ...(await orig()), useRouter: () => ({ push }) }));
vi.mock("@/v3/api/emailAuth", () => ({
  signUpWithEmail: vi.fn(() => Promise.resolve({ uid: "u1" })),
  signInWithEmail: vi.fn(),
  describeAuthError: () => "Something went wrong. Please try again.",
}));
vi.mock("@/pages/google-handoff/googleFlow", () => ({
  googleError: { value: "" },
  destinationFor: () => () => "/setup/about",
  startGoogleSignIn: vi.fn(),
}));
vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: ref({ uid: "u1" }) }) }));

import { signUpWithEmail } from "@/v3/api/emailAuth";

function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(SignUp, { global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } } });
}

describe("Sign up page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders email and password fields and an outline Google button", () => {
    const wrapper = mountPage();
    expect(wrapper.find("input#su-email").exists()).toBe(true);
    expect(wrapper.find("input#su-password").attributes("autocomplete")).toBe("new-password");
    const google = wrapper.findAll("button").find((b) => b.text() === "Continue with Google");
    expect(google.classes()).toContain("btn-outline");
    expect(wrapper.findAll(".btn-primary")).toHaveLength(1);
  });

  it("shows three field errors on an empty submit", async () => {
    const wrapper = mountPage();
    await wrapper.find("form").trigger("submit");
    expect(wrapper.findAll(".au__err")).toHaveLength(3);
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it("calls signUpWithEmail with the entered values", async () => {
    const wrapper = mountPage();
    await wrapper.find("#su-name").setValue("Daniel");
    await wrapper.find("#su-email").setValue("daniel@example.com");
    await wrapper.find("#su-password").setValue("longenough1");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(signUpWithEmail).toHaveBeenCalledWith({ name: "Daniel", email: "daniel@example.com", password: "longenough1" });
    expect(push).toHaveBeenCalledWith("/setup/about");
  });
});
