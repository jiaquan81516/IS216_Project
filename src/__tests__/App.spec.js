import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import router from "../router/appRoutes";
import App from "../App.vue";

describe("App", () => {
  it("renders the landing page", async () => {
    await router.push("/");
    await router.isReady();
    const wrapper = mount(App, { global: { plugins: [router] } });
    expect(wrapper.text().length).toBeGreaterThan(0);
  });
});
