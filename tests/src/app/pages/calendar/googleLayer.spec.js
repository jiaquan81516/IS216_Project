import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { HOME_KEY } from "@/app/composables/useHome";
import { SHARED_KEY } from "@/app/composables/useShared";
import { useCalendarStore } from "@/app/stores/calendar";
import { useRotaStore } from "@/app/stores/rota";

vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({}) }));
vi.mock("@/api/calendar", () => ({
  subscribeEvents: (hid, onData) => {
    queueMicrotask(() => onData([]));
    return () => {};
  },
  addEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  migrateLegacyCalendar: vi.fn(async () => false),
}));
vi.mock("@/api/rota", () => ({
  subscribeRotaSettings: (hid, onData) => (queueMicrotask(() => onData(null)), () => {}),
  subscribeNights: (a, b, c, onData) => (queueMicrotask(() => onData([])), () => {}),
  subscribeSwaps: (hid, onData) => (queueMicrotask(() => onData([])), () => {}),
  saveRotaSettings: vi.fn(),
  setNightOverride: vi.fn(),
  clearNightOverride: vi.fn(),
  requestSwap: vi.fn(),
  respondToSwap: vi.fn(),
  cancelSwap: vi.fn(),
  migrateLegacyRota: vi.fn(async () => false),
}));

import CalendarPage from "@/app/pages/calendar/index.vue";
import { resetGoogleCalendarClientState, useGoogleCalendarClient } from "@/app/composables/useGoogleCalendarClient";

const gevent = {
  id: "google:1",
  title: "Dentist",
  date: "2026-10-15",
  endDate: "2026-10-15",
  allDay: true,
  start: null,
  end: null,
  source: "google",
  owner: "google",
};

async function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  useCalendarStore().bind("h1", "u1", "u2");
  useRotaStore().bind("h1", "u1", "u2");
  const home = { householdId: ref("h1"), me: ref({ uid: "u1", firstName: "daniel" }), partner: ref({ uid: "u2", firstName: "mei" }) };
  const wrapper = mount(CalendarPage, {
    attachTo: document.body,
    global: { plugins: [pinia], provide: { [HOME_KEY]: home, [SHARED_KEY]: { retry: vi.fn() } } },
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  resetGoogleCalendarClientState();
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 9, 14, 12, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("Calendar page, From Google Calendar layer", () => {
  it("shows nothing and no toggle when Google is not connected", async () => {
    const w = await mountPage();
    expect(w.text()).not.toContain("Show Google events");
    expect(w.find('[data-owner="google"].cal__bar').exists()).toBe(false);
  });

  it("draws a muted read only bar with Google in its label, and lets the toggle hide it", async () => {
    const { state } = useGoogleCalendarClient();
    state.connected = true;
    state.googleEvents = [gevent];
    const w = await mountPage();
    const bar = w.get('.cal__bar[data-owner="google"]');
    expect(bar.attributes("aria-label")).toContain("Google Calendar");
    expect(bar.text()).toBe("Dentist");
    const toggle = w.findAll("label.cal__layer").find((l) => l.text() === "Show Google events");
    expect(toggle).toBeTruthy();
    await toggle.get("input").setValue(false);
    await flushPromises();
    expect(w.find('.cal__bar[data-owner="google"]').exists()).toBe(false);
  });

  it("shows the event in the week view too, and a click does not open an edit form", async () => {
    const { state } = useGoogleCalendarClient();
    state.connected = true;
    state.googleEvents = [gevent];
    const w = await mountPage();
    await w.findAll('[role="radio"]').find((b) => b.text() === "Weekly").trigger("click");
    await w.get('.cal__bar[data-owner="google"]').trigger("click");
    await flushPromises();
    expect(w.text()).not.toContain("Save changes");
  });
});
