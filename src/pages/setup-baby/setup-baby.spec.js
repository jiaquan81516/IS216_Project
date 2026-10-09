import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SetupBaby from "./index.vue";
import { useHouseholdStore } from "@/stores/household";

function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(SetupBaby, {
    global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } },
  });
  return { wrapper, household: useHouseholdStore() };
}

vi.mock("vue-router", async (orig) => ({ ...(await orig()), useRouter: () => ({ push: vi.fn() }) }));

const value = (wrapper, label) => wrapper.find(`[data-label="${label}"]`).text();

describe("Your baby setup page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 6, 12));
  });
  afterEach(() => vi.useRealTimers());

  it("updates the Age summary when the date of birth changes", async () => {
    const { wrapper } = mountPage();
    await wrapper.find("#baby-dob").setValue("2026-09-15");
    expect(value(wrapper, "Age")).toBe("3 weeks");
    expect(value(wrapper, "Born")).toBe("15 Sep 2026");

    await wrapper.find("#baby-dob").setValue("2026-09-29");
    expect(value(wrapper, "Age")).toBe("1 week");
  });

  it("joins feeding choices with and", async () => {
    const { wrapper, household } = mountPage();
    household.baby.feeding = [];
    await wrapper.vm.$nextTick();
    expect(value(wrapper, "Fed by")).toBe("Not set");
    const boxes = wrapper.findAll('input[type="checkbox"]');
    await boxes[0].setValue(true);
    await boxes[2].setValue(true);
    expect(value(wrapper, "Fed by")).toBe("Breast and bottle");
  });
});
