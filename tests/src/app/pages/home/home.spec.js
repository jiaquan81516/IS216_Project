import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { createPinia, setActivePinia } from "pinia";

const state = vi.hoisted(() => ({
  profile: null,
  household: null,
  members: [],
  fail: false,
  entries: [],
  entriesError: null,
  handovers: [],
  posts: [],
  postsError: null,
  tasks: [],
  acceptHandover: null,
  addPost: null,
  ackPost: null,
  deletePost: null,
  addTask: null,
  toggleTask: null,
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
    if (state.fail) throw new Error("offline");
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
}));
vi.mock("@/app/api/handovers", () => ({
  HANDOVERS_MAX: 30,
  subscribeHandovers: (_id, onData) => {
    queueMicrotask(() => onData(state.handovers));
    return () => {};
  },
  acceptHandover: (...a) => state.acceptHandover(...a),
}));
vi.mock("@/app/api/posts", () => ({
  POST_TEXT_MAX: 500,
  subscribePosts: (_id, onData, onError) => {
    queueMicrotask(() => (state.postsError ? onError(state.postsError) : onData(state.posts)));
    return () => {};
  },
  addPost: (...a) => state.addPost(...a),
  ackPost: (...a) => state.ackPost(...a),
  deletePost: (...a) => state.deletePost(...a),
}));
vi.mock("@/app/api/rtw", () => ({
  subscribeRtwPlan: (_id, onData) => {
    queueMicrotask(() => onData(null));
    return () => {};
  },
  subscribeTasks: (_id, onData) => {
    queueMicrotask(() => onData(state.tasks));
    return () => {};
  },
  addTask: (...a) => state.addTask(...a),
  toggleTask: (...a) => state.toggleTask(...a),
  migrateLegacyRtw: vi.fn(async () => false),
}));

import HomePage from "@/app/pages/home/index.vue";
import { SHARED_KEY } from "@/app/composables/useShared";
import { usePostsStore } from "@/app/stores/posts";
import { useReturnToWorkStore } from "@/app/stores/returnToWork";

const NOW = new Date(2026, 9, 11, 12, 0, 0);
const ts = (date) => ({ toDate: () => date });
const at = (day, h, m = 0) => new Date(2026, 9, day, h, m);

let router;
async function mountHome({ rota = null, calendar = null } = {}) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  const pinia = createPinia();
  setActivePinia(pinia);
  const posts = usePostsStore();
  const rtw = useReturnToWorkStore();
  posts.bind("h1", "u1");
  rtw.bind("h1", "u1", "u2");
  const shared = { posts, rtw, rota, calendar };
  const wrapper = mount(HomePage, { global: { plugins: [router, pinia], provide: { [SHARED_KEY]: shared } }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

const daniel = { uid: "u1", displayName: "daniel Tan", role: "parent" };
const mei = { uid: "u2", displayName: "Mei Lin", role: "partner" };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  state.fail = false;
  state.profile = { displayName: "daniel Tan", email: "daniel@example.com", householdId: "h1" };
  state.household = { inviteCode: "NT-4F7K", babyName: "Aria", babyStatus: "born", babyDate: "2026-08-30" };
  state.members = [daniel, mei];
  state.entries = [];
  state.entriesError = null;
  state.handovers = [];
  state.posts = [];
  state.postsError = null;
  state.tasks = [];
  state.acceptHandover = vi.fn(async () => {});
  state.addPost = vi.fn(async () => "p-new");
  state.ackPost = vi.fn(async () => {});
  state.deletePost = vi.fn(async () => {});
  state.addTask = vi.fn(async () => "t-new");
  state.toggleTask = vi.fn(async () => {});
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

function rotaWith({ firstOnDuty }) {
  return {
    loading: false,
    error: null,
    settings: {},
    view: { pattern: "alternate", firstOnDuty, startDate: "2026-10-11", handoverTime: "07:00", overrides: {}, swaps: [] },
  };
}
const partnerPost = (over = {}) => ({ id: "p1", text: "Home by 6", authorUid: "u2", createdAt: ts(at(11, 9, 10)), ackedBy: [], ...over });
const buttonByText = (wrapper, text) => wrapper.findAll("button").find((b) => b.text() === text);

describe("Home layout", () => {
  it("shows the Home title, one muted greeting line and the composer", async () => {
    const wrapper = await mountHome();
    expect(wrapper.get("h1").text()).toBe("Home");
    expect(wrapper.get(".hp__sub").text()).toBe("Good afternoon, Daniel. Sunday, 11 October");
    const input = wrapper.get("input[type=text]");
    expect(input.attributes("aria-label")).toBe("Message, log, or add a task");
    expect(input.attributes("placeholder")).toBe("Message, log, or add a task...");
  });

  it("drops the old cards and keeps the private check in link", async () => {
    const wrapper = await mountHome();
    const text = wrapper.text();
    for (const gone of ["Sleep today", "Nappies today", "Coming up", "Recent activity"]) expect(text).not.toContain(gone);
    const link = wrapper.findAll("a").find((a) => a.text() === "Check in privately");
    expect(link.attributes("href")).toBe("/wellness");
  });

  it("shows the empty state when nothing has happened", async () => {
    const wrapper = await mountHome();
    expect(wrapper.text()).toContain("Nothing here yet. Post a message or log something.");
  });

  it("shows an invite line only while there is no partner", async () => {
    expect((await mountHome()).text()).not.toContain("Invite your partner");
    state.members = [daniel];
    expect((await mountHome()).text()).toContain("Invite your partner with code NT-4F7K");
  });

  it("shows an alert with a retry button when the household cannot load", async () => {
    state.fail = true;
    const wrapper = await mountHome();
    expect(wrapper.get('[role="alert"]').text()).toContain("could not load your household");
    state.fail = false;
    await buttonByText(wrapper, "Try again").trigger("click");
    await flushPromises();
    expect(wrapper.find("h1").exists()).toBe(true);
  });

  it("says why messages cannot be read", async () => {
    state.postsError = { code: "permission-denied" };
    const wrapper = await mountHome();
    expect(wrapper.text()).toContain("Publish the latest firestore.rules");
    expect(wrapper.find(".hp__notice").exists()).toBe(true);
  });

  it("has exactly one solid plum control, and only once there is text", async () => {
    const wrapper = await mountHome();
    expect(wrapper.find(".hp__send").exists()).toBe(false);
    await wrapper.get("input[type=text]").setValue("hello");
    expect(wrapper.findAll(".hp__send")).toHaveLength(1);
    expect(wrapper.findAll(".btn-primary")).toHaveLength(0);
  });

  it("says the rota is not set up when there is none", async () => {
    const wrapper = await mountHome();
    const card = wrapper.get('section[aria-labelledby="hp-duty-title"]');
    expect(card.get("h2").text()).toBe("No night rota yet");
    expect(card.get("a").text()).toBe("Set up your night rota");
    expect(card.get("a").attributes("href")).toBe("/rota");
  });

  it("shows You're on duty tonight with the handover time when it is my night", async () => {
    const wrapper = await mountHome({ rota: rotaWith({ firstOnDuty: "me" }) });
    const card = wrapper.get('section[aria-labelledby="hp-duty-title"]');
    expect(card.get("h2").text()).toBe("You're on duty tonight");
    expect(card.text()).toContain("Handover at 7:00 AM");
    expect(card.get("a").text()).toBe("Sleep rotation");
    expect(card.get("a").attributes("href")).toBe("/rota");
    expect(card.get(".hp__moon").classes()).toContain("hp__moon--you");
  });

  it("names the partner when it is their night", async () => {
    const wrapper = await mountHome({ rota: rotaWith({ firstOnDuty: "partner" }) });
    const card = wrapper.get('section[aria-labelledby="hp-duty-title"]');
    expect(card.get("h2").text()).toBe("Mei is on duty tonight");
    expect(card.get(".hp__moon").classes()).toContain("hp__moon--partner");
  });

  it("counts the hour before handover as last night's duty", async () => {
    vi.setSystemTime(at(11, 6, 30));
    const wrapper = await mountHome({ rota: rotaWith({ firstOnDuty: "partner" }) });
    expect(wrapper.get("#hp-duty-title").text()).toBe("You're on duty tonight");
  });

  it("invites the partner to share nights when there is none", async () => {
    state.members = [daniel];
    const wrapper = await mountHome({ rota: rotaWith({ firstOnDuty: "me" }) });
    expect(wrapper.get("#hp-duty-title").text().length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain("Invite your partner to share nights.");
  });

  it("shows the quick summary with counts, last feed and next up", async () => {
    state.entries = [
      { id: "e1", type: "feed", by: "u2", byName: "mei", at: ts(at(11, 10)), details: { method: "bottle", ml: 120 } },
      { id: "e2", type: "feed", by: "u2", byName: "mei", at: ts(at(11, 6)), details: { method: "bottle", ml: 90 } },
      { id: "e3", type: "nappy", by: "u2", byName: "mei", at: ts(at(11, 7)), details: { nappyType: "wet" } },
      { id: "e4", type: "sleep", by: "u2", byName: "mei", at: ts(at(11, 1)), endedAt: ts(at(11, 3, 30)), details: {} },
    ];
    const calendar = { events: [{ id: "c1", title: "Health visitor", date: "2026-10-13", allDay: true }] };
    const wrapper = await mountHome({ calendar });
    const card = wrapper.get('section[aria-labelledby="hp-glance-title"]');
    expect(card.get("h2").text()).toBe("Today at a glance");
    const rows = card.findAll(".hp__row").map((r) => r.text());
    expect(rows).toEqual(["Feeds2", "Sleep total2 h 30 min", "Nappies1"]);
    expect(card.text()).toContain("10:00 AM, 2 h ago");
    expect(card.text()).toContain("Health visitor");
    expect(card.text()).toContain("Tue 13 Oct");
    expect(card.get("a").text()).toBe("Open care log");
    expect(card.get("a").attributes("href")).toBe("/care-log");
  });

  it("keeps the summary calm when nothing is logged", async () => {
    const wrapper = await mountHome();
    const card = wrapper.get('section[aria-labelledby="hp-glance-title"]');
    expect(card.text()).toContain("No feeds logged today");
    expect(card.text()).toContain("Nothing coming up");
    expect(card.findAll(".hp__row").map((r) => r.text())).toEqual(["FeedsNone", "Sleep totalNone", "NappiesNone"]);
  });

  it("uses a tinted square, never a second solid plum control, in the cards", async () => {
    const wrapper = await mountHome({ rota: rotaWith({ firstOnDuty: "me" }) });
    expect(wrapper.findAll(".btn-primary")).toHaveLength(0);
    expect(wrapper.find(".hp__send").exists()).toBe(false);
  });
});

describe("Home stream", () => {
  it("groups by day, newest first, with plain text items", async () => {
    state.posts = [partnerPost(), partnerPost({ id: "p2", text: "Old news", createdAt: ts(at(10, 20)) }), partnerPost({ id: "p3", text: "Earlier", createdAt: ts(at(9, 8, 5)) })];
    const wrapper = await mountHome();
    expect(wrapper.findAll(".hp__day").map((d) => d.text())).toEqual(["Today", "Yesterday", "Fri 9 Oct"]);
    const first = wrapper.get(".hp__item");
    expect(first.get(".hp__meta").text()).toBe("Mei, 9:10 AM");
    expect(first.get(".hp__text").text()).toBe("Home by 6");
    expect(wrapper.findAll("ul.hp__list").length).toBe(3);
  });

  it("renders care entries as one line with no action", async () => {
    state.entries = [{ id: "e1", type: "feed", by: "u2", byName: "mei", at: ts(at(11, 8)), details: { method: "bottle", ml: 120 } }];
    const wrapper = await mountHome();
    const item = wrapper.get(".hp__item");
    expect(item.get(".hp__meta").text()).toBe("Mei, 8:00 AM · Care");
    expect(item.get(".hp__text").text()).toBe("Fed 120 ml");
    expect(item.findAll("button")).toHaveLength(0);
  });

  it("renders a received handover with counts and Needs attention in coral", async () => {
    state.handovers = [
      {
        id: "ho1",
        from: "u2",
        to: "u1",
        sentAt: ts(at(11, 7, 10)),
        note: "Quiet night",
        needsAttention: true,
        attentionNote: "Cough",
        summary: { feeds: 4, sleepMinutes: 220, nappies: 3 },
        acceptedAt: null,
      },
    ];
    const wrapper = await mountHome();
    const item = wrapper.get(".hp__item");
    expect(item.text()).toContain("Mei, 7:10 AM · Handover");
    expect(item.text()).toContain("Quiet night");
    expect(item.text()).toContain("4 feeds, 3 h 40 min sleep, 3 nappies");
    expect(item.get(".hp__attention").text()).toBe("Needs attention: Cough");
    await buttonByText(wrapper, "Got it").trigger("click");
    expect(state.acceptHandover).toHaveBeenCalledWith("h1", "ho1", "u1");
  });

  it("Got it acknowledges a partner message, then it reads Seen by you", async () => {
    state.posts = [partnerPost()];
    const wrapper = await mountHome();
    await buttonByText(wrapper, "Got it").trigger("click");
    expect(state.ackPost).toHaveBeenCalledWith("h1", "p1", "u1");
    state.posts = [partnerPost({ ackedBy: ["u1"] })];
    const again = await mountHome();
    expect(buttonByText(again, "Got it")).toBeUndefined();
    expect(again.get(".hp__item").text()).toContain("Seen by you");
  });

  it("shows Seen by the partner on my own message once acknowledged, and nothing before", async () => {
    state.posts = [partnerPost({ authorUid: "u1" })];
    const before = await mountHome();
    expect(before.get(".hp__item").text()).toContain("You, 9:10 AM");
    expect(before.get(".hp__item").text()).not.toContain("Seen by");
    expect(buttonByText(before, "Got it")).toBeUndefined();
    state.posts = [partnerPost({ authorUid: "u1", ackedBy: ["u2"] })];
    const after = await mountHome();
    expect(after.get(".hp__item").text()).toContain("Seen by Mei");
  });

  it("lets me delete only my own message", async () => {
    state.posts = [partnerPost({ id: "mine", authorUid: "u1" }), partnerPost({ id: "theirs", createdAt: ts(at(11, 8)) })];
    const wrapper = await mountHome();
    const deletes = wrapper.findAll("button").filter((b) => b.text() === "Delete");
    expect(deletes).toHaveLength(1);
    await deletes[0].trigger("click");
    expect(state.deletePost).toHaveBeenCalledWith("h1", "mine");
  });

  it("shows an open task with Done and marks it done through the store", async () => {
    state.tasks = [{ id: "t1", title: "Book jab", owner: "both", due: "2026-10-13", done: false, createdBy: "u2", createdAt: ts(at(10, 18)) }];
    const wrapper = await mountHome();
    const item = wrapper.get(".hp__item");
    expect(item.get(".hp__meta").text()).toBe("Mei, 6:00 PM · Task, due Tue");
    await buttonByText(wrapper, "Done").trigger("click");
    expect(state.toggleTask).toHaveBeenCalledWith("h1", "t1", true, "u1");
  });

  it("shows a finished task without an action", async () => {
    state.tasks = [{ id: "t1", title: "Book jab", owner: "both", done: true, doneAt: ts(at(11, 10)), createdBy: "u2", createdAt: ts(at(10, 18)) }];
    const wrapper = await mountHome();
    expect(buttonByText(wrapper, "Done")).toBeUndefined();
    expect(wrapper.text()).toContain("Completed");
  });
});

describe("Home composer", () => {
  it("sends a plain message on Enter, clears the box and announces it", async () => {
    const wrapper = await mountHome();
    const input = wrapper.get("input[type=text]");
    await input.setValue("  Running late  ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(state.addPost).toHaveBeenCalledWith("h1", "u1", "Running late");
    expect(input.element.value).toBe("");
    expect(wrapper.get("[role=status].visually-hidden").text()).toBe("Message sent");
  });

  it("sends with the Send button too", async () => {
    const wrapper = await mountHome();
    await wrapper.get("input[type=text]").setValue("Hi");
    await wrapper.get(".hp__send").trigger("click");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(state.addPost).toHaveBeenCalledTimes(1);
  });

  it("sends nothing for blank text", async () => {
    const wrapper = await mountHome();
    await wrapper.get("input[type=text]").setValue("   ");
    await wrapper.get("form").trigger("submit");
    expect(state.addPost).not.toHaveBeenCalled();
  });

  it("shows a calm error when sending fails and keeps the text", async () => {
    state.addPost = vi.fn(async () => {
      throw { code: "unavailable" };
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapper = await mountHome();
    const input = wrapper.get("input[type=text]");
    await input.setValue("Hi");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("could not send");
    expect(input.element.value).toBe("Hi");
  });
});

describe("Home plus menu", () => {
  it("lists the six actions and is keyboard operable", async () => {
    const wrapper = await mountHome();
    const plus = wrapper.get(".hp__plus");
    expect(plus.attributes("aria-expanded")).toBe("false");
    await plus.trigger("click");
    await flushPromises();
    const items = wrapper.findAll('[role="menuitem"]').map((i) => i.text());
    expect(items).toEqual(["Log feed", "Log sleep", "Log nappy", "Medicine", "Add a task", "Send handover"]);
    expect(plus.attributes("aria-expanded")).toBe("true");
    expect(document.activeElement.textContent.trim()).toBe("Log feed");

    await wrapper.get("#hp-menu").trigger("keydown", { key: "ArrowDown" });
    expect(document.activeElement.textContent.trim()).toBe("Log sleep");
    await wrapper.get("#hp-menu").trigger("keydown", { key: "End" });
    expect(document.activeElement.textContent.trim()).toBe("Send handover");
    await wrapper.get("#hp-menu").trigger("keydown", { key: "ArrowDown" });
    expect(document.activeElement.textContent.trim()).toBe("Log feed");

    await wrapper.get("#hp-menu").trigger("keydown", { key: "Escape" });
    expect(wrapper.find("#hp-menu").exists()).toBe(false);
    expect(document.activeElement).toBe(plus.element);
  });

  it("opens with the arrow key from the plus button", async () => {
    const wrapper = await mountHome();
    await wrapper.get(".hp__plus").trigger("keydown", { key: "ArrowDown" });
    await flushPromises();
    expect(wrapper.find("#hp-menu").exists()).toBe(true);
  });

  it("deep links the log items to the care log with the type", async () => {
    const wrapper = await mountHome();
    const push = vi.spyOn(router, "push");
    const choices = [["Log feed", "feed"], ["Log sleep", "sleep"], ["Log nappy", "nappy"], ["Medicine", "medication"]];
    for (const [label, type] of choices) {
      await wrapper.get(".hp__plus").trigger("click");
      await wrapper.findAll('[role="menuitem"]').find((i) => i.text() === label).trigger("click");
      expect(push).toHaveBeenLastCalledWith({ path: "/care-log", query: { log: type } });
    }
  });

  it("goes to the handover page", async () => {
    const wrapper = await mountHome();
    const push = vi.spyOn(router, "push");
    await wrapper.get(".hp__plus").trigger("click");
    await wrapper.findAll('[role="menuitem"]').find((i) => i.text() === "Send handover").trigger("click");
    expect(push).toHaveBeenLastCalledWith("/handover");
  });

  it("adds a task through the tasks store with who and due date", async () => {
    const wrapper = await mountHome();
    await wrapper.get(".hp__plus").trigger("click");
    await wrapper.findAll('[role="menuitem"]').find((i) => i.text() === "Add a task").trigger("click");
    await flushPromises();
    const form = wrapper.get("form[aria-label='Add a task']");
    expect(form.findAll("input[type=radio]")).toHaveLength(3);
    await form.get("input[type=text]").setValue("Order nappies");
    await form.get("input[value=partner]").setValue(true);
    await form.get("input[type=date]").setValue("2026-10-14");
    await form.trigger("submit");
    await flushPromises();
    expect(state.addTask).toHaveBeenCalledWith(
      "h1",
      "u1",
      expect.objectContaining({ title: "Order nappies", owner: "u2", due: "2026-10-14" }),
    );
    expect(wrapper.find("form[aria-label='Add a task']").exists()).toBe(false);
    expect(wrapper.get("[role=status].visually-hidden").text()).toBe("Task added");
  });

  it("asks for a title before adding a task", async () => {
    const wrapper = await mountHome();
    await wrapper.get(".hp__plus").trigger("click");
    await wrapper.findAll('[role="menuitem"]').find((i) => i.text() === "Add a task").trigger("click");
    await flushPromises();
    await wrapper.get("form[aria-label='Add a task']").trigger("submit");
    expect(wrapper.text()).toContain("Add a title for the task.");
    expect(state.addTask).not.toHaveBeenCalled();
  });
});
