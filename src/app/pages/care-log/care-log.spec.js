import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

const state = vi.hoisted(() => ({
  entries: [],
  entriesError: null,
  handovers: [],
  profileGate: null,
  profile: null,
  household: null,
  members: [],
  deleteEntry: vi.fn(async () => {}),
  markSeen: vi.fn(async () => {}),
  addEntry: vi.fn(async () => "new"),
  updateEntry: vi.fn(async () => {}),
}));

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("@/app/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("@/composables/useAuth", async () => {
  const { ref } = await import("vue");
  const currentUser = ref({ uid: "u1", displayName: "Daniel Tan", email: "daniel@example.com" });
  return { useAuth: () => ({ currentUser, logout: vi.fn() }) };
});
vi.mock("@/app/api/profile", async (importOriginal) => ({
  ...(await importOriginal()),
  getUserProfile: vi.fn(async () => {
    if (state.profileGate) await state.profileGate;
    return state.profile;
  }),
  getHousehold: vi.fn(async () => state.household),
  getHouseholdMembers: vi.fn(async () => state.members),
}));
vi.mock("@/app/api/entries", () => ({
  subscribeEntries: (_id, onData, onError) => {
    queueMicrotask(() => (state.entriesError ? onError(state.entriesError) : onData(state.entries)));
    return () => {};
  },
  loadOlder: vi.fn(async () => []),
  deleteEntry: (...args) => state.deleteEntry(...args),
  markSeen: (...args) => state.markSeen(...args),
  addEntry: (...args) => state.addEntry(...args),
  updateEntry: (...args) => state.updateEntry(...args),
}));
vi.mock("@/app/api/handovers", () => ({
  HANDOVERS_MAX: 30,
  subscribeHandovers: (_id, onData) => {
    queueMicrotask(() => onData(state.handovers));
    return () => {};
  },
}));

import CareLogPage from "./index.vue";

const ts = (date) => ({ toDate: () => date });
const minutesAgo = (n) => new Date(Date.now() - n * 60000);
const yesterdayNoon = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return d;
};

async function mountPage(query = "", { settle = true } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  router.push(`/care-log${query}`);
  await router.isReady();
  const wrapper = mount(CareLogPage, { global: { plugins: [router] } });
  if (settle) await flushPromises();
  return { wrapper, router };
}

beforeEach(() => {
  state.deleteEntry.mockClear();
  state.markSeen.mockClear();
  state.entriesError = null;
  state.handovers = [];
  state.profileGate = null;
  state.profile = { displayName: "Daniel Tan", email: "daniel@example.com", householdId: "h1" };
  state.household = { inviteCode: "NT-4F7K", babyName: "Aria", babyStatus: "born", babyDate: "2000-01-01" };
  state.members = [
    { uid: "u1", displayName: "Daniel Tan" },
    { uid: "u2", displayName: "Mei Lin" },
  ];
  state.entries = [
    {
      id: "e1",
      type: "feed",
      by: "u2",
      byName: "mei",
      at: ts(minutesAgo(5)),
      endedAt: null,
      details: { method: "breast", side: "left", minutes: 18 },
      seenBy: { u2: ts(new Date()) },
    },
    {
      id: "e2",
      type: "nappy",
      by: "u1",
      byName: "Daniel",
      at: ts(minutesAgo(3)),
      endedAt: null,
      details: { nappyType: "wet" },
      seenBy: { u1: ts(new Date()), u2: ts(new Date()) },
    },
    {
      id: "e3",
      type: "feed",
      by: "u1",
      byName: "Daniel",
      at: ts(yesterdayNoon()),
      endedAt: null,
      details: { method: "bottle", ml: 90 },
      seenBy: { u1: ts(new Date()) },
    },
  ];
});

describe("App care log", () => {
  it("renders the header, the last feed strip and today's stats", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.get("h1").text()).toBe("Care log");
    const strip = wrapper.get(".cl__strip").text();
    expect(strip).toContain("Last feed");
    expect(strip).toContain("18 minutes breastfeeding, logged by Mei");
    expect(strip).toContain("1 feed");
    expect(strip).toContain("1 nappy");
    expect(strip).toContain("sleep");
  });

  it("groups entries by day", async () => {
    const { wrapper } = await mountPage();
    const days = wrapper.findAll(".cl__day-title").map((h) => h.text());
    expect(days).toEqual(["Today", "Yesterday"]);
    expect(wrapper.findAll(".cl__row")).toHaveLength(3);
    expect(wrapper.text()).toContain("Breastfeeding, left, 18 minutes");
    expect(wrapper.text()).toContain("by Mei");
    expect(wrapper.text()).toContain("by you");
    expect(wrapper.text()).toContain("Seen by Mei");
  });

  it("shows the empty state and no last feed", async () => {
    state.entries = [];
    const { wrapper } = await mountPage();
    expect(wrapper.text()).toContain("No care logged yet");
    expect(wrapper.text()).toContain("Log the first feed or nap and your partner will see it here.");
    expect(wrapper.text()).toContain("No feeds logged yet");
  });

  it("shows Loading the log and never the alert until the household id exists", async () => {
    let release;
    state.profileGate = new Promise((resolve) => {
      release = resolve;
    });
    const { wrapper } = await mountPage("", { settle: false });
    await flushPromises();
    expect(wrapper.text()).toContain("Loading the log...");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    release();
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.get("h1").text()).toBe("Care log");
  });

  it("shows no alert for an empty household", async () => {
    state.entries = [];
    const { wrapper } = await mountPage();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("No care logged yet");
  });

  it("explains permission-denied specifically", async () => {
    state.entriesError = { code: "permission-denied" };
    const { wrapper } = await mountPage();
    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain("Your database rules do not allow reading the care log yet.");
    expect(alert.text()).toContain("Publish the latest firestore.rules in the Firebase console");
  });

  it("explains a missing index, a connection problem and unknown codes", async () => {
    state.entriesError = { code: "failed-precondition" };
    expect((await mountPage()).wrapper.get('[role="alert"]').text()).toContain("needs an index");
    state.entriesError = { code: "unavailable" };
    expect((await mountPage()).wrapper.get('[role="alert"]').text()).toContain("Check your connection");
    state.entriesError = { code: "weird" };
    const text = (await mountPage()).wrapper.get('[role="alert"]').text();
    expect(text).toContain("We could not load the care log.");
    expect(text).toContain("weird");
  });

  it("does not turn a failed mark-as-seen into an error", async () => {
    state.markSeen.mockRejectedValueOnce(Object.assign(new Error("nope"), { code: "permission-denied" }));
    const { wrapper } = await mountPage();
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("offers edit and delete only on my entries", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.findAll('[aria-label="Edit entry"]')).toHaveLength(2);
    expect(wrapper.findAll('[aria-label="Delete entry"]')).toHaveLength(2);
    const partnerRow = wrapper.findAll(".cl__row").find((r) => r.text().includes("Breastfeeding"));
    expect(partnerRow.find('[aria-label="Edit entry"]').exists()).toBe(false);
    expect(partnerRow.find('[aria-label="Delete entry"]').exists()).toBe(false);
  });

  it("asks for confirmation before deleting", async () => {
    const { wrapper } = await mountPage();
    const row = wrapper.findAll(".cl__row").find((r) => r.text().includes("Wet nappy"));
    await row.get('[aria-label="Delete entry"]').trigger("click");
    expect(row.text()).toContain("Delete this entry?");
    expect(state.deleteEntry).not.toHaveBeenCalled();
    await row.findAll("button").find((b) => b.text() === "Delete").trigger("click");
    await flushPromises();
    expect(state.deleteEntry).toHaveBeenCalledWith("h1", "e2");
  });

  it("can cancel a delete", async () => {
    const { wrapper } = await mountPage();
    const row = wrapper.findAll(".cl__row").find((r) => r.text().includes("Wet nappy"));
    await row.get('[aria-label="Delete entry"]').trigger("click");
    await row.findAll("button").find((b) => b.text() === "Cancel").trigger("click");
    expect(row.text()).not.toContain("Delete this entry?");
    expect(state.deleteEntry).not.toHaveBeenCalled();
  });

  it("filters to mine and to new", async () => {
    const { wrapper } = await mountPage();
    const chips = () => wrapper.findAll(".cl__filters button");
    await chips().find((b) => b.text() === "Mine").trigger("click");
    expect(chips().find((b) => b.text() === "Mine").attributes("aria-pressed")).toBe("true");
    expect(wrapper.findAll(".cl__row")).toHaveLength(2);
    await chips().find((b) => b.text() === "New").trigger("click");
    const rows = wrapper.findAll(".cl__row");
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain("by Mei");
  });

  it("badges unseen partner entries as New and marks them seen", async () => {
    const { wrapper } = await mountPage();
    const partnerRow = wrapper.findAll(".cl__row").find((r) => r.text().includes("Breastfeeding"));
    expect(partnerRow.text()).toContain("New");
    const mine = wrapper.findAll(".cl__row").filter((r) => r.text().includes("by you"));
    expect(mine.every((r) => !r.text().includes("New"))).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(state.markSeen).toHaveBeenCalledWith("h1", ["e1"], "u1");
    expect(partnerRow.text()).toContain("New");
  });

  it("has exactly one solid primary button while the panel is closed, and Save is the one when open", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.findAll(".btn-primary")).toHaveLength(1);
    expect(wrapper.get(".btn-primary").text()).toBe("Log care");
    await wrapper.get(".btn-primary").trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.findAll(".btn-primary")).toHaveLength(1);
    expect(wrapper.get(".btn-primary").text()).toBe("Save");
  });

  it("opens the panel on a quick log tile with that type selected", async () => {
    const { wrapper } = await mountPage();
    const tile = wrapper.findAll(".cl__tile").find((b) => b.text().includes("Medication"));
    await tile.trigger("click");
    const selected = wrapper.get('[role="dialog"] [role="radio"][aria-checked="true"]');
    expect(selected.text()).toBe("Medication");
  });

  it("opens on Feeding for ?log=feed and removes the query", async () => {
    const { wrapper, router } = await mountPage("?log=feed");
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.get('[role="dialog"] [role="radio"][aria-checked="true"]').text()).toBe("Feeding");
    expect(router.currentRoute.value.query.log).toBeUndefined();
  });
});

describe("App care log handover dividers", () => {
  it("draws no divider when the household has no handovers", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.find(".cl__handover").exists()).toBe(false);
  });

  it("labels the boundary between the entries either side of a handover", async () => {
    const sentAt = minutesAgo(4);
    state.handovers = [{ id: "ho1", from: "u2", to: "u1", sentAt: ts(sentAt), summary: {} }];
    const { wrapper } = await mountPage();
    const dividers = wrapper.findAll(".cl__handover");
    expect(dividers).toHaveLength(1);
    expect(dividers[0].text()).toMatch(/^Handover sent \d{1,2}:\d{2} (AM|PM)$/);
    // Today has two entries, one on each side of the boundary, and they both still render.
    const today = wrapper.findAll(".cl__day")[0];
    const rows = today.findAll(".cl__rows > li");
    expect(rows.map((li) => li.classes().includes("cl__handover"))).toEqual([false, true, false]);
  });

  it("leaves out a boundary with nothing on one side of it", async () => {
    state.handovers = [{ id: "ho1", from: "u2", to: "u1", sentAt: ts(minutesAgo(1)), summary: {} }];
    const { wrapper } = await mountPage();
    expect(wrapper.find(".cl__handover").exists()).toBe(false);
  });
});
