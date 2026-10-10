import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

const state = vi.hoisted(() => ({
  profile: null,
  household: null,
  members: [],
  fail: false,
  entries: [],
  entriesError: null,
  handovers: [],
}));

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("@/v3/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("@/composables/useAuth", async () => {
  const { ref } = await import("vue");
  const currentUser = ref({ uid: "u1", displayName: "Daniel Tan", email: "daniel@example.com" });
  return { useAuth: () => ({ currentUser, logout: vi.fn() }) };
});
vi.mock("@/v3/api/profile", async (importOriginal) => ({
  ...(await importOriginal()),
  getUserProfile: vi.fn(async () => {
    if (state.fail) throw new Error("offline");
    return state.profile;
  }),
  getHousehold: vi.fn(async () => state.household),
  getHouseholdMembers: vi.fn(async () => state.members),
}));

vi.mock("@/v3/api/entries", () => ({
  subscribeEntries: (_id, onData, onError) => {
    queueMicrotask(() => (state.entriesError ? onError(state.entriesError) : onData(state.entries)));
    return () => {};
  },
}));
vi.mock("@/v3/api/handovers", () => ({
  HANDOVERS_MAX: 30,
  subscribeHandovers: (_id, onData) => {
    queueMicrotask(() => onData(state.handovers));
    return () => {};
  },
}));

import HomePage from "./index.vue";

function isoDaysAgo(days) {
  const d = new Date(Date.now() - days * 86400000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function mountHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  const wrapper = mount(HomePage, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

const daniel = { uid: "u1", displayName: "daniel Tan", role: "parent" };
const mei = { uid: "u2", displayName: "Mei Lin", role: "partner" };

beforeEach(() => {
  state.fail = false;
  state.profile = { displayName: "daniel Tan", email: "daniel@example.com", householdId: "h1" };
  state.household = {
    inviteCode: "NT-4F7K",
    babyName: "Aria",
    babyStatus: "born",
    babyDate: isoDaysAgo(42),
  };
  state.members = [daniel, mei];
  state.entries = [];
  state.entriesError = null;
  state.handovers = [];
});

const ts = (date) => ({ toDate: () => date });
const minutesAgo = (n) => new Date(Date.now() - n * 60000);
function feedFromMei(overrides = {}) {
  return {
    id: "e1",
    type: "feed",
    by: "u2",
    byName: "mei",
    at: ts(minutesAgo(20)),
    details: { method: "breast", side: "left", minutes: 18 },
    seenBy: { u2: ts(new Date()) },
    ...overrides,
  };
}

describe("V3 home", () => {
  it("greets the signed in parent by capitalised first name and shows the baby line", async () => {
    const wrapper = await mountHome();
    expect(wrapper.get("h1").text()).toMatch(/^Good (morning|afternoon|evening), Daniel$/);
    expect(wrapper.text()).toContain("Aria is 6 weeks old");
  });

  it("shows the empty state with no sample content", async () => {
    const wrapper = await mountHome();
    const headings = wrapper.findAll("h2").map((h) => h.text());
    expect(headings).toContain("Log your first care entry");
    expect(headings).toContain("Recent activity");
    expect(headings).toContain("How are you holding up?");
    expect(headings).not.toContain("Tonight");
    expect(wrapper.text()).toContain("Feeds, naps and nappies you log show up here for both of you.");
    expect(wrapper.text()).toContain("Latest from you and Mei");
    expect(wrapper.text()).toContain("Nothing logged yet.");
    expect(wrapper.text()).not.toContain("Sample");
    expect(wrapper.text()).not.toContain("Feed due around");
    expect(wrapper.text()).not.toContain("handover");
    expect(wrapper.findAll(".btn-primary")).toHaveLength(1);
    expect(wrapper.get(".btn-primary").text()).toBe("Log care");
  });

  it("shows the last feed and recent rows from real entries", async () => {
    state.entries = [
      feedFromMei(),
      {
        id: "e2",
        type: "nappy",
        by: "u1",
        byName: "Daniel",
        at: ts(minutesAgo(90)),
        details: { nappyType: "wet" },
        seenBy: { u1: ts(new Date()) },
      },
    ];
    const wrapper = await mountHome();
    const headings = wrapper.findAll("h2").map((h) => h.text());
    expect(headings.some((h) => h.startsWith("Last feed"))).toBe(true);
    expect(wrapper.text()).toContain("Breastfeeding, left, 18 minutes by Mei.");
    expect(wrapper.text()).not.toContain("Sample");
    const rows = wrapper.findAll(".hp__row");
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("New");
    expect(rows[1].text()).toContain("by you");
    expect(rows[1].text()).not.toContain("New");
    expect(wrapper.findAll(".btn-primary")).toHaveLength(1);
    expect(wrapper.get(".btn-primary").text()).toBe("Log a feed");
    expect(wrapper.findAll("a").some((a) => a.text() === "Open care log")).toBe(true);
  });

  it("shows only the five newest entries", async () => {
    state.entries = Array.from({ length: 8 }, (_, i) => feedFromMei({ id: `e${i}`, at: ts(minutesAgo(i + 1)) }));
    const wrapper = await mountHome();
    expect(wrapper.findAll(".hp__row")).toHaveLength(5);
  });

  it("shows a specific message when the entries cannot be read", async () => {
    state.entriesError = { code: "permission-denied" };
    const wrapper = await mountHome();
    expect(wrapper.text()).toContain("Publish the latest firestore.rules");
    expect(wrapper.text()).not.toContain("Sample");
  });

  it("hides the invite notice when a partner has joined", async () => {
    const wrapper = await mountHome();
    expect(wrapper.text()).not.toContain("Invite your partner");
  });

  it("shows the invite notice with the code when no partner has joined", async () => {
    state.members = [daniel];
    const wrapper = await mountHome();
    expect(wrapper.text()).toContain("Invite your partner with code NT-4F7K");
    expect(wrapper.findAll("button").some((b) => b.text() === "Copy code")).toBe(true);
    expect(wrapper.find("header").text()).not.toContain("Invite");
    expect(wrapper.text()).toContain("Latest from you and your partner");
  });

  it("shows an alert with a retry button when the household cannot load", async () => {
    state.fail = true;
    const wrapper = await mountHome();
    expect(wrapper.get('[role="alert"]').text()).toContain("could not load your household");
    expect(wrapper.find("h1").exists()).toBe(false);
    const retry = wrapper.findAll("button").find((b) => b.text() === "Try again");
    expect(retry).toBeTruthy();
    state.fail = false;
    await retry.trigger("click");
    await flushPromises();
    expect(wrapper.find("h1").exists()).toBe(true);
  });
});

describe("V3 home private check-in box", () => {
  it("links Check in privately to the V3 wellness page", async () => {
    const wrapper = await mountHome();
    const link = wrapper.findAll("a").find((a) => a.text() === "Check in privately");
    expect(link.attributes("href")).toBe("/wellness");
  });
});

describe("V3 home and the handover", () => {
  const waiting = {
    id: "ho1",
    from: "u2",
    to: "u1",
    sentAt: ts(new Date(new Date().setHours(7, 10, 0, 0))),
    periodStart: ts(new Date(new Date().setHours(0, 0, 0, 0))),
    summary: { feeds: 4, sleepMinutes: 220, nappies: 3 },
    acceptedAt: null,
  };

  it("says nothing about a handover when there is none", async () => {
    const wrapper = await mountHome();
    expect(wrapper.find(".hp__handover").exists()).toBe(false);
    expect(wrapper.get("#hp-recent").text()).toBe("Recent activity");
  });

  it("adds one quiet line linking to the page when one is waiting for me", async () => {
    state.handovers = [waiting];
    const wrapper = await mountHome();
    const line = wrapper.get(".hp__handover");
    expect(line.text()).toContain("Mei handed over at 7:10 AM");
    expect(line.text()).toContain("12:00 AM to 7:10 AM");
    expect(line.text()).toContain("4 feeds, 3 h 40 min sleep, 3 nappies");
    expect(line.get("a").attributes("href")).toBe("/handover");
    // Home keeps its single solid button: the handover line is quiet, not a second one.
    expect(wrapper.findAll(".btn-primary")).toHaveLength(1);
  });

  it("makes the recent section window aware once a handover exists", async () => {
    state.handovers = [{ ...waiting, id: "ho2", from: "u1", to: "u2" }];
    const wrapper = await mountHome();
    expect(wrapper.get("#hp-recent").text()).toBe("Since the last handover");
    expect(wrapper.find(".hp__handover").exists()).toBe(false);
  });

  it("drops the line once I have accepted it", async () => {
    state.handovers = [{ ...waiting, acceptedAt: ts(new Date()), acceptedBy: "u1" }];
    const wrapper = await mountHome();
    expect(wrapper.find(".hp__handover").exists()).toBe(false);
    expect(wrapper.get("#hp-recent").text()).toBe("Since the last handover");
  });
});
