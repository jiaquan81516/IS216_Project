import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { HOME_KEY } from "@/app/composables/useHome";
import { SHARED_KEY } from "@/app/composables/useShared";
import { useReturnToWorkStore } from "@/app/stores/returnToWork";

// The page reads and writes the shared plan through the store, so the api module is mocked.
const rooms = vi.hoisted(() => ({ list: [] }));
const api = vi.hoisted(() => ({
  plan: null,
  tasks: [],
  error: null,
  cb: {},
  addTask: vi.fn(async () => "t-new"),
  updateTask: vi.fn(async () => {}),
  toggleTask: vi.fn(async () => {}),
  deleteTask: vi.fn(async () => {}),
  saveRtwPlan: vi.fn(async () => {}),
  setResponsibility: vi.fn(async () => {}),
  setPumping: vi.fn(async () => {}),
}));

vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: { value: { uid: ME } } }) }));
// The pumping tab lists the shared room directory, which is Firestore now.
vi.mock("@/app/api/rooms", () => ({
  subscribeRooms: (onData) => {
    queueMicrotask(() => onData(rooms.list));
    return () => {};
  },
  addRoom: vi.fn(async () => "room-new"),
  reportRoom: vi.fn(async () => "report-new"),
}));
vi.mock("@/app/api/rtw", () => ({
  subscribeRtwPlan: (hid, onData, onError) => {
    api.cb.plan = onData;
    queueMicrotask(() => (api.error ? onError(api.error) : onData(api.plan)));
    return () => {};
  },
  subscribeTasks: (hid, onData) => {
    api.cb.tasks = onData;
    queueMicrotask(() => onData(api.tasks));
    return () => {};
  },
  addTask: (...a) => api.addTask(...a),
  updateTask: (...a) => api.updateTask(...a),
  toggleTask: (...a) => api.toggleTask(...a),
  deleteTask: (...a) => api.deleteTask(...a),
  saveRtwPlan: (...a) => api.saveRtwPlan(...a),
  setResponsibility: (...a) => api.setResponsibility(...a),
  setPumping: (...a) => api.setPumping(...a),
  migrateLegacyRtw: vi.fn(async () => false),
}));

import RtwPage from "@/app/pages/return-to-work/index.vue";

// Wednesday 14 October 2026.
const NOW = new Date(2026, 9, 14, 12, 0, 0);
const ME = "u1";
const PARTNER = "u2";
const retry = vi.fn();

let nextId = 0;
const task = (over = {}) => ({
  id: `t${(nextId += 1)}`,
  title: "Task",
  group: "home",
  due: null,
  owner: "both",
  done: false,
  doneAt: null,
  doneBy: null,
  notes: "",
  ...over,
});

async function mountPage({ named = true, householdId = "h1" } = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useReturnToWorkStore();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  const home = named
    ? {
        householdId: ref(householdId),
        me: ref({ uid: ME, firstName: "daniel" }),
        partner: ref({ uid: PARTNER, firstName: "mei" }),
      }
    : { householdId: ref(householdId), me: ref({ uid: ME }), partner: ref(null) };
  if (householdId) store.bind(householdId, ME, named ? PARTNER : "");
  const wrapper = mount(RtwPage, {
    attachTo: document.body,
    global: { plugins: [pinia, router], provide: { [HOME_KEY]: home, [SHARED_KEY]: { retry } } },
  });
  await flushPromises();
  return { wrapper, store };
}
const solid = (wrapper) => wrapper.findAll("button.btn-primary, a.btn-primary");
const buttonByText = (wrapper, text) => wrapper.findAll("button").find((b) => b.text() === text);
const chip = (wrapper, text) => wrapper.findAll('[role="radio"], .app-chip').find((b) => b.text() === text);
async function openTab(wrapper, label) {
  await wrapper.findAll('[role="tab"]').find((t) => t.text() === label).trigger("click");
  await flushPromises();
}

beforeEach(() => {
  localStorage.clear();
  rooms.list = [];
  api.plan = null;
  api.tasks = [];
  api.error = null;
  api.cb = {};
  nextId = 0;
  retry.mockClear();
  for (const key of [
    "addTask",
    "updateTask",
    "toggleTask",
    "deleteTask",
    "saveRtwPlan",
    "setResponsibility",
    "setPumping",
  ]) {
    api[key].mockClear();
  }
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("App return to work page, plan tab", () => {
  it("shows the heading, subtitle and two tabs", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.get("h1").text()).toBe("Return to work");
    expect(wrapper.text()).toContain("You both see the same plan.");
    expect(wrapper.findAll('[role="tab"]').map((t) => t.text())).toEqual(["Plan", "Pumping preparation"]);
    expect(wrapper.text()).not.toMatch(/[\u2013\u2014]/);
  });

  it("asks for the date first, with one solid button and an empty task list", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.text()).toContain("When do you go back?");
    expect(solid(wrapper)).toHaveLength(1);
    expect(solid(wrapper)[0].text()).toBe("Save date");
    expect(wrapper.text()).toContain("No tasks yet. Add one or start from the suggestions below.");
  });

  it("shows Loading the plan and no alert before the household id exists", async () => {
    const { wrapper } = await mountPage({ householdId: "" });
    expect(wrapper.text()).toContain("Loading the plan...");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("When do you go back?");
  });

  it("explains permission-denied and offers Try again", async () => {
    api.error = { code: "permission-denied" };
    const { wrapper } = await mountPage();
    expect(wrapper.get('[role="alert"]').text()).toContain("do not allow reading the plan");
    await buttonByText(wrapper, "Try again").trigger("click");
    expect(retry).toHaveBeenCalled();
  });

  it("needs a date before saving, then saves it to the shared plan", async () => {
    const { wrapper } = await mountPage();
    await buttonByText(wrapper, "Save date").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Choose the day you go back to work.");
    expect(api.saveRtwPlan).not.toHaveBeenCalled();

    await wrapper.get('input[type="date"]').setValue("2026-11-04");
    await buttonByText(wrapper, "Save date").trigger("click");
    await flushPromises();
    expect(api.saveRtwPlan).toHaveBeenCalledWith("h1", ME, { returnDate: "2026-11-04" });
  });

  it("shows the countdown sentence from the shared plan and who saved it", async () => {
    api.plan = { returnDate: "2026-11-04", updatedAt: new Date(NOW.getTime() - 5 * 60000), updatedBy: PARTNER };
    const { wrapper } = await mountPage();
    expect(wrapper.get(".rw__sentence").text()).toBe("Back at work on 4 November. 21 days to go.");
    expect(wrapper.text()).toContain("Updated by Mei 5 minutes ago");
    expect(wrapper.text()).not.toContain("When do you go back?");
    expect(solid(wrapper)).toHaveLength(0);
    expect(buttonByText(wrapper, "Change date")).toBeTruthy();
  });

  it("summarises progress and surfaces the next open task", async () => {
    api.plan = { returnDate: "2026-11-04" };
    api.tasks = [
      task({ title: "Book childcare", group: "childcare", done: true }),
      task({ title: "Plan the morning handover", group: "home" }),
    ];
    const { wrapper } = await mountPage();
    expect(wrapper.get('[role="progressbar"]').attributes("aria-valuenow")).toBe("50");
    expect(wrapper.text()).toContain("1 of 2 preparation tasks complete");
    expect(wrapper.get(".rw__next").text()).toContain("Plan the morning handover");
  });

  it("filters the existing task list by preparation category", async () => {
    api.tasks = [task({ title: "Book childcare", group: "childcare" }), task({ title: "Talk to work", group: "work" })];
    const { wrapper } = await mountPage();
    await buttonByText(wrapper, "Childcare 0/1").trigger("click");
    expect(wrapper.text()).toContain("Book childcare");
    expect(wrapper.findAll(".rw__task").some((item) => item.text().includes("Talk to work"))).toBe(false);
  });

  it("adds a task through the inline form, with the owner as a uid", async () => {
    api.plan = { returnDate: "2026-11-04" };
    const { wrapper } = await mountPage();
    expect(solid(wrapper)).toHaveLength(0);
    await buttonByText(wrapper, "Add a task").trigger("click");
    expect(solid(wrapper)).toHaveLength(1);
    expect(solid(wrapper)[0].text()).toBe("Add task");

    await buttonByText(wrapper, "Add task").trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toBe("Add a title for the task.");

    await wrapper.get('input[type="text"]').setValue("Book the nursery trial");
    const selects = wrapper.findAll("select");
    await selects[0].setValue("childcare");
    await selects[1].setValue("partner");
    const dateInputs = wrapper.findAll('input[type="date"]');
    await dateInputs[dateInputs.length - 1].setValue("2026-10-16");
    await buttonByText(wrapper, "Add task").trigger("click");
    await flushPromises();

    expect(api.addTask).toHaveBeenCalledWith("h1", ME, {
      title: "Book the nursery trial",
      group: "childcare",
      owner: PARTNER,
      due: "2026-10-16",
      notes: "",
      queued: false,
    });
    expect(wrapper.find("#rtw-form").exists()).toBe(false);
  });

  it("lists shared tasks by group, with the owner by name", async () => {
    api.tasks = [
      task({ title: "No date task" }),
      task({ title: "Later task", due: "2026-11-30", owner: PARTNER }),
      task({ title: "Soon task", due: "2026-10-16", owner: ME }),
      task({ title: "Late task", due: "2026-10-10" }),
      task({ title: "Finished task", done: true, doneBy: PARTNER, doneAt: new Date(NOW.getTime() - 3600000) }),
    ];
    const { wrapper } = await mountPage();
    expect(wrapper.findAll(".rw__group-title").map((h) => h.text()).slice(0, 5)).toEqual([
      "Overdue",
      "This week",
      "Later",
      "No date",
      "Done",
    ]);
    expect(wrapper.get(".rw__overdue").text()).toBe("Overdue by 4 days");
    expect(wrapper.text()).toContain("Open tasks: Me 1, Mei 1, both 2.");
    const soon = wrapper.findAll(".rw__task").find((t) => t.text().includes("Soon task"));
    expect(soon.get(".rw__owner").text()).toBe("Me");
    const later = wrapper.findAll(".rw__task").find((t) => t.text().includes("Later task"));
    expect(later.get(".rw__owner").text()).toBe("Mei");
  });

  it("says who finished a task", async () => {
    api.tasks = [task({ title: "Packed", done: true, doneBy: PARTNER, doneAt: new Date(NOW.getTime() - 5 * 60000) })];
    const { wrapper } = await mountPage();
    expect(wrapper.get(".rw__task").text()).toContain("Done by Mei 5 minutes ago");
    api.cb.tasks([task({ id: "t1", title: "Packed", done: true, doneBy: ME, doneAt: new Date(NOW.getTime() - 60000) })]);
    await flushPromises();
    expect(wrapper.get(".rw__task").text()).toContain("Done by you 1 minute ago");
  });

  it("ticks a task with a real checkbox", async () => {
    api.tasks = [task({ title: "Pack the bag" })];
    const { wrapper } = await mountPage();
    const box = wrapper.get('input[type="checkbox"]');
    expect(wrapper.get(`label[for="${box.attributes("id")}"]`).text()).toBe("Pack the bag");
    await box.setValue(true);
    await flushPromises();
    expect(api.toggleTask).toHaveBeenCalledWith("h1", "t1", true, ME);
  });

  it("edits a task and deletes with a confirm", async () => {
    api.tasks = [task({ title: "Old title", owner: ME })];
    const { wrapper } = await mountPage();
    await wrapper.get('button[aria-label="Edit Old title"]').trigger("click");
    expect(wrapper.get('input[type="text"]').element.value).toBe("Old title");
    expect(wrapper.findAll("select")[1].element.value).toBe("me");
    await wrapper.get('input[type="text"]').setValue("New title");
    await buttonByText(wrapper, "Save task").trigger("click");
    await flushPromises();
    expect(api.updateTask).toHaveBeenCalledWith("h1", "t1", expect.objectContaining({ title: "New title", owner: ME }));

    await wrapper.get('button[aria-label="Delete Old title"]').trigger("click");
    expect(wrapper.text()).toContain("Delete this task?");
    expect(api.deleteTask).not.toHaveBeenCalled();
    await buttonByText(wrapper, "Cancel").trigger("click");
    await wrapper.get('button[aria-label="Delete Old title"]').trigger("click");
    await buttonByText(wrapper, "Delete").trigger("click");
    await flushPromises();
    expect(api.deleteTask).toHaveBeenCalledWith("h1", "t1");
  });

  it("adds a suggestion for both of you and drops it from the list", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.findAll("#rtw-suggestions ~ ul li")).toHaveLength(3);
    await wrapper.get('button[aria-label="Add Arrange a childcare trial"]').trigger("click");
    await flushPromises();
    expect(api.addTask).toHaveBeenCalledWith("h1", ME, {
      title: "Arrange a childcare trial",
      group: "childcare",
      owner: "both",
      due: null,
      notes: "",
      queued: false,
    });
    api.cb.tasks([task({ title: "Arrange a childcare trial", group: "childcare" })]);
    await flushPromises();
    expect(wrapper.findAll("#rtw-suggestions ~ ul li")).toHaveLength(2);
  });

  it("falls back to generic names and shows a failed write", async () => {
    api.toggleTask.mockRejectedValueOnce(Object.assign(new Error("no"), { code: "permission-denied" }));
    api.tasks = [task({ title: "Task", owner: "u9" })];
    const { wrapper } = await mountPage({ named: false });
    expect(wrapper.get(".rw__task").text()).toContain("Your partner");
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("could not save the task");
    expect(wrapper.findAll("[data-task]")).toHaveLength(1);
  });
});

describe("App return to work page, pumping tab", () => {
  it("tracks checklist progress from the shared plan", async () => {
    api.plan = { pumping: { items: { "find-room": true, "pack-pump": true } } };
    const { wrapper } = await mountPage();
    await openTab(wrapper, "Pumping preparation");
    expect(wrapper.get(".rtp__progress").text()).toBe("2 of 5 done");
    const boxes = wrapper.findAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(5);
    await boxes[0].setValue(true);
    await flushPromises();
    expect(api.setPumping).toHaveBeenCalledWith("h1", ME, { items: { "talk-workplace": true } });
    expect(solid(wrapper)).toHaveLength(0);
  });

  it("builds the breaks summary from the shared plan", async () => {
    api.plan = { pumping: { sessions: 3, times: ["morning", "afternoon"] } };
    const { wrapper } = await mountPage();
    await openTab(wrapper, "Pumping preparation");
    expect(wrapper.get(".rtp__summary").text()).toBe("Plan for 3 breaks: morning, afternoon.");
    await chip(wrapper, "Midday").trigger("click");
    await flushPromises();
    expect(api.setPumping).toHaveBeenCalledWith("h1", ME, { times: ["morning", "afternoon", "midday"] });
    await chip(wrapper, "4 sessions").trigger("click");
    await flushPromises();
    expect(api.setPumping).toHaveBeenLastCalledWith("h1", ME, { sessions: 4 });
  });

  it("lists the shared room directory with links to Support", async () => {
    rooms.list = [{ id: "r1", name: "Office nursing room", address: "1 Example Road", status: "unverified" }];
    const { wrapper } = await mountPage();
    await openTab(wrapper, "Pumping preparation");
    const list = wrapper.findAll(".rtp__room");
    expect(list.map((r) => r.get(".rtp__room-name").text())).toEqual(["Office nursing room"]);
    expect(list[0].get("a").attributes("href")).toBe("/support");
  });

  it("falls back to the seed rooms while the directory is empty", async () => {
    rooms.list = [];
    const { wrapper } = await mountPage();
    await openTab(wrapper, "Pumping preparation");
    expect(wrapper.findAll(".rtp__room").map((r) => r.get(".rtp__room-name").text())).toEqual([
      "SMU Library Nursing Room",
      "Raffles City Family Room",
    ]);
  });
});
