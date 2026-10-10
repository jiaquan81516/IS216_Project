import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { V3_HOME_KEY } from "@/v3/composables/useV3Home";
import { V3_ENTRIES_KEY } from "@/v3/composables/useV3Entries";
import { V3_HANDOVERS_KEY } from "@/v3/composables/useV3Handovers";
import { V3_SHARED_KEY } from "@/v3/composables/useV3Shared";

const api = vi.hoisted(() => ({
  accept: vi.fn(async () => {}),
  send: vi.fn(async () => "new-id"),
}));

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("@/v3/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("@/composables/useAuth", async () => {
  const { ref: vueRef } = await import("vue");
  return { useAuth: () => ({ currentUser: vueRef({ uid: "u1" }), logout: vi.fn() }) };
});
vi.mock("@/v3/api/handovers", () => ({
  acceptHandover: api.accept,
  sendHandover: api.send,
  subscribeHandovers: () => () => {},
  subscribeLatestHandover: () => () => {},
  updateHandover: vi.fn(),
  HANDOVERS_MAX: 30,
  NOTE_MAX: 400,
  ATTENTION_MAX: 140,
  NEXT_UP_MAX: 3,
}));

import HandoverPage from "./index.vue";

const ME = "u1";
const PARTNER = "u2";
const NOW = new Date("2026-10-10T19:00:00");

const ROTA_VIEW = {
  pattern: "alternate",
  firstOnDuty: "me",
  startDate: "2026-10-10",
  handoverTime: "07:00",
  overrides: {},
  swaps: [],
};

function incomingHandover(extra = {}) {
  return {
    id: "ho1",
    from: PARTNER,
    to: ME,
    sentAt: new Date("2026-10-10T07:10:00"),
    periodStart: new Date("2026-10-09T21:00:00"),
    note: "Fussy after the 3 PM feed, settled by 4.",
    needsAttention: false,
    attentionNote: "",
    summary: { feeds: 4, sleepMinutes: 220, nappies: 3 },
    nextUp: ["Bath at 7:30 PM"],
    acceptedAt: null,
    acceptedBy: null,
    ...extra,
  };
}

function statsOf(wrapper) {
  return wrapper
    .findAll(".ho__stats li")
    .map((li) => `${li.get(".ho__stat-value").text()} ${li.get(".ho__stat-label").text()}`);
}

async function mountPage({ handovers = [], entries = [], partner = true, rota = ROTA_VIEW } = {}) {
  const list = ref(handovers);
  const home = {
    loading: ref(false),
    error: ref(""),
    reload: vi.fn(),
    me: computed(() => ({ uid: ME, firstName: "daniel", displayName: "daniel Tan" })),
    partner: computed(() => (partner ? { uid: PARTNER, displayName: "Mei Lin", firstName: "mei" } : null)),
    householdId: ref("h1"),
  };
  const shared = {
    handovers: list,
    loading: ref(false),
    error: ref(null),
    latest: computed(() => list.value[0] ?? null),
    waitingForMe: computed(() => list.value.find((h) => h.to === ME && !h.acceptedAt) ?? null),
    waitingCount: computed(() => list.value.filter((h) => h.to === ME && !h.acceptedAt).length),
    retry: vi.fn(),
  };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  router.push("/");
  await router.isReady();
  const wrapper = mount(HandoverPage, {
    global: {
      plugins: [router],
      provide: {
        [V3_HOME_KEY]: home,
        [V3_ENTRIES_KEY]: { entries: ref(entries), loading: ref(false), error: ref(null), retry: vi.fn() },
        [V3_HANDOVERS_KEY]: shared,
        [V3_SHARED_KEY]: { rota: { view: rota } },
      },
    },
  });
  await flushPromises();
  return { wrapper, list, shared };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  api.accept.mockClear();
  api.send.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the V3 handover page", () => {
  it("has the title and the subtitle", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.get("h1").text()).toBe("Handover");
    expect(wrapper.text()).toContain("Hand the shift over with everything that matters.");
  });

  describe("when one is waiting for me", () => {
    it("reads it out, with the window, the three stats and the one solid button", async () => {
      const { wrapper } = await mountPage({ handovers: [incomingHandover()] });
      expect(wrapper.get("#ho-received").text()).toBe("Mei handed over at 7:10 AM");
      expect(wrapper.text()).toContain("Yesterday 9:00 PM to 7:10 AM");
      expect(statsOf(wrapper)).toEqual(["4 feeds", "3 h 40 min sleep", "3 nappies"]);
      expect(wrapper.text()).toContain("Fussy after the 3 PM feed, settled by 4.");
      expect(wrapper.text()).toContain("Bath at 7:30 PM");
      const solid = wrapper.findAll("button.btn-primary");
      expect(solid).toHaveLength(1);
      expect(solid[0].text()).toBe("Accept handover");
      expect(wrapper.find("#ho-send").exists()).toBe(false);
      expect(wrapper.find("#ho-note").exists()).toBe(false);
    });

    it("marks what needs attention with words, not only colour", async () => {
      const { wrapper } = await mountPage({
        handovers: [incomingHandover({ needsAttention: true, attentionNote: "Nappy rash, cream used at 2 PM" })],
      });
      const line = wrapper.get(".ho__attention");
      expect(line.text()).toContain("Needs attention");
      expect(line.text()).toContain("Nappy rash, cream used at 2 PM");
    });

    it("says so when no note was left", async () => {
      const { wrapper } = await mountPage({ handovers: [incomingHandover({ note: "" })] });
      expect(wrapper.text()).toContain("No note was left.");
    });

    it("accepts it and then shows the send form instead", async () => {
      const { wrapper, list } = await mountPage({ handovers: [incomingHandover()] });
      await wrapper.get("button.btn-primary").trigger("click");
      await flushPromises();
      expect(api.accept).toHaveBeenCalledWith("h1", "ho1", ME);
      expect(wrapper.text()).toContain("Handover accepted.");

      // Firestore answers by changing the document, which is what collapses the panel.
      list.value = [{ ...list.value[0], acceptedAt: new Date("2026-10-10T07:20:00"), acceptedBy: ME }];
      await flushPromises();
      expect(wrapper.find("#ho-received").exists()).toBe(false);
      expect(wrapper.find("#ho-send").exists()).toBe(true);
      expect(wrapper.text()).toContain("accepted");
    });

    it("explains a failed accept inline", async () => {
      api.accept.mockRejectedValueOnce({ code: "permission-denied" });
      const { wrapper } = await mountPage({ handovers: [incomingHandover()] });
      await wrapper.get("button.btn-primary").trigger("click");
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toContain("could not accept the handover");
      expect(wrapper.find("#ho-received").exists()).toBe(true);
    });
  });

  describe("when one is waiting for them", () => {
    it("shows the send form and the status in the history", async () => {
      const sent = {
        id: "ho2",
        from: ME,
        to: PARTNER,
        sentAt: new Date("2026-10-10T07:10:00"),
        periodStart: new Date("2026-10-10T00:00:00"),
        note: "All calm.",
        summary: { feeds: 2, sleepMinutes: 60, nappies: 1 },
        nextUp: [],
        acceptedAt: null,
      };
      const { wrapper } = await mountPage({ handovers: [sent] });
      expect(wrapper.find("#ho-received").exists()).toBe(false);
      expect(wrapper.get("#ho-send").text()).toBe("Since 7:10 AM");
      const row = wrapper.get(".ho__row");
      expect(row.text()).toContain("Daniel to Mei");
      expect(row.text()).toContain("waiting for Mei");
      expect(row.text()).toContain("2 feeds, 1 h sleep, 1 nappy");
    });

    it("shows a sent note only when asked", async () => {
      const { wrapper } = await mountPage({
        handovers: [{ id: "ho2", from: ME, to: PARTNER, sentAt: NOW, note: "All calm.", summary: {} }],
      });
      const toggle = wrapper.get(".ho__row-toggle");
      expect(toggle.attributes("aria-expanded")).toBe("false");
      expect(wrapper.find(".ho__row-note").exists()).toBe(false);
      await toggle.trigger("click");
      expect(toggle.attributes("aria-expanded")).toBe("true");
      expect(wrapper.get(".ho__row-note").text()).toBe("All calm.");
    });
  });

  describe("when there is none yet", () => {
    it("covers the day so far and says the history is empty", async () => {
      const entries = [
        { id: "e1", type: "feed", at: new Date("2026-10-10T18:00:00") },
        { id: "e2", type: "nappy", at: new Date("2026-10-10T09:00:00") },
      ];
      const { wrapper } = await mountPage({ entries });
      expect(wrapper.get("#ho-send").text()).toBe("Since 12:00 AM");
      expect(wrapper.text()).toContain("Everything logged since midnight.");
      expect(statsOf(wrapper)).toEqual(["1 feed", "0 min sleep", "1 nappy"]);
      expect(wrapper.text()).toContain("No handovers yet.");
      const solid = wrapper.findAll("button.btn-primary");
      expect(solid).toHaveLength(1);
      expect(solid[0].text()).toBe("Send handover to Mei");
    });

    it("offers suggestions built from the care log and the rota, and sends what I picked", async () => {
      const entries = [{ id: "e1", type: "feed", at: new Date("2026-10-10T18:00:00") }];
      const { wrapper } = await mountPage({ entries });
      const suggestions = wrapper.findAll(".ho__suggest-row").map((row) => row.get(".ho__suggest-text").text());
      expect(suggestions).toEqual(["Next feed due around 9:00 PM", "Daniel is on duty tonight"]);

      await wrapper.findAll(".ho__suggest-row")[0].get("button").trigger("click");
      expect(wrapper.findAll(".ho__chip").map((c) => c.text())).toContain("Next feed due around 9:00 PM");
      // An added suggestion is not offered twice.
      expect(wrapper.findAll(".ho__suggest-row")).toHaveLength(1);

      await wrapper.get("#ho-next").setValue("Bath at 7:30 PM");
      await wrapper.get(".ho__add").trigger("submit");
      await wrapper.get("#ho-note").setValue("Settled by 4.");
      await wrapper.get("#ho-attention").setValue(true);
      await wrapper.get("#ho-attention-note").setValue("Nappy rash");
      await wrapper.get("button.btn-primary").trigger("click");
      await flushPromises();

      expect(api.send).toHaveBeenCalledTimes(1);
      const [user, hid, payload] = api.send.mock.calls[0];
      expect(user).toEqual({ uid: ME });
      expect(hid).toBe("h1");
      expect(payload).toMatchObject({
        to: PARTNER,
        note: "Settled by 4.",
        needsAttention: true,
        attentionNote: "Nappy rash",
        nextUp: ["Next feed due around 9:00 PM", "Bath at 7:30 PM"],
        summary: { feeds: 1, sleepMinutes: 0, nappies: 0 },
      });
      expect(payload.periodStart.getHours()).toBe(0);
      expect(wrapper.text()).toContain("Handover sent to Mei.");
      expect(wrapper.get("#ho-note").element.value).toBe("");
    });

    it("stops at three things coming up and lets me take one out", async () => {
      const { wrapper } = await mountPage();
      for (const text of ["One", "Two", "Three"]) {
        await wrapper.get("#ho-next").setValue(text);
        await wrapper.get(".ho__add").trigger("submit");
      }
      expect(wrapper.findAll(".ho__chip")).toHaveLength(3);
      expect(wrapper.find(".ho__add").exists()).toBe(false);
      await wrapper.findAll(".ho__chip-remove")[0].trigger("click");
      expect(wrapper.findAll(".ho__chip").map((c) => c.text())).toEqual(["Two", "Three"]);
      expect(wrapper.find(".ho__add").exists()).toBe(true);
    });

    it("hides the attention input until the box is ticked", async () => {
      const { wrapper } = await mountPage();
      expect(wrapper.find("#ho-attention-note").exists()).toBe(false);
      await wrapper.get("#ho-attention").setValue(true);
      expect(wrapper.find("#ho-attention-note").exists()).toBe(true);
    });

    it("explains a failed send inline", async () => {
      api.send.mockRejectedValueOnce({ code: "unavailable" });
      const { wrapper } = await mountPage();
      await wrapper.get("button.btn-primary").trigger("click");
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toContain("could not send the handover");
    });
  });

  describe("when nobody has joined yet", () => {
    it("disables sending and says why", async () => {
      const { wrapper } = await mountPage({ partner: false });
      const button = wrapper.get("button.btn-primary");
      expect(button.attributes("disabled")).toBeDefined();
      expect(wrapper.get(".ho__no-partner").text()).toContain("There is nobody to hand over to yet.");
      await button.trigger("click");
      expect(api.send).not.toHaveBeenCalled();
    });
  });

  describe("loading and errors", () => {
    it("says it is loading in a live region", async () => {
      const { wrapper, shared } = await mountPage();
      shared.loading.value = true;
      await flushPromises();
      const live = wrapper.findAll('[aria-live="polite"]');
      expect(live.some((node) => node.text().includes("Loading the handover..."))).toBe(true);
      expect(wrapper.find("#ho-send").exists()).toBe(false);
    });

    it("tells me to publish the rules when the database says no", async () => {
      const { wrapper, shared } = await mountPage();
      shared.error.value = { code: "permission-denied" };
      await flushPromises();
      const alert = wrapper.get('[role="alert"]');
      expect(alert.text()).toContain("Publish the latest firestore.rules");
      await alert.get("button").trigger("click");
      expect(shared.retry).toHaveBeenCalled();
    });
  });
});
