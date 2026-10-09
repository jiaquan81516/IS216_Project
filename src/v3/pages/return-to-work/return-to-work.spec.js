import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { V3_HOME_KEY } from "@/v3/composables/useV3Home";
import { RTW_KEY, useReturnToWorkStore } from "@/v3/stores/returnToWork";
import { ROOMS_KEY } from "@/v3/stores/rooms";

vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({}) }));

import RtwPage from "./index.vue";

// Wednesday 14 October 2026.
const NOW = new Date(2026, 9, 14, 12, 0, 0);

function mountPage({ named = true } = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  const home = named
    ? { me: ref({ firstName: "daniel" }), partner: ref({ firstName: "mei" }) }
    : { me: ref({}), partner: ref(null) };
  const wrapper = mount(RtwPage, {
    attachTo: document.body,
    global: { plugins: [pinia, router], provide: { [V3_HOME_KEY]: home } },
  });
  return { wrapper, store: useReturnToWorkStore() };
}
const solid = (wrapper) => wrapper.findAll("button.btn-primary, a.btn-primary");
const buttonByText = (wrapper, text) => wrapper.findAll("button").find((b) => b.text() === text);
const chip = (wrapper, text) => wrapper.findAll('[role="radio"], .v3-chip').find((b) => b.text() === text);
async function openTab(wrapper, label) {
  await wrapper.findAll('[role="tab"]').find((t) => t.text() === label).trigger("click");
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("V3 return to work page, plan tab", () => {
  it("shows the heading, subtitle and three tabs", () => {
    const { wrapper } = mountPage();
    expect(wrapper.get("h1").text()).toBe("Return to work");
    expect(wrapper.text()).toContain("A shared plan for getting ready, one step at a time.");
    expect(wrapper.findAll('[role="tab"]').map((t) => t.text())).toEqual(["Plan", "Responsibilities", "Pumping preparation"]);
  });

  it("asks for the date first, with one solid button and an empty task list", () => {
    const { wrapper } = mountPage();
    expect(wrapper.text()).toContain("When do you go back?");
    expect(wrapper.find('input[type="date"]').exists()).toBe(true);
    expect(solid(wrapper)).toHaveLength(1);
    expect(solid(wrapper)[0].text()).toBe("Save date");
    expect(wrapper.text()).toContain("No tasks yet. Add one or start from the suggestions below.");
  });

  it("needs a date before saving", async () => {
    const { wrapper } = mountPage();
    await buttonByText(wrapper, "Save date").trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toBe("Choose the day you go back to work.");
  });

  it("saving a date shows the countdown sentence and drops the solid button", async () => {
    const { wrapper, store } = mountPage();
    await wrapper.get('input[type="date"]').setValue("2026-11-04");
    await buttonByText(wrapper, "Save date").trigger("click");
    expect(store.returnDate).toBe("2026-11-04");
    expect(wrapper.get(".rw__sentence").text()).toBe("Back at work on 4 November. 21 days to go.");
    expect(wrapper.text()).not.toContain("When do you go back?");
    expect(solid(wrapper)).toHaveLength(0);
    expect(buttonByText(wrapper, "Change date")).toBeTruthy();
  });

  it("lets you change the date", async () => {
    const { wrapper, store } = mountPage();
    store.setReturnDate("2026-11-04");
    await nextTick();
    await buttonByText(wrapper, "Change date").trigger("click");
    expect(wrapper.get('input[type="date"]').element.value).toBe("2026-11-04");
    await wrapper.get('input[type="date"]').setValue("2026-11-11");
    await buttonByText(wrapper, "Save date").trigger("click");
    expect(wrapper.get(".rw__sentence").text()).toBe("Back at work on 11 November. 28 days to go.");
  });

  it("adds a task through the inline form", async () => {
    const { wrapper, store } = mountPage();
    store.setReturnDate("2026-11-04");
    await nextTick();
    expect(solid(wrapper)).toHaveLength(0);
    await buttonByText(wrapper, "Add a task").trigger("click");
    expect(solid(wrapper)).toHaveLength(1);
    expect(solid(wrapper)[0].text()).toBe("Add task");

    await buttonByText(wrapper, "Add task").trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toBe("Add a title for the task.");

    await wrapper.get('input[type="text"]').setValue("Book the nursery trial");
    await chip(wrapper, "Childcare").trigger("click");
    await chip(wrapper, "Mei").trigger("click");
    const dateInputs = wrapper.findAll('input[type="date"]');
    await dateInputs[dateInputs.length - 1].setValue("2026-10-16");
    await buttonByText(wrapper, "Add task").trigger("click");

    expect(store.tasks).toHaveLength(1);
    expect(store.tasks[0]).toMatchObject({ title: "Book the nursery trial", group: "childcare", owner: "partner", due: "2026-10-16" });
    const row = wrapper.get(".rw__task");
    expect(row.text()).toContain("Book the nursery trial");
    expect(row.text()).toContain("Mei");
    expect(row.text()).toContain("Due in 2 days");
    expect(wrapper.find("#rtw-form").exists()).toBe(false);
    expect(solid(wrapper)).toHaveLength(0);
    expect(wrapper.text()).not.toContain("No tasks yet");
  });

  it("keeps Save date outline while the add form is open", async () => {
    const { wrapper } = mountPage();
    await buttonByText(wrapper, "Add a task").trigger("click");
    expect(solid(wrapper)).toHaveLength(1);
    expect(solid(wrapper)[0].text()).toBe("Add task");
  });

  it("orders groups and sorts by due date", async () => {
    const { wrapper, store } = mountPage();
    store.addTask({ title: "No date task" });
    store.addTask({ title: "Later task", due: "2026-11-30" });
    store.addTask({ title: "Soon task", due: "2026-10-16" });
    store.addTask({ title: "Late task", due: "2026-10-10" });
    const done = store.addTask({ title: "Finished task" });
    store.toggleTask(done.id);
    await nextTick();
    expect(wrapper.findAll(".rw__group-title").map((h) => h.text()).slice(0, 5)).toEqual([
      "Overdue",
      "This week",
      "Later",
      "No date",
      "Done",
    ]);
    expect(wrapper.text()).toContain("Overdue by 4 days");
    expect(wrapper.get(".rw__overdue").text()).toBe("Overdue by 4 days");
  });

  it("ticks a task with a real checkbox", async () => {
    const { wrapper, store } = mountPage();
    store.addTask({ title: "Pack the bag" });
    await nextTick();
    const box = wrapper.get('input[type="checkbox"]');
    expect(wrapper.get(`label[for="${box.attributes("id")}"]`).text()).toBe("Pack the bag");
    await box.setValue(true);
    expect(store.tasks[0].done).toBe(true);
    expect(wrapper.findAll(".rw__group-title")[0].text()).toBe("Done");
  });

  it("edits a task and deletes with a confirm", async () => {
    const { wrapper, store } = mountPage();
    store.addTask({ title: "Old title", owner: "me" });
    await nextTick();
    await wrapper.get('button[aria-label="Edit Old title"]').trigger("click");
    expect(wrapper.get('input[type="text"]').element.value).toBe("Old title");
    await wrapper.get('input[type="text"]').setValue("New title");
    await buttonByText(wrapper, "Save task").trigger("click");
    expect(store.tasks[0].title).toBe("New title");

    await wrapper.get('button[aria-label="Delete New title"]').trigger("click");
    expect(wrapper.text()).toContain("Delete this task?");
    expect(store.tasks).toHaveLength(1);
    await buttonByText(wrapper, "Cancel").trigger("click");
    expect(store.tasks).toHaveLength(1);
    await wrapper.get('button[aria-label="Delete New title"]').trigger("click");
    await buttonByText(wrapper, "Delete").trigger("click");
    expect(store.tasks).toHaveLength(0);
  });

  it("adds a suggestion and removes it from the list", async () => {
    const { wrapper, store } = mountPage();
    expect(wrapper.findAll("#rtw-suggestions ~ ul li")).toHaveLength(6);
    await wrapper.get('button[aria-label="Add Find a pumping room near work"]').trigger("click");
    expect(store.tasks[0]).toMatchObject({ title: "Find a pumping room near work", group: "pumping", owner: "both", due: null });
    expect(wrapper.findAll("#rtw-suggestions ~ ul li")).toHaveLength(5);
    expect(wrapper.find('button[aria-label="Add Find a pumping room near work"]').exists()).toBe(false);
  });

  it("hides the suggestions section when all are added", async () => {
    const { wrapper, store } = mountPage();
    ["Talk to your manager about flexible work", "Choose childcare and book a trial", "Plan the morning handover", "Find a pumping room near work", "Pack pump, parts and storage bags", "Agree who does night duty in the first week back"].forEach((title) => store.addTask({ title }));
    await nextTick();
    expect(wrapper.find("#rtw-suggestions").exists()).toBe(false);
  });

  it("falls back to generic names and uses no dashes", async () => {
    const { wrapper, store } = mountPage({ named: false });
    store.addTask({ title: "Task", owner: "partner" });
    await nextTick();
    expect(wrapper.get(".rw__task").text()).toContain("Your partner");
    expect(wrapper.text()).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("V3 return to work page, responsibilities tab", () => {
  it("lists eight areas and counts everything as not decided at first", async () => {
    const { wrapper } = mountPage();
    await openTab(wrapper, "Responsibilities");
    expect(wrapper.text()).toContain("Who covers what once you are both back at work.");
    expect(wrapper.findAll(".rtr__row")).toHaveLength(8);
    expect(wrapper.get(".rtr__summary").text()).toBe("You cover 0, Mei covers 0, shared 0, not decided 8.");
    expect(solid(wrapper)).toHaveLength(0);
  });

  it("updates the summary and suggests moving one at a gap of two", async () => {
    const { wrapper, store } = mountPage();
    await openTab(wrapper, "Responsibilities");
    const rowChip = (area, text) => wrapper.get(`[data-area="${area}"]`).findAll('[role="radio"]').find((b) => b.text() === text);
    await rowChip("morning-routine", "Me").trigger("click");
    await rowChip("dropoff", "Me").trigger("click");
    expect(wrapper.find(".rtr__hint").exists()).toBe(true);
    expect(wrapper.get(".rtr__hint").text()).toBe("Daniel has 2 more than Mei. Consider moving one.");
    await rowChip("pickup", "Mei").trigger("click");
    await rowChip("meals", "Both").trigger("click");
    expect(wrapper.get(".rtr__summary").text()).toBe("You cover 2, Mei covers 1, shared 1, not decided 4.");
    expect(wrapper.find(".rtr__hint").exists()).toBe(false);
    expect(store.responsibilities.pickup).toBe("partner");
    await rowChip("pickup", "Not decided").trigger("click");
    expect(store.responsibilities.pickup).toBeNull();
  });

  it("makes a task assigned to the chosen owner", async () => {
    const { wrapper, store } = mountPage();
    await openTab(wrapper, "Responsibilities");
    const row = wrapper.get('[data-area="dropoff"]');
    await row.findAll('[role="radio"]').find((b) => b.text() === "Mei").trigger("click");
    await row.get("button.rtr__make").trigger("click");
    expect(store.tasks[0]).toMatchObject({ title: "Plan childcare drop-off", group: "childcare", owner: "partner" });
    expect(row.get("button.rtr__make").text()).toBe("Task added");
    expect(row.get("button.rtr__make").attributes("disabled")).toBeDefined();
  });
});

describe("V3 return to work page, pumping tab", () => {
  it("tracks checklist progress", async () => {
    const { wrapper, store } = mountPage();
    await openTab(wrapper, "Pumping preparation");
    expect(wrapper.text()).toContain("Get set up before the first day back.");
    expect(wrapper.get(".rtp__progress").text()).toBe("0 of 5 done");
    const boxes = wrapper.findAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(5);
    await boxes[0].setValue(true);
    await boxes[1].setValue(true);
    await boxes[4].setValue(true);
    expect(wrapper.get(".rtp__progress").text()).toBe("3 of 5 done");
    expect(store.pumping.items.filter((i) => i.done)).toHaveLength(3);
    expect(wrapper.get(`label[for="${boxes[0].attributes("id")}"]`).text()).toBe("Talk to your workplace about pumping breaks");
    expect(solid(wrapper)).toHaveLength(0);
  });

  it("builds the breaks summary", async () => {
    const { wrapper } = mountPage();
    await openTab(wrapper, "Pumping preparation");
    expect(wrapper.find(".rtp__summary").exists()).toBe(false);
    await chip(wrapper, "3 sessions").trigger("click");
    await chip(wrapper, "Afternoon").trigger("click");
    await chip(wrapper, "Morning").trigger("click");
    await chip(wrapper, "Midday").trigger("click");
    expect(wrapper.get(".rtp__summary").text()).toBe("Plan for 3 breaks: morning, midday, afternoon.");
    expect(chip(wrapper, "Morning").attributes("aria-pressed")).toBe("true");
    await chip(wrapper, "Midday").trigger("click");
    expect(wrapper.get(".rtp__summary").text()).toBe("Plan for 3 breaks: morning, afternoon.");
  });

  it("lists rooms with links to Support, including saved ones", async () => {
    localStorage.setItem(
      ROOMS_KEY,
      JSON.stringify([{ id: "c1", name: "Office nursing room", address: "1 Example Road", features: [] }]),
    );
    const { wrapper } = mountPage();
    await openTab(wrapper, "Pumping preparation");
    const rooms = wrapper.findAll(".rtp__room");
    expect(rooms.map((r) => r.get(".rtp__room-name").text())).toEqual([
      "SMU Library Nursing Room",
      "Raffles City Family Room",
      "Office nursing room",
    ]);
    expect(rooms[0].text()).toContain("70 Stamford Road, Singapore 178901");
    expect(rooms[0].text()).toContain("Verified 4 days ago");
    expect(rooms[1].text()).toContain("Needs verification");
    const link = rooms[0].get("a");
    expect(link.attributes("href")).toBe("/v3/support");
    expect(link.text()).toContain("Open in Support");
  });

  it("persists the plan between visits", async () => {
    const first = mountPage();
    first.store.addTask({ title: "Remembered" });
    expect(JSON.parse(localStorage.getItem(RTW_KEY)).tasks[0].title).toBe("Remembered");
    first.wrapper.unmount();
    const second = mountPage();
    await nextTick();
    expect(second.wrapper.text()).toContain("Remembered");
  });
});
