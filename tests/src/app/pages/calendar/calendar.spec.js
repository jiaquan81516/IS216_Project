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
vi.mock("@/app/api/calendar", () => ({
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
vi.mock("@/app/api/rota", () => ({
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
const cell = (wrapper, iso) => wrapper.get(`td[data-date="${iso}"]`);
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
  it("shows the heading, subtitle, month label and view switch without tabs", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.get("h1").text()).toBe("Calendar");
    expect(wrapper.text()).toContain("You both see the same calendar.");
    expect(wrapper.get(".cal__month").text()).toBe("October 2026");
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
    expect(wrapper.findAll('[role="radio"]').map((b) => b.text())).toEqual(["Month", "Agenda"]);
    expect(wrapper.text()).not.toMatch(/[\u2013\u2014]/);
  });

  it("has exactly one solid button when the panel is closed", async () => {
    const { wrapper } = await mountPage();
    expect(solid(wrapper)).toHaveLength(1);
    expect(solid(wrapper)[0].text()).toBe("Add event");
  });

  it("draws 7 weekday headers and 42 days, with today marked once", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.findAll("th").map((h) => h.text())).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(wrapper.findAll("td.cal__cell")).toHaveLength(42);
    const today = wrapper.findAll(".cal__num--today");
    expect(today).toHaveLength(1);
    expect(today[0].text()).toBe("14");
  });

  it("shows who is on night duty from the shared rota", async () => {
    const { wrapper } = await mountPage();
    const mine = cell(wrapper, "2026-10-14").get(".cal__night");
    expect(mine.attributes("aria-label")).toBe("Night duty: Daniel");
    expect(mine.text()).toBe("D");
    expect(cell(wrapper, "2026-10-15").get(".cal__night").attributes("aria-label")).toBe("Night duty: Mei");
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
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("explains permission-denied and offers Try again", async () => {
    api.error = { code: "permission-denied" };
    const { wrapper } = await mountPage();
    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain("do not allow reading the calendar");
    await buttonByText(wrapper, "Try again").trigger("click");
    expect(retry).toHaveBeenCalled();
  });

  it("names the owner of each event from the uid stored with it", async () => {
    api.events = [event({ title: "Mine", owner: ME }), event({ title: "Theirs", owner: PARTNER })];
    const { wrapper } = await mountPage();
    const c = cell(wrapper, "2026-10-14");
    expect(c.findAll(".cal__chip").map((x) => x.attributes("data-owner"))).toEqual(["me", "partner"]);
    expect(c.findAll(".cal__chip")[0].text()).toContain("Daniel");
    expect(c.findAll(".cal__chip")[1].text()).toContain("Mei");
  });

  it("limits a cell to two chips and opens the day for the rest", async () => {
    api.events = [
      event({ title: "Mine", owner: ME }),
      event({ title: "Theirs", owner: PARTNER }),
      event({ title: "Ours", owner: "both" }),
    ];
    const { wrapper } = await mountPage();
    const c = cell(wrapper, "2026-10-14");
    expect(c.findAll(".cal__chip")).toHaveLength(2);
    const more = c.get(".cal__more");
    expect(more.text()).toBe("+1 more");
    await more.trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.findAll(".cdp__item")).toHaveLength(3);
  });

  it("shows a multi-day event on every day it covers", async () => {
    api.events = [event({ title: "Leave", date: "2026-10-20", endDate: "2026-10-22" })];
    const { wrapper } = await mountPage();
    for (const iso of ["2026-10-20", "2026-10-21", "2026-10-22"]) {
      expect(cell(wrapper, iso).findAll(".cal__chip")).toHaveLength(1);
    }
    expect(cell(wrapper, "2026-10-19").find(".cal__chip").exists()).toBe(false);
  });

  it("moves between months and back to today", async () => {
    const { wrapper } = await mountPage();
    await wrapper.get('button[aria-label="Next month"]').trigger("click");
    expect(wrapper.get(".cal__month").text()).toBe("November 2026");
    await buttonByText(wrapper, "Today").trigger("click");
    expect(wrapper.get(".cal__month").text()).toBe("October 2026");
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
    expect(document.activeElement).toBe(cell(wrapper, "2026-10-16").get("button.cal__daybtn").element);
  });

  it("opens the add form from the toolbar, with Save event as the only solid button", async () => {
    const { wrapper } = await mountPage();
    await buttonByText(wrapper, "Add event").trigger("click");
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
    const addButton = buttonByText(wrapper, "Add event");
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
    await buttonByText(wrapper, "Add event").trigger("click");
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
    expect(wrapper.findAll("td.cal__cell")).toHaveLength(42);
  });
});

describe("App calendar page, agenda view", () => {
  it("shows the empty state with only the toolbar button to click", async () => {
    const { wrapper } = await mountPage();
    await radio(wrapper, "Agenda").trigger("click");
    expect(wrapper.find("table").exists()).toBe(false);
    expect(wrapper.get(".cal__empty").text()).toBe("No events yet. Add the first one.");
    expect(solid(wrapper)).toHaveLength(1);
  });

  it("lists upcoming events by date and skips past ones", async () => {
    api.events = [
      event({ title: "Past", date: "2026-10-01" }),
      event({ title: "Now", date: "2026-10-14" }),
      event({ title: "Soon", date: "2026-10-15", allDay: false, start: "09:30", owner: ME }),
      event({ title: "Later", date: "2026-10-30", endDate: "2026-11-02", owner: PARTNER }),
    ];
    const { wrapper } = await mountPage();
    await radio(wrapper, "Agenda").trigger("click");
    const headings = wrapper.findAll(".cal__group-title").map((h) => h.text());
    expect(headings[0]).toContain("Today");
    expect(headings[1]).toContain("Tomorrow");
    expect(headings[2]).toBe("Fri 30 October");
    expect(wrapper.text()).not.toContain("Past");
    expect(wrapper.text()).toContain("9:30 AM");
    expect(wrapper.text()).toContain("30 October to 2 November");
    expect(wrapper.findAll(".cal__owner").map((o) => o.text())).toContain("Mei");
  });
});
