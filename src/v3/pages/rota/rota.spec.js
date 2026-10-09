import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { V3_HOME_KEY } from "@/v3/composables/useV3Home";
import { ROTA_KEY, useRotaStore } from "@/v3/stores/rota";

vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({}) }));

import RotaPage from "./index.vue";

// Wednesday 14 October 2026, 22:00 local. The week runs Monday 12 to Sunday 18.
const NOW = new Date(2026, 9, 14, 22, 0, 0);

function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const home = { me: ref({ firstName: "daniel" }), partner: ref({ firstName: "mei" }) };
  const wrapper = mount(RotaPage, {
    global: { plugins: [pinia], provide: { [V3_HOME_KEY]: home } },
  });
  return { wrapper, store: useRotaStore() };
}
const solid = (wrapper) => wrapper.findAll("button.btn-primary, a.btn-primary");

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("V3 sleep rota page", () => {
  it("shows the heading, subtitle and three tabs", () => {
    const { wrapper } = mountPage();
    expect(wrapper.get("h1").text()).toBe("Sleep rota");
    expect(wrapper.text()).toContain("Who is on duty at night, with room for swaps.");
    expect(wrapper.findAll('[role="tab"]').map((t) => t.text())).toEqual(["This week", "Swaps", "Plan settings"]);
  });

  it("lists seven nights with the week label and one Tonight badge", () => {
    const { wrapper } = mountPage();
    expect(wrapper.findAll("ol li.rt__row")).toHaveLength(7);
    expect(wrapper.get(".rt__week").text()).toBe("12 to 18 October");
    const badges = wrapper.findAll(".v3-badge--coral");
    expect(badges).toHaveLength(1);
    expect(badges[0].text()).toBe("Tonight");
    expect(wrapper.get('[data-date="2026-10-14"]').text()).toContain("Tonight");
    expect(wrapper.text()).toContain("Daniel on duty");
    expect(wrapper.text()).toContain("Mei rests first. Handover at 7:00 AM.");
    expect(wrapper.text()).not.toMatch(/[\u2013\u2014]/);
  });

  it("moves between weeks and offers a way back", async () => {
    const { wrapper } = mountPage();
    expect(wrapper.text()).not.toContain("This week" + "This week");
    await wrapper.get('button[aria-label="Next week"]').trigger("click");
    expect(wrapper.get(".rt__week").text()).toBe("19 to 25 October");
    expect(wrapper.find(".v3-badge--coral").exists()).toBe(false);
    const back = wrapper.findAll("button").find((b) => b.text() === "This week" && b.attributes("role") !== "tab");
    expect(back).toBeTruthy();
    await back.trigger("click");
    expect(wrapper.get(".rt__week").text()).toBe("12 to 18 October");
    await wrapper.get('button[aria-label="Previous week"]').trigger("click");
    expect(wrapper.get(".rt__week").text()).toBe("5 to 11 October");
  });

  it("has no solid button until a swap panel is open", async () => {
    const { wrapper } = mountPage();
    expect(solid(wrapper)).toHaveLength(0);
    const swapButtons = wrapper.findAll("li.rt__row button").filter((b) => b.text() === "Swap");
    await swapButtons[0].trigger("click");
    expect(solid(wrapper)).toHaveLength(1);
    expect(solid(wrapper)[0].text()).toBe("Send swap request");
  });

  it("sends a swap request that becomes pending", async () => {
    const { wrapper, store } = mountPage();
    const row = wrapper.get('[data-date="2026-10-12"]');
    await row.findAll("button").find((b) => b.text() === "Swap").trigger("click");
    // Validation first
    await wrapper.findAll("button").find((b) => b.text() === "Send swap request").trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toBe("Choose a night to swap with.");
    expect(store.swaps).toHaveLength(0);
    const radios = row.findAll('[role="radio"]');
    await radios.find((r) => r.text() === "Tue 13 October").trigger("click");
    await radios.find((r) => r.text() === "I am unwell").trigger("click");
    await wrapper.findAll("button").find((b) => b.text() === "Send swap request").trigger("click");
    expect(store.swaps).toHaveLength(1);
    expect(store.swaps[0]).toMatchObject({
      date: "2026-10-12",
      withDate: "2026-10-13",
      from: "me",
      status: "pending",
      message: "I am unwell",
    });
    expect(solid(wrapper)).toHaveLength(0);
    expect(wrapper.get('[data-date="2026-10-12"]').text()).toContain("Swap requested");
    // The plan itself does not change while the request is pending.
    expect(wrapper.get('[data-date="2026-10-12"]').text()).toContain("Daniel on duty");
    await nextTick();
    expect(JSON.parse(localStorage.getItem(ROTA_KEY)).swaps).toHaveLength(1);
  });

  it("asking for a partner night offers my own nights", async () => {
    const { wrapper, store } = mountPage();
    const row = wrapper.get('[data-date="2026-10-13"]');
    await row.findAll("button").find((b) => b.text() === "Swap").trigger("click");
    const labels = row.findAll('[role="radio"]').map((r) => r.text());
    expect(labels).toContain("Mon 12 October");
    expect(labels).not.toContain("Nothing in return");
    await row.findAll('[role="radio"]').find((r) => r.text() === "Mon 12 October").trigger("click");
    await wrapper.findAll("button").find((b) => b.text() === "Send swap request").trigger("click");
    expect(store.swaps[0]).toMatchObject({ date: "2026-10-12", withDate: "2026-10-13", from: "me" });
  });

  it("switches tabs, with arrow keys too", async () => {
    const { wrapper } = mountPage();
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs[0].attributes("aria-selected")).toBe("true");
    await tabs[1].trigger("click");
    expect(wrapper.get('[role="tabpanel"]').attributes("id")).toBe("rota-panel-swaps");
    expect(wrapper.text()).toContain("No swap requests.");
    expect(wrapper.text()).toContain("Requests will sync between you once the database is connected.");
    await tabs[1].trigger("keydown", { key: "ArrowRight" });
    expect(wrapper.get('[role="tabpanel"]').attributes("id")).toBe("rota-panel-settings");
    expect(wrapper.text()).toContain("Alternate nights");
    expect(wrapper.text()).toContain("Handover time");
  });

  it("accepts and declines partner requests", async () => {
    const { wrapper, store } = mountPage();
    store.swaps = [
      { id: "a", date: "2026-10-13", withDate: "2026-10-12", from: "partner", status: "pending", message: "" },
      { id: "b", date: "2026-10-14", withDate: null, from: "me", status: "pending", message: "" },
    ];
    await wrapper.findAll('[role="tab"]')[1].trigger("click");
    expect(wrapper.text()).toContain("Waiting for Mei");
    const accept = wrapper.findAll("button").find((b) => b.text() === "Accept");
    await accept.trigger("click");
    expect(store.swaps[0].status).toBe("accepted");
    expect(wrapper.text()).toContain("Accepted");
    await wrapper.findAll("button").find((b) => b.text() === "Cancel").trigger("click");
    expect(store.swaps.map((s) => s.id)).toEqual(["a"]);
  });

  it("applies the single suggestion when the week is unbalanced", async () => {
    const { wrapper, store } = mountPage();
    expect(wrapper.text()).toContain("This week is balanced.");
    store.pattern = "manual";
    for (const d of ["12", "13", "14", "15", "16"]) store.setOverride(`2026-10-${d}`, "me");
    store.setOverride("2026-10-17", "partner");
    store.setOverride("2026-10-18", "partner");
    await nextTick();
    expect(wrapper.text()).toContain("so Daniel has one more night off");
    await wrapper.findAll("button").find((b) => b.text() === "Apply suggestion").trigger("click");
    expect(store.swaps).toHaveLength(1);
    expect(store.swaps[0].status).toBe("accepted");
  });

  it("lets me take an open night in manual mode", async () => {
    const { wrapper, store } = mountPage();
    store.pattern = "manual";
    await nextTick();
    expect(wrapper.findAll(".rt__row .v3-badge").filter((b) => b.text() === "Open")).toHaveLength(7);
    const takes = wrapper.findAll("button.v3-chip").filter((b) => b.text() === "I take it");
    await takes[0].trigger("click");
    expect(store.overrides["2026-10-12"]).toBe("me");
    expect(wrapper.get('[data-date="2026-10-12"]').text()).toContain("Daniel on duty");
  });

  it("changes settings and resets with a confirmation", async () => {
    const { wrapper, store } = mountPage();
    await wrapper.findAll('[role="tab"]')[2].trigger("click");
    await wrapper.findAll('[role="radio"]').find((r) => r.text() === "Split each night").trigger("click");
    expect(store.pattern).toBe("split");
    const time = wrapper.get('input[type="time"]');
    time.element.value = "08:30";
    await time.trigger("change");
    expect(store.handoverTime).toBe("08:30");
    await wrapper.findAll("button").find((b) => b.text() === "Reset plan").trigger("click");
    expect(store.pattern).toBe("split");
    await wrapper.findAll("button").find((b) => b.text() === "Yes, reset plan").trigger("click");
    expect(store.pattern).toBe("alternate");
    expect(store.handoverTime).toBe("07:00");
    expect(solid(wrapper)).toHaveLength(0);
  });

  it("falls back to Me and Your partner without a household", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(RotaPage, { global: { plugins: [pinia] } });
    expect(wrapper.text()).toContain("Me on duty");
    expect(wrapper.text()).toContain("Your partner rests first");
  });
});
