import { describe, it, expect } from "vitest";

import { mount } from "@vue/test-utils";
import { useAuth, waitForAuthInitialization } from "../composables/useAuth";
import router from "../router";
import App from "../App.vue";

describe("App", () => {
  it("mounts renders properly", async () => {
    await router.push("/login");
    await router.isReady();
    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });
    expect(wrapper.text()).toContain("Care Companion");
  });

  it("uses the development authentication happy path", async () => {
    await waitForAuthInitialization();
    const auth = useAuth();

    const user = await auth.signInWithGoogle();

    expect(user.uid).toBe("development-user");
    expect(auth.isAuthenticated.value).toBe(true);

    await auth.logout();
    expect(auth.isAuthenticated.value).toBe(false);
  });
});
