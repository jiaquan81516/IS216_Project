import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(async () => {}),
  runSync: vi.fn(),
  fetchUpcoming: vi.fn(async () => []),
}));

vi.mock("@/app/api/googleCalendarClient", () => ({
  isClientModeAvailable: () => true,
  connect: (...a) => mocks.connect(...a),
  disconnect: (...a) => mocks.disconnect(...a),
}));
vi.mock("@/app/api/googleCalendarSync", () => ({
  runSync: (...a) => mocks.runSync(...a),
  fetchUpcoming: (...a) => mocks.fetchUpcoming(...a),
}));
vi.mock("@/app/stores/calendar", () => ({ useCalendarStore: () => ({ householdId: "h1", events: [] }) }));
vi.mock("@/app/stores/rota", () => ({ useRotaStore: () => ({ meUid: "u1", view: {}, plan: { handoverTime: "07:00" } }) }));

import GoogleCalendarClientCard from "@/app/components/GoogleCalendarClientCard.vue";
import { resetGoogleCalendarClientState } from "@/app/composables/useGoogleCalendarClient";

const mountCard = () => mount(GoogleCalendarClientCard, { props: { householdId: "h1", uid: "u1" } });
const btn = (w, text) => w.findAll("button").find((b) => b.text() === text);

beforeEach(() => {
  resetGoogleCalendarClientState();
  localStorage.clear();
  for (const fn of Object.values(mocks)) fn.mockClear?.();
  mocks.connect.mockResolvedValue({ email: "dad@example.com" });
  mocks.runSync.mockResolvedValue({ added: 7, updated: 2, removed: 0, unchanged: 0 });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Google Calendar card (browser mode)", () => {
  it("starts not connected with one outline connect button and the tab only note", () => {
    const w = mountCard();
    expect(w.text()).toContain("Not connected");
    const connect = btn(w, "Connect Google Calendar");
    expect(connect.classes()).not.toContain("btn-primary");
    expect(w.text()).toContain("stays in this browser tab only");
    expect(w.findAll('[role="switch"]')).toHaveLength(0);
    expect(w.text()).not.toMatch(new RegExp("[\\u2013\\u2014]"));
  });

  it("shows a connecting state while Google is open", async () => {
    let finish;
    mocks.connect.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const w = mountCard();
    await btn(w, "Connect Google Calendar").trigger("click");
    expect(w.text()).toContain("Connecting to Google");
    expect(btn(w, "Connecting...").attributes("disabled")).toBeDefined();
    finish({ email: "dad@example.com" });
    await flushPromises();
    expect(w.text()).toContain("Connected as dad@example.com");
  });

  it("shows the three toggles, Sync now and Disconnect once connected", async () => {
    const w = mountCard();
    await btn(w, "Connect Google Calendar").trigger("click");
    await flushPromises();
    expect(w.findAll("label").map((l) => l.text())).toEqual(["Add my night duty", "Add appointments", "Show Google events"]);
    expect(btn(w, "Sync now")).toBeTruthy();
    expect(btn(w, "Disconnect").classes()).toContain("gcc__link");
    expect(mocks.fetchUpcoming).toHaveBeenCalled();
  });

  it("syncs and reports last sync with the counts", async () => {
    const w = mountCard();
    await btn(w, "Connect Google Calendar").trigger("click");
    await flushPromises();
    await btn(w, "Sync now").trigger("click");
    await flushPromises();
    expect(mocks.runSync).toHaveBeenCalledTimes(1);
    expect(mocks.runSync.mock.calls[0][0]).toMatchObject({ householdId: "h1", uid: "u1" });
    expect(w.text()).toContain("Added 7, updated 2, removed 0");
  });

  it("turns a toggle off and stops loading Google events", async () => {
    const w = mountCard();
    await btn(w, "Connect Google Calendar").trigger("click");
    await flushPromises();
    mocks.fetchUpcoming.mockClear();
    await w.get("#gcc-show").trigger("click");
    await flushPromises();
    expect(w.get("#gcc-show").attributes("aria-checked")).toBe("false");
    expect(mocks.fetchUpcoming).not.toHaveBeenCalled();
  });

  it("shows an alert with the next step when connecting fails", async () => {
    mocks.connect.mockRejectedValue(Object.assign(new Error("x"), { code: "denied" }));
    const w = mountCard();
    await btn(w, "Connect Google Calendar").trigger("click");
    await flushPromises();
    const alert = w.get('[role="alert"]');
    expect(alert.text()).toContain("Select Connect Google Calendar");
    expect(btn(w, "Connect Google Calendar")).toBeTruthy();
  });

  it("asks to reconnect when a sync gets a 401", async () => {
    const w = mountCard();
    await btn(w, "Connect Google Calendar").trigger("click");
    await flushPromises();
    mocks.runSync.mockRejectedValue(Object.assign(new Error("x"), { code: "reconnect" }));
    await btn(w, "Sync now").trigger("click");
    await flushPromises();
    expect(w.get('[role="alert"]').text()).toContain("reconnect");
    expect(btn(w, "Connect Google Calendar")).toBeTruthy();
  });

  it("disconnects back to not connected", async () => {
    const w = mountCard();
    await btn(w, "Connect Google Calendar").trigger("click");
    await flushPromises();
    await btn(w, "Disconnect").trigger("click");
    await flushPromises();
    expect(mocks.disconnect).toHaveBeenCalled();
    expect(w.text()).toContain("Not connected");
  });
});
