import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { HOME_KEY } from "@/app/composables/useHome";
import { SHARED_KEY } from "@/app/composables/useShared";
import { useCalendarStore } from "@/app/stores/calendar";
import { useRotaStore } from "@/app/stores/rota";

// Both shared api modules are mocked: the page reads them through the stores.
const api = vi.hoisted(() => ({
  events: [],
  error: null,
  cb: {},
  rotaSettings: null,
  addEvent: vi.fn(async () => "e-new"),
  updateEvent: vi.fn(async () => {}),
  deleteEvent: vi.fn(async () => {}),
}));

vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({}) }));
vi.mock("@/api/calendar", () => ({
  subscribeEvents: (hid, onData, onError) => {
    api.cb.events = onData;
    queueMicrotask(() => (api.error ? onError(api.error) : onData(api.events)));
    return () => {};
  },
  addEvent: (...a) => api.addEvent(...a),
  updateEvent: (...a) => api.updateEvent(...a),
  deleteEvent: (...a) => api.deleteEvent(...a),
  migrateLegacyCalendar: vi.fn(async () => false),
}));
vi.mock("@/api/rota", () => ({
  subscribeRotaSettings: (hid, onData) => {
    queueMicrotask(() => onData(api.rotaSettings));
    return () => {};
  },
  subscribeNights: (hid, from, to, onData) => {
    queueMicrotask(() => onData([]));
    return () => {};
  },
  subscribeSwaps: (hid, onData) => {
    queueMicrotask(() => onData([]));
    return () => {};
  },
  saveRotaSettings: vi.fn(async () => {}),
  setNightOverride: vi.fn(async () => {}),
  clearNightOverride: vi.fn(async () => {}),
  requestSwap: vi.fn(async () => "s"),
  respondToSwap: vi.fn(async () => {}),
  cancelSwap: vi.fn(async () => {}),
  migrateLegacyRota: vi.fn(async () => false),
}));

import CalendarPage from "@/app/pages/calendar/index.vue";

// Wednesday 14 October 2026. The rota starts Monday 12 October with Daniel (me) on duty.
const NOW = new Date(2026, 9, 14, 12, 0, 0);
const ME = "u1";
const PARTNER = "u2";
const retry = vi.fn();

async function mountPage({ named = true, householdId = "h1" } = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useCalendarStore();
  const rota = useRotaStore();
  const home = named
    ? {
        householdId: ref(householdId),
        me: ref({ uid: ME, firstName: "daniel" }),
        partner: ref({ uid: PARTNER, firstName: "mei" }),
      }
    : { householdId: ref(householdId), me: ref({ uid: ME }), partner: ref(null) };
  if (householdId) {
    store.bind(householdId, ME, named ? PARTNER : "");
    rota.bind(householdId, ME, named ? PARTNER : "");
  }
  const wrapper = mount(CalendarPage, {
    attachTo: document.body,
    global: { plugins: [pinia], provide: { [HOME_KEY]: home, [SHARED_KEY]: { retry } } },
  });
  await flushPromises();
  return { wrapper, store };
}
const solid = (wrapper) => wrapper.findAll("button.btn-primary, a.btn-primary");
const buttonByText = (wrapper, text) => wrapper.findAll("button").find((b) => b.text() === text);
const radio = (wrapper, text) => wrapper.findAll('[role="radio"]').find((b) => b.text() === text);
const cell = (wrapper, iso) => wrapper.get(`[role="gridcell"][data-date="${iso}"]`);
const bars = (wrapper) => wrapper.findAll(".cal__bar");
let nextId = 0;
const event = (over = {}) => ({
  id: `e${(nextId += 1)}`,
  title: "Event",
  date: "2026-10-14",
  endDate: over.endDate ?? over.date ?? "2026-10-14",
  allDay: true,
  start: null,
  end: null,
  owner: "both",
  type: "family",
  notes: "",
  ...over,
});

beforeEach(() => {
  api.events = [];
  api.error = null;
  api.cb = {};
  api.rotaSettings = { pattern: "alternate", firstOnDuty: ME, startDate: "2026-10-12", handoverTime: "07:00" };
  nextId = 0;
  retry.mockClear();
  for (const key of ["addEvent", "updateEvent", "deleteEvent"]) api[key].mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("App calendar page, month view", () => {
  it("shows the heading, subtitle, TimeTree style title and the Monthly or Weekly toggle", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.get("h1").text()).toBe("Calendar");
    expect(wrapper.text()).toContain("You both see the same calendar.");
    expect(wrapper.get(".cal__month").text()).toBe("October, 2026");
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
    expect(wrapper.findAll('[role="radio"]').map((b) => b.text())).toEqual(["Monthly", "Weekly"]);
    expect(radio(wrapper, "Monthly").attributes("aria-checked")).toBe("true");
    expect(wrapper.text()).not.toMatch(/[\u2013\u2014]/);
  });

  it("has no solid button when the panel is closed, and an outlined plus button", async () => {
    const { wrapper } = await mountPage();
    expect(solid(wrapper)).toHaveLength(0);
    expect(wrapper.get('button[aria-label="Add event"]').classes()).toContain("cal__sq");
  });

  it("switches to the weekly view and back", async () => {
    const { wrapper } = await mountPage();
    await radio(wrapper, "Weekly").trigger("click");
    expect(radio(wrapper, "Weekly").attributes("aria-checked")).toBe("true");
    expect(wrapper.findAll(".cal__wkcol")).toHaveLength(7);
    expect(wrapper.findAll('[role="columnheader"]')).toHaveLength(7);
    expect(wrapper.get(".cal__month").text()).toBe("October, 2026");
    await radio(wrapper, "Monthly").trigger("click");
    expect(wrapper.findAll(".cal__cell")).toHaveLength(42);
  });

  it("draws 7 weekday headers and 42 days, with today marked once", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.findAll('[role="columnheader"]').map((h) => h.text())).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(wrapper.find('[role="grid"]').exists()).toBe(true);
    expect(wrapper.findAll("[role='gridcell'].cal__cell")).toHaveLength(42);
    expect(wrapper.findAll('[aria-current="date"]')).toHaveLength(1);
    const today = wrapper.findAll(".cal__num--today");
    expect(today).toHaveLength(1);
    expect(today[0].text()).toBe("14");
    expect(cell(wrapper, "2026-10-14").attributes("aria-current")).toBe("date");
  });

  it("labels each day with its date and event count, and colours Sundays", async () => {
    api.events = [event({ title: "A", date: "2026-10-11" }), event({ title: "B", date: "2026-10-11" })];
    const { wrapper } = await mountPage();
    expect(cell(wrapper, "2026-10-11").attributes("aria-label")).toBe("Sunday 11 October, 2 events");
    expect(cell(wrapper, "2026-10-12").attributes("aria-label")).toBe("Monday 12 October");
    expect(wrapper.findAll(".cal__num--sun").length).toBeGreaterThan(4);
  });

  it("shows who is on night duty as a thin line from the shared rota", async () => {
    const { wrapper } = await mountPage();
    const mine = cell(wrapper, "2026-10-14").get(".cal__night");
    expect(mine.attributes("aria-label")).toBe("Night duty: Daniel");
    expect(mine.attributes("title")).toBe("Night duty: Daniel");
    expect(mine.get(".cal__nightpart").attributes("data-who")).toBe("me");
    expect(cell(wrapper, "2026-10-15").get(".cal__night").attributes("aria-label")).toBe("Night duty: Mei");
    expect(cell(wrapper, "2026-10-15").get(".cal__nightpart").attributes("data-who")).toBe("partner");
    expect(wrapper.find(".cal__cell .cal__night svg").exists()).toBe(false);
  });

  it("hides the night line when the Night duty layer is switched off", async () => {
    const { wrapper } = await mountPage();
    const toggle = wrapper.findAll(".cal__layer").find((l) => l.text() === "Night duty").get("input");
    await toggle.setValue(false);
    expect(wrapper.find(".cal__night").exists()).toBe(false);
  });

  it("uses generic names when the household is unknown", async () => {
    const { wrapper } = await mountPage({ named: false });
    expect(cell(wrapper, "2026-10-15").get(".cal__night").attributes("aria-label")).toBe("Night duty: Your partner");
    expect(wrapper.get(".cal__legend").text()).toContain("Your partner");
  });

  it("shows Loading the calendar and no alert before the household id exists", async () => {
    const { wrapper } = await mountPage({ householdId: "" });
    expect(wrapper.text()).toContain("Loading the calendar...");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('[role="grid"]').exists()).toBe(false);
  });

  it("explains permission-denied and offers Try again", async () => {
    api.error = { code: "permission-denied" };
    const { wrapper } = await mountPage();
    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain("do not allow reading the calendar");
    await buttonByText(wrapper, "Try again").trigger("click");
    expect(retry).toHaveBeenCalled();
  });

  it("colours each event by the owner uid stored with it", async () => {
    api.events = [event({ title: "Mine", owner: ME }), event({ title: "Theirs", owner: PARTNER })];
    const { wrapper } = await mountPage();
    expect(bars(wrapper).map((x) => x.attributes("data-owner"))).toEqual(["me", "partner"]);
    expect(bars(wrapper)[0].attributes("aria-label")).toContain("Daniel");
    expect(bars(wrapper)[1].attributes("aria-label")).toContain("Mei");
  });

  it("draws a timed event as a row with a dot, title and right-aligned time", async () => {
    api.events = [event({ title: "Feed", allDay: false, start: "19:00", end: "19:30", owner: PARTNER })];
    const { wrapper } = await mountPage();
    const row = wrapper.get(".cal__ev");
    expect(row.find(".cal__evdot").exists()).toBe(true);
    expect(row.get(".cal__evtitle").text()).toBe("Feed");
    expect(row.get(".cal__evtime").text()).toBe("7:00 PM");
    expect(wrapper.find(".cal__bar").exists()).toBe(false);
  });

  it("shows three rows and a +N chip for the rest, which opens the day", async () => {
    api.events = [
      event({ title: "One", owner: ME }),
      event({ title: "Two", owner: PARTNER }),
      event({ title: "Three", owner: "both" }),
      event({ title: "Four", owner: ME }),
      event({ title: "Five", owner: ME }),
    ];
    const { wrapper } = await mountPage();
    expect(wrapper.findAll(".cal__item")).toHaveLength(3);
    const more = wrapper.findAll(".cal__more").find((m) => m.isVisible());
    expect(more.text()).toBe("+2");
    expect(more.attributes("aria-label")).toBe("2 more events on Wednesday 14 October");
    await more.trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.findAll(".cdp__item")).toHaveLength(5);
  });

  it("spans a multi-day event as one bar across the days it covers", async () => {
    api.events = [event({ title: "Leave", date: "2026-10-20", endDate: "2026-10-22" })];
    const { wrapper } = await mountPage();
    expect(bars(wrapper)).toHaveLength(1);
    expect(bars(wrapper)[0].attributes("style")).toContain("span 3");
  });

  it("hides a person's events when their layer is switched off", async () => {
    api.events = [event({ title: "Mine", owner: ME }), event({ title: "Theirs", owner: PARTNER })];
    const { wrapper } = await mountPage();
    const toggle = wrapper.findAll(".cal__layer").find((l) => l.text() === "Mei's events").get("input");
    await toggle.setValue(false);
    expect(bars(wrapper).map((x) => x.attributes("data-owner"))).toEqual(["me"]);
    const all = wrapper.findAll(".cal__layer").find((l) => l.text().endsWith("Everything")).get("input");
    await all.setValue(true);
    expect(bars(wrapper)).toHaveLength(2);
    await all.setValue(false);
    expect(bars(wrapper)).toHaveLength(0);
  });

  it("moves between months and back to today", async () => {
    const { wrapper } = await mountPage();
    await wrapper.get('button[aria-label="Next month"]').trigger("click");
    expect(wrapper.get(".cal__month").text()).toBe("November, 2026");
    await buttonByText(wrapper, "Today").trigger("click");
    expect(wrapper.get(".cal__month").text()).toBe("October, 2026");
  });
});

describe("App calendar page, day panel", () => {
  it("opens for a clicked cell, then closes with Escape and returns focus", async () => {
    const { wrapper } = await mountPage();
    await cell(wrapper, "2026-10-16").trigger("click");
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.get("h2").text()).toBe("Friday 16 October");
    expect(dialog.text()).toContain("Night duty: Daniel");
    expect(dialog.text()).toContain("Nothing planned for this day.");
    await dialog.trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(cell(wrapper, "2026-10-16").element);
  });

  it("opens the add form from the toolbar, with Save event as the only solid button", async () => {
    const { wrapper } = await mountPage();
    await wrapper.get('button[aria-label="Add event"]').trigger("click");
    await flushPromises();
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.get("h2").text()).toBe("Wednesday 14 October");
    expect(solid(wrapper)).toHaveLength(1);
    expect(solid(wrapper)[0].text()).toBe("Save event");
    for (const label of ["Title", "All day", "Start date", "End date", "Who is it for", "Type", "Notes (optional)"]) {
      expect(dialog.text()).toContain(label);
    }
  });

  it("saves a new event with the partner's uid as the owner", async () => {
    const { wrapper } = await mountPage();
    const addButton = wrapper.get('button[aria-label="Add event"]');
    await addButton.trigger("click");
    await flushPromises();

    await buttonByText(wrapper, "Save event").trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toBe("Add a title for the event.");

    await wrapper.get('[role="dialog"] input[type="text"]').setValue("Health visitor");
    await wrapper.get('input[role="switch"]').setValue(false);
    await radio(wrapper, "Mei").trigger("click");
    await radio(wrapper, "Appointment").trigger("click");
    await wrapper.get("textarea").setValue("Bring the red book");
    await buttonByText(wrapper, "Save event").trigger("click");
    await flushPromises();

    expect(api.addEvent).toHaveBeenCalledWith("h1", ME, {
      title: "Health visitor",
      date: "2026-10-14",
      endDate: "2026-10-14",
      allDay: false,
      start: "09:00",
      end: "10:00",
      owner: PARTNER,
      type: "appointment",
      notes: "Bring the red book",
    });
  });

  it("shows an event the partner added, live, with their name", async () => {
    const { wrapper } = await mountPage();
    await cell(wrapper, "2026-10-14").trigger("click");
    expect(wrapper.get('[role="dialog"]').text()).toContain("Nothing planned for this day.");
    api.cb.events([event({ title: "Jab", owner: PARTNER, allDay: false, start: "09:00", end: "10:00" })]);
    await flushPromises();
    const item = wrapper.get(".cdp__item");
    expect(item.text()).toContain("Jab");
    expect(item.text()).toContain("Mei");
    expect(item.text()).toContain("9:00 AM to 10:00 AM");
    expect(item.get(".cdp__owner").attributes("data-owner")).toBe("partner");
  });

  it("rejects an end time that is not after the start time", async () => {
    const { wrapper } = await mountPage();
    await wrapper.get('button[aria-label="Add event"]').trigger("click");
    await flushPromises();
    await wrapper.get('[role="dialog"] input[type="text"]').setValue("Call");
    await wrapper.get('input[role="switch"]').setValue(false);
    const [start, end] = wrapper.findAll('input[type="time"]');
    await start.setValue("10:00");
    await end.setValue("09:00");
    await buttonByText(wrapper, "Save event").trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toBe("End time must be after start time.");
    expect(api.addEvent).not.toHaveBeenCalled();
  });

  it("edits an event either parent owns", async () => {
    api.events = [event({ title: "Old title", owner: PARTNER, date: "2026-10-16" })];
    const { wrapper } = await mountPage();
    await cell(wrapper, "2026-10-16").trigger("click");
    await wrapper.get('button[aria-label="Edit Old title"]').trigger("click");
    const title = wrapper.get('[role="dialog"] input[type="text"]');
    expect(title.element.value).toBe("Old title");
    expect(radio(wrapper, "Mei").attributes("aria-checked")).toBe("true");
    await title.setValue("New title");
    await radio(wrapper, "Both").trigger("click");
    await buttonByText(wrapper, "Save event").trigger("click");
    await flushPromises();
    expect(api.updateEvent).toHaveBeenCalledWith("h1", "e1", expect.objectContaining({ title: "New title", owner: "both" }));
  });

  it("deletes only after a confirm", async () => {
    api.events = [event({ title: "Doomed" })];
    const { wrapper } = await mountPage();
    await cell(wrapper, "2026-10-14").trigger("click");
    await wrapper.get('button[aria-label="Delete Doomed"]').trigger("click");
    expect(wrapper.text()).toContain("Delete this event?");
    expect(api.deleteEvent).not.toHaveBeenCalled();
    await buttonByText(wrapper, "Cancel").trigger("click");
    expect(api.deleteEvent).not.toHaveBeenCalled();
    await wrapper.get('button[aria-label="Delete Doomed"]').trigger("click");
    await buttonByText(wrapper, "Delete").trigger("click");
    await flushPromises();
    expect(api.deleteEvent).toHaveBeenCalledWith("h1", "e1");
  });

  it("shows a failed write without hiding the month", async () => {
    api.deleteEvent.mockRejectedValueOnce(Object.assign(new Error("no"), { code: "permission-denied" }));
    api.events = [event({ title: "Doomed" })];
    const { wrapper } = await mountPage();
    await cell(wrapper, "2026-10-14").trigger("click");
    await wrapper.get('button[aria-label="Delete Doomed"]').trigger("click");
    await buttonByText(wrapper, "Delete").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("could not delete the event");
    expect(wrapper.findAll(".cal__cell")).toHaveLength(42);
  });
});

describe("App calendar page, weekly view", () => {
  it("shows an all day row, an hour grid and timed blocks", async () => {
    api.events = [
      event({ title: "Trip", date: "2026-10-13", endDate: "2026-10-15" }),
      event({ title: "Jab", date: "2026-10-14", allDay: false, start: "09:00", end: "10:00", owner: PARTNER }),
    ];
    const { wrapper } = await mountPage();
    await radio(wrapper, "Weekly").trigger("click");
    expect(wrapper.text()).toContain("All day");
    expect(wrapper.findAll(".cal__wkline")).toHaveLength(24);
    expect(wrapper.findAll(".cal__bar")).toHaveLength(1);
    const block = wrapper.get(".cal__block");
    expect(block.text()).toContain("Jab");
    expect(block.text()).toContain("9:00 AM");
    expect(block.attributes("style")).toContain("top: 433px");
  });

  it("steps by week and opens a block for editing", async () => {
    api.events = [event({ title: "Jab", date: "2026-10-14", allDay: false, start: "09:00", end: "10:00", owner: PARTNER })];
    const { wrapper } = await mountPage();
    await radio(wrapper, "Weekly").trigger("click");
    await wrapper.get(".cal__block").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="dialog"] input[type="text"]').element.value).toBe("Jab");
    await wrapper.get('[role="dialog"]').trigger("keydown", { key: "Escape" });
    await wrapper.get('button[aria-label="Next week"]').trigger("click");
    expect(wrapper.find(".cal__block").exists()).toBe(false);
  });
});
