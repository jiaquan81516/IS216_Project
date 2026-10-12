import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { computed, reactive, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { HOME_KEY } from "@/app/composables/useHome";
import { ENTRIES_KEY } from "@/app/composables/useEntries";
import { HANDOVERS_KEY } from "@/app/composables/useHandovers";
import { SHARED_KEY } from "@/app/composables/useShared";

const api = vi.hoisted(() => ({
  accept: vi.fn(async () => {}),
  send: vi.fn(async () => "new-id"),
}));

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("@/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("@/composables/useAuth", async () => {
  const { ref: vueRef } = await import("vue");
  return { useAuth: () => ({ currentUser: vueRef({ uid: "u1" }), logout: vi.fn() }) };
});
vi.mock("@/api/handovers", () => ({
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

import HandoverPage from "@/app/pages/handover/index.vue";

const ME = "u1";
const PARTNER = "u2";
const NOW = new Date("2026-10-10T19:00:00");

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

async function mountPage({ handovers = [], entries = [], partner = true, checklist = [] } = {}) {
  const rtw = reactive({
    tasks: checklist,
    toggleTask: vi.fn(async () => true),
    updateTask: vi.fn(async () => ({})),
  });
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
        [HOME_KEY]: home,
        [ENTRIES_KEY]: { entries: ref(entries), loading: ref(false), error: ref(null), retry: vi.fn() },
        [HANDOVERS_KEY]: shared,
        [SHARED_KEY]: { rtw },
      },
    },
  });
  await flushPromises();
  return { wrapper, list, shared, rtw };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  api.accept.mockClear();
  api.send.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the App handover page", () => {
  it("has the title and no subtitle", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.get("h1").text()).toBe("Handover");
    expect(wrapper.text()).not.toContain("Hand the shift over");
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
    it("shows the send form and only the last handover in the side panel", async () => {
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
      const older = { ...sent, id: "ho1", sentAt: new Date("2026-10-09T07:10:00"), note: "Older note." };
      const { wrapper } = await mountPage({ handovers: [sent, older] });
      expect(wrapper.find("#ho-received").exists()).toBe(false);
      expect(wrapper.get("#ho-send").text()).toBe("Since your last handover at 7:10 AM");
      expect(wrapper.get("#ho-last").text()).toBe("Last handover");
      const card = wrapper.get(".ho__last");
      expect(card.text()).toContain("Today, 7:10 AM");
      expect(card.text()).toContain("Daniel to Mei");
      expect(card.text()).toContain("waiting for Mei");
      expect(card.text()).toContain("2 feeds, 1 h sleep, 1 nappy");
      expect(card.text()).toContain("All calm.");
      expect(wrapper.text()).not.toContain("Older note.");
      expect(wrapper.find(".ho__row").exists()).toBe(false);
    });
  });

  describe("when there is none yet", () => {
    it("covers the day so far and says there is no last handover", async () => {
      const entries = [
        { id: "e1", type: "feed", at: new Date("2026-10-10T18:00:00") },
        { id: "e2", type: "nappy", at: new Date("2026-10-10T09:00:00") },
      ];
      const { wrapper } = await mountPage({ entries });
      expect(wrapper.get("#ho-send").text()).toBe("Since 12:00 AM");
      expect(statsOf(wrapper)).toEqual(["1 feed", "0 min sleep", "1 nappy"]);
      expect(wrapper.text()).toContain("No handovers yet.");
      const solid = wrapper.findAll("button.btn-primary");
      expect(solid).toHaveLength(1);
      expect(solid[0].text()).toBe("Send to Mei");
    });

    it("has no attention switch and no coming up list on the send form", async () => {
      const { wrapper } = await mountPage();
      expect(wrapper.find("#ho-attention").exists()).toBe(false);
      expect(wrapper.get("#ho-send").element.closest("section").textContent).not.toContain("Needs attention");
      expect(wrapper.get("#ho-send").element.closest("section").textContent).not.toContain("Coming up");
    });

    it("turns the taps and the one line into a single note when sent", async () => {
      const entries = [{ id: "e1", type: "feed", at: new Date("2026-10-10T18:00:00") }];
      const { wrapper } = await mountPage({ entries });
      const picks = wrapper.findAll(".ho__picks .ho__pick");
      expect(picks.map((b) => b.text())).toEqual([
        "Fussy after feeds",
        "Nappy rash",
        "Spit-up",
        "Slept well",
        "Needed rocking",
        "Long nap",
      ]);
      // Tapped out of order, the note still follows the list order.
      await picks[1].trigger("click");
      await picks[0].trigger("click");
      expect(picks[0].attributes("aria-pressed")).toBe("true");
      await picks[2].trigger("click");
      await picks[2].trigger("click");
      expect(picks[2].attributes("aria-pressed")).toBe("false");
      await wrapper.get("#ho-line").setValue("Cream used at 2 PM");
      await wrapper.get("button.btn-primary").trigger("click");
      await flushPromises();

      expect(api.send).toHaveBeenCalledTimes(1);
      const [user, hid, payload] = api.send.mock.calls[0];
      expect(user).toEqual({ uid: ME });
      expect(hid).toBe("h1");
      expect(payload).toMatchObject({
        to: PARTNER,
        note: "Fussy after feeds, Nappy rash. Cream used at 2 PM",
        summary: { feeds: 1, sleepMinutes: 0, nappies: 0 },
      });
      expect(payload).not.toHaveProperty("needsAttention");
      expect(payload.periodStart.getHours()).toBe(0);
      expect(wrapper.text()).toContain("Handover sent to Mei.");
      expect(wrapper.get("#ho-line").element.value).toBe("");
      expect(wrapper.findAll(".ho__picks [aria-pressed='true']")).toHaveLength(0);
    });

    it("can send with nothing tapped or typed", async () => {
      const { wrapper } = await mountPage();
      await wrapper.get("button.btn-primary").trigger("click");
      await flushPromises();
      expect(api.send.mock.calls[0][2].note).toBe("");
    });

    it("lets me change where the summary starts", async () => {
      const entries = [
        { id: "e1", type: "feed", at: new Date("2026-10-10T08:00:00") },
        { id: "e2", type: "feed", at: new Date("2026-10-10T17:00:00") },
      ];
      const { wrapper } = await mountPage({ entries });
      expect(wrapper.find("#ho-window").exists()).toBe(false);
      expect(statsOf(wrapper)[0]).toBe("2 feeds");
      await wrapper.get(".ho__change").trigger("click");
      const choices = wrapper.findAll("#ho-window .ho__pick");
      expect(choices.map((b) => b.text())).toEqual(["Start of today", "Last 6 hours"]);
      await choices[1].trigger("click");
      expect(wrapper.find("#ho-window").exists()).toBe(false);
      expect(wrapper.get("#ho-send").text()).toBe("Since 1:00 PM");
      expect(statsOf(wrapper)[0]).toBe("1 feed");
    });

    it("explains a failed send inline", async () => {
      api.send.mockRejectedValueOnce({ code: "unavailable" });
      const { wrapper } = await mountPage();
      await wrapper.get("button.btn-primary").trigger("click");
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toContain("could not send the handover");
    });
  });

  describe("tasks", () => {
    const task = (id, extra = {}) => ({ id, title: `Task ${id}`, owner: ME, due: null, done: false, queued: false, ...extra });

    it("lists my own open checklist tasks, unticked, and says so when there are none", async () => {
      const { wrapper } = await mountPage({
        checklist: [
          task("a", { title: "Call clinic", due: "2026-10-10" }),
          task("b", { title: "Mei's job", owner: PARTNER }),
          task("c", { title: "Shared job", owner: "both" }),
          task("d", { title: "Finished", done: true }),
        ],
      });
      expect(wrapper.get("#ho-tasks-title").text()).toBe("Tasks to pass on to Mei");
      const rows = wrapper.findAll(".ho__task");
      expect(rows).toHaveLength(1);
      expect(rows[0].text()).toContain("Call clinic");
      expect(rows[0].text()).toContain("Due today");
      expect(rows[0].get("input").element.checked).toBe(false);
      expect(wrapper.get(".ho__tasks-head a").text()).toBe("Open checklist");

      const empty = await mountPage();
      expect(empty.wrapper.text()).toContain("You have no open tasks");
    });

    it("starts with the tasks I queued on the checklist ticked", async () => {
      const { wrapper } = await mountPage({ checklist: [task("a", { queued: true }), task("b")] });
      const boxes = wrapper.findAll(".ho__task input");
      expect(boxes.map((b) => b.element.checked)).toEqual([true, false]);
      expect(wrapper.findAll(".ho__task")[0].text()).toContain("Queued on the checklist");
    });

    it("sends the ticked tasks and then gives them to my partner on the checklist", async () => {
      const { wrapper, rtw } = await mountPage({
        checklist: [task("a", { title: "Call clinic" }), task("b", { title: "Book vaccination", queued: true }), task("c", { title: "Stays" })],
      });
      // b starts ticked from the queue; tick a as well and leave c. The list is sorted by title.
      const row = wrapper.findAll(".ho__task").find((r) => r.text().includes("Call clinic"));
      await row.get("input").setValue(true);
      await wrapper.get("button.btn-primary").trigger("click");
      await flushPromises();

      expect(api.send.mock.calls[0][2].tasks).toEqual([
        { id: "t1", text: "Book vaccination", ref: "b" },
        { id: "t2", text: "Call clinic", ref: "a" },
      ]);
      expect(rtw.updateTask).toHaveBeenCalledTimes(2);
      expect(rtw.updateTask).toHaveBeenCalledWith("a", { owner: PARTNER, queued: false });
      expect(rtw.updateTask).toHaveBeenCalledWith("b", { owner: PARTNER, queued: false });
    });

    it("lets me untick a queued task, and hands over nothing when nothing is ticked", async () => {
      const { wrapper, rtw } = await mountPage({ checklist: [task("a", { queued: true })] });
      await wrapper.get(".ho__task input").setValue(false);
      await wrapper.get("button.btn-primary").trigger("click");
      await flushPromises();
      expect(api.send.mock.calls[0][2].tasks).toEqual([]);
      expect(rtw.updateTask).not.toHaveBeenCalled();
    });

    it("stops at six ticked tasks", async () => {
      const checklist = Array.from({ length: 8 }, (_, i) => task(`t${i}`, { queued: true }));
      const { wrapper } = await mountPage({ checklist });
      const boxes = wrapper.findAll(".ho__task input");
      expect(boxes.filter((b) => b.element.checked)).toHaveLength(8);
      await wrapper.get("button.btn-primary").trigger("click");
      await flushPromises();
      expect(api.send.mock.calls[0][2].tasks).toHaveLength(6);
    });

    it("shows my tasks to tick before I accept, and ticks them on the checklist", async () => {
      const handed = [
        { id: "t1", text: "Clinic visit", ref: "a" },
        { id: "t2", text: "Buy formula", ref: "b" },
      ];
      const { wrapper, rtw } = await mountPage({
        handovers: [incomingHandover({ tasks: handed })],
        checklist: [task("a", { done: true }), task("b")],
      });
      expect(wrapper.text()).toContain("Tasks for you");
      const boxes = wrapper.findAll(".hot__box");
      expect(boxes.map((b) => b.element.checked)).toEqual([true, false]);
      await boxes[1].setValue(true);
      await flushPromises();
      expect(rtw.toggleTask).toHaveBeenCalledWith("b");
    });

    it("shows my partner's tasks in the last handover card with progress, and ticks from there", async () => {
      const handed = [
        { id: "t1", text: "Clinic visit", ref: "a" },
        { id: "t2", text: "Buy formula", ref: "b" },
      ];
      const { wrapper, rtw } = await mountPage({
        handovers: [incomingHandover({ tasks: handed, acceptedAt: new Date("2026-10-10T07:20:00"), acceptedBy: ME })],
        checklist: [task("a", { done: true }), task("b")],
      });
      const card = wrapper.get(".ho__last");
      expect(card.text()).toContain("Tasks for you");
      expect(card.text()).toContain("1 of 2 done");
      await card.findAll(".hot__box")[0].setValue(false);
      await flushPromises();
      expect(rtw.toggleTask).toHaveBeenCalledWith("a");
    });

    it("shows progress, read only, on tasks I handed over", async () => {
      const sent = {
        id: "ho2",
        from: ME,
        to: PARTNER,
        sentAt: new Date("2026-10-10T07:10:00"),
        note: "",
        summary: {},
        tasks: [
          { id: "t1", text: "Clinic visit", ref: "a" },
          { id: "t2", text: "Buy formula", ref: "b" },
        ],
      };
      const { wrapper } = await mountPage({
        handovers: [sent],
        checklist: [task("a", { done: true, owner: PARTNER }), task("b", { done: true, owner: PARTNER })],
      });
      const card = wrapper.get(".ho__last");
      expect(card.text()).toContain("Tasks you handed over");
      expect(card.text()).toContain("All done");
      expect(card.findAll(".hot__box").every((box) => box.attributes("disabled") !== undefined)).toBe(true);
    });

    it("explains a failed tick inline", async () => {
      const { wrapper, rtw } = await mountPage({
        handovers: [
          incomingHandover({
            tasks: [{ id: "t1", text: "Buy formula", ref: "b" }],
            acceptedAt: new Date("2026-10-10T07:20:00"),
            acceptedBy: ME,
          }),
        ],
        checklist: [task("b")],
      });
      rtw.toggleTask.mockResolvedValueOnce(false);
      await wrapper.get(".ho__last .hot__box").setValue(true);
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toContain("could not update that task");
    });
  });

  describe("when nobody has joined yet", () => {
    it("disables sending and says why", async () => {
      const { wrapper } = await mountPage({ partner: false });
      const button = wrapper.get("button.btn-primary");
      expect(button.attributes("disabled")).toBeDefined();
      expect(wrapper.get(".ho__no-partner").text()).toContain("Invite your partner");
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
