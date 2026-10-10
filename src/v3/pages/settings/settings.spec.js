import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { V3_HOME_KEY } from "@/v3/composables/useV3Home";
import { resetV3Display } from "@/v3/composables/useV3Prefs";
import { V3_ROUTES } from "@/v3/routes";
import { LIMITS_KEY } from "@/v3/api/limits";

const api = vi.hoisted(() => ({
  saveSettingsPatch: vi.fn(async () => {}),
  saveHouseholdBaby: vi.fn(async () => {}),
  leaveHousehold: vi.fn(async () => {}),
  deleteAccountFallback: vi.fn(async () => ({ removed: [], kept: ["the care log entries you wrote"] })),
  regenerateInviteCode: vi.fn(async () => ({ inviteCode: "NT-NEW1" })),
  getInvite: vi.fn(async () => ({ code: "NT-4F7K", expiresAt: new Date(Date.now() + 6 * 86400000 + 3600000) })),
  deleteAccount: vi.fn(async () => {}),
  startGoogleConnect: vi.fn(async () => "/api/google/connect"),
  disconnectGoogle: vi.fn(async () => {}),
}));

vi.mock("@/api/firebase", () => ({ default: {}, auth: { currentUser: { uid: "u1", providerData: [] } } }));
vi.mock("@/v3/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("firebase/auth", () => ({ deleteUser: vi.fn() }));
vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: { value: { uid: "u1" } } }) }));
vi.mock("@/v3/api/account", async (importOriginal) => ({
  ...(await importOriginal()),
  saveSettingsPatch: (...a) => api.saveSettingsPatch(...a),
  saveHouseholdBaby: (...a) => api.saveHouseholdBaby(...a),
  leaveHousehold: (...a) => api.leaveHousehold(...a),
  deleteAccountFallback: (...a) => api.deleteAccountFallback(...a),
}));
vi.mock("@/v3/api/profile", async (importOriginal) => ({
  ...(await importOriginal()),
  regenerateInviteCode: (...a) => api.regenerateInviteCode(...a),
  getInvite: (...a) => api.getInvite(...a),
}));
vi.mock("@/v3/api/server", async (importOriginal) => ({
  ...(await importOriginal()),
  deleteAccount: (...a) => api.deleteAccount(...a),
  startGoogleConnect: (...a) => api.startGoogleConnect(...a),
  disconnectGoogle: (...a) => api.disconnectGoogle(...a),
}));

import SettingsPage from "./index.vue";

function makeHome(overrides = {}) {
  return {
    loading: ref(false),
    error: ref(""),
    reload: vi.fn(async () => {}),
    me: ref({ uid: "u1", firstName: "daniel", displayName: "daniel Tan", email: "d@example.com" }),
    partner: ref(null),
    profile: ref({ displayName: "daniel Tan", householdId: "h1", settings: null }),
    household: ref({ babyName: "Aria", babyStatus: "born", babyDate: "2026-09-01", inviteCode: "NT-4F7K" }),
    householdId: ref("h1"),
    baby: ref({ name: "Aria", line: "5 weeks old" }),
    inviteCode: ref("NT-4F7K"),
    settings: ref({}),
    ...overrides,
  };
}

async function mountPage(home = makeHome()) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: V3_ROUTES.SETTINGS, component: { template: "<p />" } },
      { path: V3_ROUTES.HOUSEHOLD, component: { template: "<p />" } },
      { path: V3_ROUTES.LANDING, component: { template: "<p />" } },
    ],
  });
  router.push(V3_ROUTES.SETTINGS);
  await router.isReady();
  const wrapper = mount(SettingsPage, {
    global: { plugins: [router], provide: { [V3_HOME_KEY]: home } },
  });
  await flushPromises();
  return { wrapper, home, router };
}

const btn = (wrapper, text) => wrapper.findAll("button").find((b) => b.text() === text);
const toggle = (wrapper, id) => wrapper.get(`#${id}`);

beforeEach(() => {
  localStorage.clear();
  resetV3Display();
  for (const fn of Object.values(api)) fn.mockClear();
  api.saveSettingsPatch.mockResolvedValue(undefined);
  api.saveHouseholdBaby.mockResolvedValue(undefined);
  api.deleteAccount.mockResolvedValue(undefined);
  api.regenerateInviteCode.mockResolvedValue({ inviteCode: "NT-NEW1" });
  api.getInvite.mockResolvedValue({ code: "NT-4F7K", expiresAt: new Date(Date.now() + 6 * 86400000 + 3600000) });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

describe("V3 settings page", () => {
  it("shows the sections and no solid button at all", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.get("h1").text()).toBe("Settings");
    expect(wrapper.findAll("h2").map((h) => h.text())).toEqual([
      "Notifications",
      "Google Calendar",
      "Display",
      "Privacy",
      "Partner",
      "Household",
      "Danger zone",
    ]);
    expect(wrapper.findAll("button.btn-primary")).toHaveLength(0);
  });

  it("says push needs the server and still saves the preference", async () => {
    vi.useFakeTimers();
    const { wrapper } = await mountPage();
    expect(wrapper.text()).toContain("Push notifications need the server set up.");
    const push = toggle(wrapper, "st-push");
    expect(push.attributes("role")).toBe("switch");
    expect(push.attributes("aria-checked")).toBe("false");
    await push.trigger("click");
    expect(push.attributes("aria-checked")).toBe("true");
    expect(api.saveSettingsPatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    await flushPromises();
    expect(api.saveSettingsPatch).toHaveBeenCalledWith("u1", { "settings.notifications.push": true });
  });

  it("waits about 600 ms and writes the last value once", async () => {
    vi.useFakeTimers();
    const { wrapper } = await mountPage();
    const quiet = toggle(wrapper, "st-quiet");
    await quiet.trigger("click");
    vi.advanceTimersByTime(300);
    await toggle(wrapper, "st-quiet").trigger("click");
    vi.advanceTimersByTime(599);
    expect(api.saveSettingsPatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(api.saveSettingsPatch).toHaveBeenCalledTimes(1);
    expect(api.saveSettingsPatch).toHaveBeenCalledWith("u1", { "settings.notifications.quietHours.on": false });
  });

  it("sends two fields changed close together in one write, each with its own path", async () => {
    vi.useFakeTimers();
    const { wrapper } = await mountPage();
    await toggle(wrapper, "st-push").trigger("click");
    await toggle(wrapper, "st-lastseen").trigger("click");
    vi.advanceTimersByTime(600);
    await flushPromises();
    expect(api.saveSettingsPatch).toHaveBeenCalledTimes(1);
    expect(api.saveSettingsPatch).toHaveBeenCalledWith("u1", {
      "settings.notifications.push": true,
      "settings.privacy.shareLastSeen": false,
    });
  });

  it("shows a quiet Saved indicator in a live region, never a Save button per toggle", async () => {
    vi.useFakeTimers();
    const { wrapper } = await mountPage();
    const status = wrapper.findAll('[role="status"]')[0];
    expect(status.attributes("aria-live")).toBe("polite");
    expect(status.text()).toBe("");
    await toggle(wrapper, "st-push").trigger("click");
    vi.advanceTimersByTime(600);
    await flushPromises();
    expect(wrapper.findAll('[role="status"]')[0].text()).toBe("Saved");
    expect(wrapper.findAll("button").filter((b) => b.text() === "Save").length).toBe(0);
  });

  it("explains a rules error instead of pretending it saved", async () => {
    vi.useFakeTimers();
    api.saveSettingsPatch.mockRejectedValue({ code: "permission-denied" });
    const { wrapper } = await mountPage();
    await toggle(wrapper, "st-push").trigger("click");
    vi.advanceTimersByTime(600);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toMatch(/firestore\.rules/);
  });

  it("loads the saved settings into the controls", async () => {
    const home = makeHome();
    home.profile.value = {
      householdId: "h1",
      settings: { notifications: { push: true }, display: { timeFormat: "24h", weekStartsOn: "sun" } },
    };
    const { wrapper } = await mountPage(home);
    expect(toggle(wrapper, "st-push").attributes("aria-checked")).toBe("true");
    const chips = wrapper.findAll('[role="radiogroup"][aria-label="Time format"] [role="radio"]');
    expect(chips.map((c) => [c.text(), c.attributes("aria-checked")])).toEqual([
      ["12 hour", "false"],
      ["24 hour", "true"],
    ]);
  });

  it("applies the display choices straight away, so the calendar and the care log follow", async () => {
    vi.useFakeTimers();
    const { wrapper } = await mountPage();
    const { useV3Prefs } = await import("@/v3/composables/useV3Prefs");
    const prefs = useV3Prefs();
    expect(prefs.weekStart.value).toBe(1);
    await wrapper.findAll('[aria-label="Week starts on"] [role="radio"]')[1].trigger("click");
    expect(prefs.weekStart.value).toBe(0);
    await wrapper.findAll('[aria-label="Time format"] [role="radio"]')[1].trigger("click");
    expect(prefs.formatTime(new Date(2026, 9, 10, 21, 5))).toBe("21:05");
    vi.advanceTimersByTime(600);
    await flushPromises();
    expect(api.saveSettingsPatch).toHaveBeenCalledWith("u1", {
      "settings.display.weekStartsOn": "sun",
      "settings.display.timeFormat": "24h",
    });
  });

  it("marks the page as reduced motion when the toggle goes on", async () => {
    const { wrapper } = await mountPage();
    await toggle(wrapper, "st-motion").trigger("click");
    expect(document.documentElement.getAttribute("data-v3-motion")).toBe("reduce");
    await toggle(wrapper, "st-motion").trigger("click");
    expect(document.documentElement.getAttribute("data-v3-motion")).toBeNull();
  });
});

describe("the calendar section", () => {
  it("offers Connect and says so when the server is not there", async () => {
    api.startGoogleConnect.mockRejectedValue(Object.assign(new Error("x"), { code: "server/unreachable" }));
    const { wrapper } = await mountPage();
    await btn(wrapper, "Connect Google Calendar").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("The calendar server is not set up yet.");
  });

  it("shows the connected state and disconnects", async () => {
    vi.useFakeTimers();
    const home = makeHome();
    home.profile.value = { householdId: "h1", settings: { calendar: { connected: true } } };
    const { wrapper } = await mountPage(home);
    expect(wrapper.text()).toContain("Connected.");
    expect(btn(wrapper, "Connect Google Calendar")).toBeUndefined();
    await btn(wrapper, "Disconnect").trigger("click");
    await flushPromises();
    expect(api.disconnectGoogle).toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    await flushPromises();
    expect(api.saveSettingsPatch).toHaveBeenCalledWith("u1", { "settings.calendar.connected": false });
  });

  it("has the three sync toggles", async () => {
    const { wrapper } = await mountPage();
    expect(toggle(wrapper, "st-sync-rota").attributes("role")).toBe("switch");
    expect(toggle(wrapper, "st-sync-appts").attributes("aria-checked")).toBe("true");
    expect(toggle(wrapper, "st-sync-mine").attributes("aria-checked")).toBe("false");
  });
});

describe("the partner section", () => {
  it("shows the code and how long it lasts when nobody has joined", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.text()).toContain("NT-4F7K");
    expect(wrapper.text()).toContain("Expires in 6 days");
    expect(btn(wrapper, "Generate a new code")).toBeDefined();
  });

  it("offers a new code when the old one has expired", async () => {
    api.getInvite.mockResolvedValue({ code: "NT-4F7K", expiresAt: new Date(Date.now() - 1000) });
    const { wrapper } = await mountPage();
    expect(wrapper.text()).toContain("Expired");
    expect(wrapper.text()).toContain("This code no longer works. Make a new one.");
  });

  it("generates a new code and reloads the household", async () => {
    const { wrapper, home } = await mountPage();
    await btn(wrapper, "Generate a new code").trigger("click");
    await flushPromises();
    expect(api.regenerateInviteCode).toHaveBeenCalledWith({ uid: "u1" }, "h1", "NT-4F7K");
    expect(home.reload).toHaveBeenCalled();
    expect(wrapper.text()).toContain("New code ready. The old one no longer works.");
  });

  it("stops after three new codes in ten minutes", async () => {
    const { wrapper } = await mountPage();
    for (let i = 0; i < 3; i += 1) {
      await btn(wrapper, "Generate a new code").trigger("click");
      await flushPromises();
    }
    expect(api.regenerateInviteCode).toHaveBeenCalledTimes(3);
    await btn(wrapper, "Generate a new code").trigger("click");
    await flushPromises();
    expect(api.regenerateInviteCode).toHaveBeenCalledTimes(3);
    expect(wrapper.text()).toContain("You have done that a few times just now.");
    expect(JSON.parse(localStorage.getItem(LIMITS_KEY)).inviteRegenerate).toHaveLength(3);
  });

  it("shows the partner's name and role once somebody has joined", async () => {
    const home = makeHome();
    home.partner.value = { uid: "u2", firstName: "mei", displayName: "Mei Lin", role: "mum" };
    const { wrapper } = await mountPage(home);
    expect(wrapper.text()).toContain("Mei shares this household.");
    expect(wrapper.text()).toContain("Role: mum.");
    expect(btn(wrapper, "Generate a new code")).toBeUndefined();
  });
});

describe("the household section", () => {
  it("loads the baby details and saves a change after the debounce", async () => {
    vi.useFakeTimers();
    const { wrapper } = await mountPage();
    expect(wrapper.get("#st-baby-name").element.value).toBe("Aria");
    expect(wrapper.get("#st-baby-date").element.value).toBe("2026-09-01");
    await wrapper.get("#st-baby-name").setValue("Aria Tan");
    vi.advanceTimersByTime(600);
    await flushPromises();
    expect(api.saveHouseholdBaby).toHaveBeenCalledWith("h1", {
      babyName: "Aria Tan",
      babyStatus: "born",
      babyDate: "2026-09-01",
    });
  });

  it("changes the date label when the baby is on the way", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.text()).toContain("Date of birth");
    await wrapper.findAll('[aria-label="Baby status"] [role="radio"]')[1].trigger("click");
    expect(wrapper.text()).toContain("Due date");
  });
});

describe("leaving the household", () => {
  it("asks for the word LEAVE and warns that shared data stays", async () => {
    const { wrapper } = await mountPage();
    await btn(wrapper, "Leave household").trigger("click");
    expect(wrapper.text()).toContain("Type LEAVE to confirm");
    expect(wrapper.text()).toMatch(/stays with the household/);
    const confirm = wrapper.findAll("button").filter((b) => b.text() === "Leave household").pop();
    expect(confirm.attributes("disabled")).toBeDefined();
    await wrapper.get("#st-leave-input").setValue("leave please");
    expect(confirm.attributes("disabled")).toBeDefined();
    expect(api.leaveHousehold).not.toHaveBeenCalled();
  });

  it("leaves once the word matches, ignoring case and spaces", async () => {
    const { wrapper, router } = await mountPage();
    await btn(wrapper, "Leave household").trigger("click");
    await wrapper.get("#st-leave-input").setValue("  leave ");
    const confirm = wrapper.findAll("button").filter((b) => b.text() === "Leave household").pop();
    expect(confirm.attributes("disabled")).toBeUndefined();
    await confirm.trigger("click");
    await flushPromises();
    expect(api.leaveHousehold).toHaveBeenCalledWith("u1", "h1");
    expect(router.currentRoute.value.path).toBe(V3_ROUTES.HOUSEHOLD);
  });
});

describe("deleting the account", () => {
  async function openDelete(wrapper) {
    await btn(wrapper, "Delete my account").trigger("click");
    return wrapper.findAll("button").filter((b) => b.text() === "Delete my account").pop();
  }

  it("explains what goes and what stays, and needs the word DELETE", async () => {
    const { wrapper } = await mountPage();
    const confirm = await openDelete(wrapper);
    expect(wrapper.text()).toContain("Type DELETE to confirm");
    expect(wrapper.text()).toMatch(/private wellness check-ins go/);
    expect(wrapper.text()).toMatch(/Shared household data stays/);
    expect(wrapper.text()).toMatch(/A parent/);
    expect(confirm.attributes("disabled")).toBeDefined();
    await wrapper.get("#st-delete-input").setValue("DELET");
    expect(confirm.attributes("disabled")).toBeDefined();
    await confirm.trigger("click");
    expect(api.deleteAccount).not.toHaveBeenCalled();
  });

  it("uses the confirmation as an outline button with coral text, never a solid red one", async () => {
    const { wrapper } = await mountPage();
    const confirm = await openDelete(wrapper);
    expect(confirm.classes()).toContain("cd__danger");
    expect(wrapper.findAll("button.btn-primary")).toHaveLength(0);
  });

  it("calls the server endpoint when the word matches", async () => {
    const { wrapper, router } = await mountPage();
    const confirm = await openDelete(wrapper);
    await wrapper.get("#st-delete-input").setValue("DELETE");
    await confirm.trigger("click");
    await flushPromises();
    expect(api.deleteAccount).toHaveBeenCalled();
    expect(api.deleteAccountFallback).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe(V3_ROUTES.LANDING);
  });

  it("falls back to the browser when the server is not there, and says what it kept", async () => {
    api.deleteAccount.mockRejectedValue(Object.assign(new Error("x"), { code: "server/unreachable" }));
    const { wrapper } = await mountPage();
    const confirm = await openDelete(wrapper);
    await wrapper.get("#st-delete-input").setValue("DELETE");
    await confirm.trigger("click");
    await flushPromises();
    expect(api.deleteAccountFallback).toHaveBeenCalledWith({ uid: "u1" }, "h1");
    expect(wrapper.text()).toContain("The server is not set up yet");
    expect(wrapper.text()).toContain("the care log entries you wrote");
  });

  it("asks for a fresh sign in when Firebase refuses the deletion", async () => {
    api.deleteAccount.mockRejectedValue(Object.assign(new Error("x"), { code: "server/unreachable" }));
    api.deleteAccountFallback.mockRejectedValue({ code: "auth/requires-recent-login", kept: ["your sign in"] });
    const { wrapper } = await mountPage();
    const confirm = await openDelete(wrapper);
    await wrapper.get("#st-delete-input").setValue("DELETE");
    await confirm.trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toMatch(/sign in again/);
    expect(wrapper.text()).toContain("your sign in");
  });
});
