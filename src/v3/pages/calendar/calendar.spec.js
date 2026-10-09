import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { V3_HOME_KEY } from "@/v3/composables/useV3Home";
import { CALENDAR_KEY, useCalendarStore } from "@/v3/stores/calendar";

vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({}) }));

import CalendarPage from "./index.vue";

// Wednesday 14 October 2026. The rota starts Monday 12 October with Daniel (me) on duty.
const NOW = new Date(2026, 9, 14, 12, 0, 0);

function mountPage({ named = true } = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const home = named
    ? { me: ref({ firstName: "daniel" }), partner: ref({ firstName: "mei" }) }
    : { me: ref({}), partner: ref(null) };
  const wrapper = mount(CalendarPage, {
    attachTo: document.body,
    global: { plugins: [pinia], provide: { [V3_HOME_KEY]: home } },
  });
  return { wrapper, store: useCalendarStore() };
}
const solid = (wrapper) => wrapper.findAll("button.btn-primary, a.btn-primary");
const buttonByText = (wrapper, text) => wrapper.findAll("button").find((b) => b.text() === text);
const radio = (wrapper, text) => wrapper.findAll('[role="radio"]').find((b) => b.text() === text);
const cell = (wrapper, iso) => wrapper.get(`td[data-date="${iso}"]`);
const seed = (store, over) => store.addEvent({ title: "Event", date: "2026-10-14", allDay: true, owner: "both", type: "family", ...over });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("V3 calendar page, month view", () => {
  it("shows the heading, subtitle, month label and view switch without tabs", () => {
    const { wrapper } = mountPage();
    expect(wrapper.get("h1").text()).toBe("Calendar");
    expect(wrapper.text()).toContain("Appointments, family plans and who is on duty.");
    expect(wrapper.get(".cal__month").text()).toBe("October 2026");
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
    expect(wrapper.findAll('[role="radio"]').map((b) => b.text())).toEqual(["Month", "Agenda"]);
    expect(wrapper.text()).not.toMatch(/[\u2013\u2014]/);
  });

  it("has exactly one solid button when the panel is closed", () => {
    const { wrapper } = mountPage();
    expect(solid(wrapper)).toHaveLength(1);
    expect(solid(wrapper)[0].text()).toBe("Add event");
  });

  it("draws 7 weekday headers and 42 days, with today marked once", () => {
    const { wrapper } = mountPage();
    expect(wrapper.findAll("th").map((h) => h.text())).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(wrapper.findAll("td.cal__cell")).toHaveLength(42);
    expect(wrapper.findAll("td.cal__cell--out").length).toBe(42 - 31);
    const today = wrapper.findAll(".cal__num--today");
    expect(today).toHaveLength(1);
    expect(today[0].text()).toBe("14");
    expect(cell(wrapper, "2026-10-14").get("button.cal__daybtn").attributes("aria-current")).toBe("date");
  });

  it("shows who is on night duty in each cell", () => {
    const { wrapper } = mountPage();
    const mine = cell(wrapper, "2026-10-14").get(".cal__night");
    expect(mine.attributes("aria-label")).toBe("Night duty: Daniel");
    expect(mine.text()).toBe("D");
    const theirs = cell(wrapper, "2026-10-15").get(".cal__night");
    expect(theirs.attributes("aria-label")).toBe("Night duty: Mei");
    expect(theirs.text()).toBe("M");
    expect(wrapper.get(".cal__legend").text()).toContain("Night duty");
  });

  it("uses generic names when the household is unknown", () => {
    const { wrapper } = mountPage({ named: false });
    expect(cell(wrapper, "2026-10-15").get(".cal__night").attributes("aria-label")).toBe("Night duty: Your partner");
    expect(wrapper.get(".cal__legend").text()).toContain("Your partner");
  });

  it("moves between months and back to today", async () => {
    const { wrapper } = mountPage();
    await wrapper.get('button[aria-label="Next month"]').trigger("click");
    expect(wrapper.get(".cal__month").text()).toBe("November 2026");
    expect(wrapper.find(".cal__num--today").exists()).toBe(false);
    await wrapper.get('button[aria-label="Previous month"]').trigger("click");
    await wrapper.get('button[aria-label="Previous month"]').trigger("click");
    expect(wrapper.get(".cal__month").text()).toBe("September 2026");
    await buttonByText(wrapper, "Today").trigger("click");
    expect(wrapper.get(".cal__month").text()).toBe("October 2026");
  });

  it("colours chips by owner through data attributes and limits a cell to two chips", async () => {
    const { wrapper, store } = mountPage();
    seed(store, { title: "Mine", owner: "me" });
    seed(store, { title: "Theirs", owner: "partner" });
    seed(store, { title: "Ours", owner: "both" });
    await nextTick();
    const c = cell(wrapper, "2026-10-14");
    const chips = c.findAll(".cal__chip");
    expect(chips).toHaveLength(2);
    expect(chips.map((x) => x.attributes("data-owner"))).toEqual(["me", "both"]);
    expect(chips[0].text()).toContain("Mine");
    const more = c.get(".cal__more");
    expect(more.text()).toBe("+1 more");
    expect(c.findAll(".cal__dot")).toHaveLength(3);
    expect(c.findAll(".cal__dot").map((d) => d.attributes("data-owner"))).toEqual(["me", "both", "partner"]);
    await more.trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.findAll(".cdp__item")).toHaveLength(3);
  });

  it("shows a multi-day event on every day it covers", async () => {
    const { wrapper, store } = mountPage();
    seed(store, { title: "Leave", date: "2026-10-20", endDate: "2026-10-22" });
    await nextTick();
    for (const iso of ["2026-10-20", "2026-10-21", "2026-10-22"]) {
      expect(cell(wrapper, iso).findAll(".cal__chip")).toHaveLength(1);
    }
    expect(cell(wrapper, "2026-10-19").find(".cal__chip").exists()).toBe(false);
    expect(cell(wrapper, "2026-10-23").find(".cal__chip").exists()).toBe(false);
  });
});

describe("V3 calendar page, day panel", () => {
  it("opens for a clicked cell and for the date button, then closes with Escape and returns focus", async () => {
    const { wrapper } = mountPage();
    await cell(wrapper, "2026-10-16").trigger("click");
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes("aria-modal")).toBe("true");
    expect(dialog.get("h2").text()).toBe("Friday 16 October");
    expect(dialog.text()).toContain("Night duty: Daniel");
    expect(dialog.text()).toContain("Nothing planned for this day.");
    await dialog.trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(cell(wrapper, "2026-10-16").get("button.cal__daybtn").element);

    await cell(wrapper, "2026-10-17").get("button.cal__daybtn").trigger("click");
    expect(wrapper.get('[role="dialog"] h2').text()).toBe("Saturday 17 October");
    expect(cell(wrapper, "2026-10-17").classes()).toContain("cal__cell--selected");
  });

  it("opens the add form for today from the toolbar, with the only solid button being Save event", async () => {
    const { wrapper } = mountPage();
    await buttonByText(wrapper, "Add event").trigger("click");
    await flushPromises();
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.get("h2").text()).toBe("Wednesday 14 October");
    expect(solid(wrapper)).toHaveLength(1);
    expect(solid(wrapper)[0].text()).toBe("Save event");
    expect(document.activeElement).toBe(dialog.get('input[type="text"]').element);
    expect(dialog.find('input[type="time"]').exists()).toBe(false);
    for (const label of ["Title", "All day", "Start date", "End date", "Who is it for", "Type", "Notes (optional)"]) {
      expect(dialog.text()).toContain(label);
    }
    expect(dialog.get("textarea").attributes("maxlength")).toBe("280");
  });

  it("adds an event, shows it in the cell and the list, and returns focus on close", async () => {
    const { wrapper, store } = mountPage();
    const addButton = buttonByText(wrapper, "Add event");
    await addButton.trigger("click");
    await flushPromises();

    await buttonByText(wrapper, "Save event").trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toBe("Add a title for the event.");

    await wrapper.get('[role="dialog"] input[type="text"]').setValue("Health visitor");
    await wrapper.get('input[role="switch"]').setValue(false);
    expect(wrapper.findAll('input[type="time"]')).toHaveLength(2);
    await radio(wrapper, "Mei").trigger("click");
    await radio(wrapper, "Appointment").trigger("click");
    await wrapper.get("textarea").setValue("Bring the red book");
    await buttonByText(wrapper, "Save event").trigger("click");

    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      title: "Health visitor",
      date: "2026-10-14",
      endDate: "2026-10-14",
      allDay: false,
      start: "09:00",
      end: "10:00",
      owner: "partner",
      type: "appointment",
      notes: "Bring the red book",
    });
    expect(JSON.parse(localStorage.getItem(CALENDAR_KEY))).toHaveLength(1);
    const item = wrapper.get(".cdp__item");
    expect(item.text()).toContain("9:00 AM to 10:00 AM");
    expect(item.text()).toContain("Health visitor");
    expect(item.text()).toContain("Mei");
    expect(item.text()).toContain("Appointment");
    expect(item.text()).toContain("Bring the red book");
    expect(cell(wrapper, "2026-10-14").get(".cal__chip").attributes("data-owner")).toBe("partner");

    await wrapper.get('button[aria-label="Close"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(addButton.element);
    expect(solid(wrapper)).toHaveLength(1);
  });

  it("rejects an end time that is not after the start time", async () => {
    const { wrapper, store } = mountPage();
    await buttonByText(wrapper, "Add event").trigger("click");
    await flushPromises();
    await wrapper.get('[role="dialog"] input[type="text"]').setValue("Call");
    await wrapper.get('input[role="switch"]').setValue(false);
    const [start, end] = wrapper.findAll('input[type="time"]');
    await start.setValue("10:00");
    await end.setValue("09:00");
    await buttonByText(wrapper, "Save event").trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toBe("End time must be after start time.");
    expect(store.events).toHaveLength(0);
    await end.setValue("11:00");
    await buttonByText(wrapper, "Save event").trigger("click");
    expect(store.events).toHaveLength(1);
  });

  it("can add a multi-day event with an end date", async () => {
    const { wrapper, store } = mountPage();
    await buttonByText(wrapper, "Add event").trigger("click");
    await flushPromises();
    await wrapper.get('[role="dialog"] input[type="text"]').setValue("Trip");
    const [startDate, endDate] = wrapper.findAll('input[type="date"]');
    expect(startDate.element.value).toBe("2026-10-14");
    await endDate.setValue("2026-10-12");
    await buttonByText(wrapper, "Save event").trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toBe("End date must be on or after the start date.");
    await endDate.setValue("2026-10-16");
    await buttonByText(wrapper, "Save event").trigger("click");
    expect(store.events[0]).toMatchObject({ date: "2026-10-14", endDate: "2026-10-16" });
    expect(cell(wrapper, "2026-10-15").findAll(".cal__chip")).toHaveLength(1);
  });

  it("edits an event", async () => {
    const { wrapper, store } = mountPage();
    seed(store, { title: "Old title", owner: "me", date: "2026-10-16" });
    await nextTick();
    await cell(wrapper, "2026-10-16").trigger("click");
    await wrapper.get('button[aria-label="Edit Old title"]').trigger("click");
    const title = wrapper.get('[role="dialog"] input[type="text"]');
    expect(title.element.value).toBe("Old title");
    expect(wrapper.get("#cdp-form-title").text()).toBe("Edit event");
    await title.setValue("New title");
    await radio(wrapper, "Both").trigger("click");
    await buttonByText(wrapper, "Save event").trigger("click");
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({ title: "New title", owner: "both" });
    expect(wrapper.get(".cdp__item").text()).toContain("New title");
    expect(cell(wrapper, "2026-10-16").get(".cal__chip").attributes("data-owner")).toBe("both");
  });

  it("deletes only after a confirm", async () => {
    const { wrapper, store } = mountPage();
    seed(store, { title: "Doomed" });
    await nextTick();
    await cell(wrapper, "2026-10-14").trigger("click");
    await wrapper.get('button[aria-label="Delete Doomed"]').trigger("click");
    expect(wrapper.text()).toContain("Delete this event?");
    expect(store.events).toHaveLength(1);
    await buttonByText(wrapper, "Cancel").trigger("click");
    expect(store.events).toHaveLength(1);
    await wrapper.get('button[aria-label="Delete Doomed"]').trigger("click");
    await buttonByText(wrapper, "Delete").trigger("click");
    expect(store.events).toHaveLength(0);
    expect(wrapper.text()).toContain("Nothing planned for this day.");
    expect(cell(wrapper, "2026-10-14").find(".cal__chip").exists()).toBe(false);
  });

  it("adds from the toolbar to the selected day when it is in the month shown", async () => {
    const { wrapper } = mountPage();
    await cell(wrapper, "2026-10-21").trigger("click");
    await wrapper.get('button[aria-label="Close"]').trigger("click");
    await flushPromises();
    await buttonByText(wrapper, "Add event").trigger("click");
    expect(wrapper.get('[role="dialog"] h2').text()).toBe("Wednesday 21 October");
  });
});

describe("V3 calendar page, agenda view", () => {
  it("shows the empty state with only the toolbar button to click", async () => {
    const { wrapper } = mountPage();
    await radio(wrapper, "Agenda").trigger("click");
    expect(wrapper.find("table").exists()).toBe(false);
    expect(wrapper.get(".cal__empty").text()).toBe("No events yet. Add the first one.");
    expect(wrapper.find(".cal__arow").exists()).toBe(false);
    expect(solid(wrapper)).toHaveLength(1);
  });

  it("lists upcoming events by date and skips past ones", async () => {
    const { wrapper, store } = mountPage();
    seed(store, { title: "Past", date: "2026-10-01" });
    seed(store, { title: "Now", date: "2026-10-14" });
    seed(store, { title: "Soon", date: "2026-10-15", allDay: false, start: "09:30", owner: "me" });
    seed(store, { title: "Later", date: "2026-10-30", endDate: "2026-11-02", owner: "partner" });
    await radio(wrapper, "Agenda").trigger("click");
    const headings = wrapper.findAll(".cal__group-title").map((h) => h.text());
    expect(headings[0]).toContain("Today");
    expect(headings[1]).toContain("Tomorrow");
    expect(headings[2]).toBe("Fri 30 October");
    expect(wrapper.text()).not.toContain("Past");
    expect(wrapper.text()).toContain("9:30 AM");
    expect(wrapper.text()).toContain("30 October to 2 November");
    await wrapper.get('[data-event]').trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
  });

  it("says nothing is coming up when only past events exist", async () => {
    const { wrapper, store } = mountPage();
    seed(store, { title: "Past", date: "2026-09-01" });
    await radio(wrapper, "Agenda").trigger("click");
    expect(wrapper.get(".cal__empty").text()).toBe("No upcoming events.");
  });
});
