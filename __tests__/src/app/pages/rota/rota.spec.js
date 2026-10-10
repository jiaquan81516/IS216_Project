import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { HOME_KEY } from "@/app/composables/useHome";
import { SHARED_KEY } from "@/app/composables/useShared";
import { useRotaStore } from "@/app/stores/rota";

// The page talks to Firestore only through the store, so the api module is mocked.
const api = vi.hoisted(() => ({
  settings: null,
  nights: [],
  swaps: [],
  error: null,
  cb: {},
  saveRotaSettings: vi.fn(async () => {}),
  setNightOverride: vi.fn(async () => {}),
  clearNightOverride: vi.fn(async () => {}),
  requestSwap: vi.fn(async () => "s-new"),
  respondToSwap: vi.fn(async () => {}),
  cancelSwap: vi.fn(async () => {}),
}));

vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({}) }));
vi.mock("@/app/api/rota", () => ({
  subscribeRotaSettings: (hid, onData, onError) => {
    api.cb.settings = onData;
    queueMicrotask(() => (api.error ? onError(api.error) : onData(api.settings)));
    return () => {};
  },
  subscribeNights: (hid, from, to, onData) => {
    api.cb.nights = onData;
    queueMicrotask(() => onData(api.nights));
    return () => {};
  },
  subscribeSwaps: (hid, onData) => {
    api.cb.swaps = onData;
    queueMicrotask(() => onData(api.swaps));
    return () => {};
  },
  saveRotaSettings: (...a) => api.saveRotaSettings(...a),
  setNightOverride: (...a) => api.setNightOverride(...a),
  clearNightOverride: (...a) => api.clearNightOverride(...a),
  requestSwap: (...a) => api.requestSwap(...a),
  respondToSwap: (...a) => api.respondToSwap(...a),
  cancelSwap: (...a) => api.cancelSwap(...a),
  migrateLegacyRota: vi.fn(async () => false),
}));

import RotaPage from "@/app/pages/rota/index.vue";

// Wednesday 14 October 2026, 22:00 local. The week runs Monday 12 to Sunday 18.
const NOW = new Date(2026, 9, 14, 22, 0, 0);
const ME = "u1";
const PARTNER = "u2";

const retry = vi.fn();

async function mountPage({ named = true, householdId = "h1" } = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useRotaStore();
  const home = named
    ? {
        householdId: ref(householdId),
        me: ref({ uid: ME, firstName: "daniel" }),
        partner: ref({ uid: PARTNER, firstName: "mei" }),
      }
    : { householdId: ref(householdId), me: ref({ uid: ME }), partner: ref(null) };
  if (householdId) store.bind(householdId, ME, named ? PARTNER : "");
  const wrapper = mount(RotaPage, {
    global: { plugins: [pinia], provide: { [HOME_KEY]: home, [SHARED_KEY]: { retry } } },
  });
  await flushPromises();
  return { wrapper, store };
}
const solid = (wrapper) => wrapper.findAll("button.btn-primary, a.btn-primary");
const buttonByText = (wrapper, text) => wrapper.findAll("button").find((b) => b.text() === text);
const openTab = async (wrapper, index) => {
  await wrapper.findAll('[role="tab"]')[index].trigger("click");
  await flushPromises();
};

beforeEach(() => {
  api.settings = { pattern: "alternate", firstOnDuty: ME, startDate: "2026-10-12", handoverTime: "07:00" };
  api.nights = [];
  api.swaps = [];
  api.error = null;
  api.cb = {};
  retry.mockClear();
  for (const key of [
    "saveRotaSettings",
    "setNightOverride",
    "clearNightOverride",
    "requestSwap",
    "respondToSwap",
    "cancelSwap",
  ]) {
    api[key].mockClear();
  }
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("App sleep rota page", () => {
  it("shows the heading, subtitle and three tabs", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.get("h1").text()).toBe("Sleep rota");
    expect(wrapper.text()).toContain("You both see the same plan.");
    expect(wrapper.findAll('[role="tab"]').map((t) => t.text())).toEqual(["This week", "Swaps", "Plan settings"]);
  });

  it("lists seven nights from the shared plan with one Tonight badge", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.findAll("ol li.rt__row")).toHaveLength(7);
    expect(wrapper.get(".rt__week").text()).toBe("12 to 18 October");
    const badges = wrapper.findAll(".app-badge--coral");
    expect(badges).toHaveLength(1);
    expect(badges[0].text()).toBe("Tonight");
    expect(wrapper.get('[data-date="2026-10-14"]').text()).toContain("Tonight");
    expect(wrapper.text()).toContain("Daniel on duty");
    expect(wrapper.text()).toContain("Mei rests first. Handover at 7:00 AM.");
    expect(wrapper.text()).not.toMatch(/[\u2013\u2014]/);
  });

  it("shows a night set by either parent, by uid", async () => {
    api.settings = { pattern: "manual", startDate: "2026-10-12", handoverTime: "07:00" };
    api.nights = [
      { date: "2026-10-12", onCall: PARTNER, setBy: PARTNER },
      { date: "2026-10-13", onCall: ME, setBy: ME },
    ];
    const { wrapper } = await mountPage();
    expect(wrapper.get('[data-date="2026-10-12"]').text()).toContain("Mei on duty");
    expect(wrapper.get('[data-date="2026-10-13"]').text()).toContain("Daniel on duty");
    expect(wrapper.get('[data-date="2026-10-14"]').text()).toContain("Open");
  });

  it("shows Loading the rota and no alert before the household id exists", async () => {
    const { wrapper } = await mountPage({ householdId: "" });
    expect(wrapper.text()).toContain("Loading the rota...");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find(".rt__row").exists()).toBe(false);
  });

  it("explains permission-denied and offers Try again", async () => {
    api.error = { code: "permission-denied" };
    const { wrapper } = await mountPage();
    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain("do not allow reading the sleep rota");
    expect(alert.text()).toContain("Publish the latest firestore.rules");
    await buttonByText(wrapper, "Try again").trigger("click");
    expect(retry).toHaveBeenCalled();
    expect(solid(wrapper)).toHaveLength(0);
  });

  it("moves between weeks and offers a way back", async () => {
    const { wrapper } = await mountPage();
    await wrapper.get('button[aria-label="Next week"]').trigger("click");
    expect(wrapper.get(".rt__week").text()).toBe("19 to 25 October");
    expect(wrapper.find(".app-badge--coral").exists()).toBe(false);
    const back = wrapper.findAll("button").find((b) => b.text() === "This week" && b.attributes("role") !== "tab");
    await back.trigger("click");
    expect(wrapper.get(".rt__week").text()).toBe("12 to 18 October");
  });

  it("has no solid button until a swap panel is open", async () => {
    const { wrapper } = await mountPage();
    expect(solid(wrapper)).toHaveLength(0);
    const swapButtons = wrapper.findAll("li.rt__row button").filter((b) => b.text() === "Swap");
    await swapButtons[0].trigger("click");
    expect(solid(wrapper)).toHaveLength(1);
    expect(solid(wrapper)[0].text()).toBe("Send swap request");
  });

  it("sends a swap request to the partner and says so", async () => {
    const { wrapper } = await mountPage();
    const row = wrapper.get('[data-date="2026-10-12"]');
    await row.findAll("button").find((b) => b.text() === "Swap").trigger("click");
    await buttonByText(wrapper, "Send swap request").trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toBe("Choose a night to swap with.");
    expect(api.requestSwap).not.toHaveBeenCalled();

    const radios = row.findAll('[role="radio"]');
    await radios.find((r) => r.text() === "Tue 13 October").trigger("click");
    await radios.find((r) => r.text() === "I am unwell").trigger("click");
    await buttonByText(wrapper, "Send swap request").trigger("click");
    await flushPromises();
    expect(api.requestSwap).toHaveBeenCalledWith("h1", {
      date: "2026-10-12",
      withDate: "2026-10-13",
      from: ME,
      to: PARTNER,
      message: "I am unwell",
    });
    expect(wrapper.text()).toContain("Swap request sent to Mei. Check the Swaps tab.");
    expect(solid(wrapper)).toHaveLength(0);
  });

  it("badges a night the partner has asked about", async () => {
    api.swaps = [
      { id: "s1", date: "2026-10-13", withDate: "2026-10-12", from: PARTNER, to: ME, status: "pending", message: "" },
    ];
    const { wrapper } = await mountPage();
    expect(wrapper.get('[data-date="2026-10-13"]').text()).toContain("Swap requested");
    // Pending requests do not change the plan.
    expect(wrapper.get('[data-date="2026-10-13"]').text()).toContain("Mei on duty");
  });

  it("lets me accept or decline my partner's request, and cancel my own", async () => {
    api.swaps = [
      { id: "s1", date: "2026-10-13", withDate: "2026-10-12", from: PARTNER, to: ME, status: "pending", message: "I am unwell" },
      { id: "s2", date: "2026-10-14", withDate: null, from: ME, to: PARTNER, status: "pending", message: "" },
    ];
    const { wrapper } = await mountPage();
    await openTab(wrapper, 1);
    expect(wrapper.text()).toContain("Mei gives Tue 13 October and takes Mon 12 October");
    expect(wrapper.text()).toContain("I am unwell");
    expect(wrapper.text()).toContain("Waiting for Mei");
    expect(wrapper.text()).not.toContain("once the database is connected");

    await buttonByText(wrapper, "Accept").trigger("click");
    await flushPromises();
    expect(api.respondToSwap).toHaveBeenCalledWith("h1", "s1", true, {
      uid: ME,
      nights: [
        { date: "2026-10-13", onCall: ME },
        { date: "2026-10-12", onCall: PARTNER },
      ],
    });
    await buttonByText(wrapper, "Cancel").trigger("click");
    await flushPromises();
    expect(api.cancelSwap).toHaveBeenCalledWith("h1", "s2");
  });

  it("declines without touching the nights, and lists answered requests", async () => {
    api.swaps = [
      { id: "s1", date: "2026-10-13", withDate: null, from: PARTNER, to: ME, status: "pending", message: "" },
      { id: "s0", date: "2026-10-05", withDate: null, from: ME, to: PARTNER, status: "accepted", message: "" },
      { id: "sx", date: "2026-10-06", withDate: null, from: ME, to: PARTNER, status: "cancelled", message: "" },
    ];
    const { wrapper } = await mountPage();
    await openTab(wrapper, 1);
    await buttonByText(wrapper, "Decline").trigger("click");
    await flushPromises();
    expect(api.respondToSwap).toHaveBeenCalledWith("h1", "s1", false, { uid: ME, nights: [] });
    expect(wrapper.text()).toContain("Accepted");
    // A cancelled request is not history worth showing.
    expect(wrapper.findAll(".rt__item")).toHaveLength(2);
  });

  it("says when there are no swap requests at all", async () => {
    const { wrapper } = await mountPage();
    await openTab(wrapper, 1);
    expect(wrapper.text()).toContain("No swap requests.");
  });

  it("takes an open night in manual mode", async () => {
    api.settings = { pattern: "manual", startDate: "2026-10-12", handoverTime: "07:00" };
    const { wrapper } = await mountPage();
    expect(wrapper.findAll(".rt__row .app-badge").filter((b) => b.text() === "Open")).toHaveLength(7);
    const takes = wrapper.findAll("button.app-chip").filter((b) => b.text() === "I take it");
    await takes[0].trigger("click");
    await flushPromises();
    expect(api.setNightOverride).toHaveBeenCalledWith("h1", ME, "2026-10-12", ME);
    const gives = wrapper.findAll("button.app-chip").filter((b) => b.text() === "Mei takes it");
    await gives[0].trigger("click");
    await flushPromises();
    expect(api.setNightOverride).toHaveBeenLastCalledWith("h1", ME, "2026-10-12", PARTNER);
  });

  it("puts a set night back on the plan", async () => {
    api.nights = [{ date: "2026-10-12", onCall: PARTNER, setBy: PARTNER }];
    const { wrapper } = await mountPage();
    await wrapper.get('[data-date="2026-10-12"]').get("button.app-textbtn").trigger("click");
    await flushPromises();
    expect(api.clearNightOverride).toHaveBeenCalledWith("h1", "2026-10-12");
  });

  it("saves the settings and says who saved them last", async () => {
    api.settings = {
      pattern: "alternate",
      firstOnDuty: ME,
      startDate: "2026-10-12",
      handoverTime: "07:00",
      updatedAt: new Date(NOW.getTime() - 5 * 60000),
      updatedBy: PARTNER,
    };
    const { wrapper } = await mountPage();
    await openTab(wrapper, 2);
    expect(wrapper.text()).toContain("Updated by Mei 5 minutes ago");
    await wrapper.findAll('[role="radio"]').find((r) => r.text() === "Split each night").trigger("click");
    await flushPromises();
    expect(api.saveRotaSettings).toHaveBeenCalledWith("h1", ME, { pattern: "split" });
    const time = wrapper.get('input[type="time"]');
    time.element.value = "08:30";
    await time.trigger("change");
    await flushPromises();
    expect(api.saveRotaSettings).toHaveBeenLastCalledWith("h1", ME, { handoverTime: "08:30" });
    expect(solid(wrapper)).toHaveLength(0);
  });

  it("resets the shared plan only after a confirmation", async () => {
    api.nights = [{ date: "2026-10-12", onCall: ME, setBy: ME }];
    const { wrapper } = await mountPage();
    await openTab(wrapper, 2);
    await buttonByText(wrapper, "Reset plan").trigger("click");
    expect(wrapper.text()).toContain("Reset the plan and clear every set night for both of you?");
    expect(api.saveRotaSettings).not.toHaveBeenCalled();
    await buttonByText(wrapper, "Yes, reset plan").trigger("click");
    await flushPromises();
    expect(api.saveRotaSettings).toHaveBeenCalled();
    expect(api.clearNightOverride).toHaveBeenCalledWith("h1", "2026-10-12");
  });

  it("asks for a swap when the week is unbalanced", async () => {
    api.settings = { pattern: "manual", startDate: "2026-10-12", handoverTime: "07:00" };
    api.nights = [
      ...["12", "13", "14", "15", "16"].map((d) => ({ date: `2026-10-${d}`, onCall: ME, setBy: ME })),
      { date: "2026-10-17", onCall: PARTNER, setBy: ME },
      { date: "2026-10-18", onCall: PARTNER, setBy: ME },
    ];
    const { wrapper } = await mountPage();
    expect(wrapper.text()).toContain("so Daniel has one more night off");
    await buttonByText(wrapper, "Apply suggestion").trigger("click");
    await flushPromises();
    expect(api.requestSwap).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("Swap request sent to Mei.");
  });

  it("shows a failed write without hiding the plan", async () => {
    api.setNightOverride.mockRejectedValueOnce(Object.assign(new Error("no"), { code: "permission-denied" }));
    api.settings = { pattern: "manual", startDate: "2026-10-12", handoverTime: "07:00" };
    const { wrapper } = await mountPage();
    await wrapper.findAll("button.app-chip").filter((b) => b.text() === "I take it")[0].trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("could not save that night");
    expect(wrapper.findAll("li.rt__row")).toHaveLength(7);
  });

  it("falls back to Me and Your partner without names", async () => {
    const { wrapper } = await mountPage({ named: false });
    expect(wrapper.text()).toContain("Me on duty");
    expect(wrapper.text()).toContain("Your partner rests first");
  });
});
