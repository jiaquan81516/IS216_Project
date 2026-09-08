import { describe, it, expect } from "vitest";

import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import router from "../router";
import App from "../App.vue";

describe("App", () => {
  it("mounts renders properly", async () => {
    await router.push("/login");
    await router.isReady();
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router],
      },
    });
    expect(wrapper.text()).toContain("You did it!");
  });
});
