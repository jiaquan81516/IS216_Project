// The page reads the client id once at load. Keep these tests independent of the developer's .env.
vi.hoisted(() => vi.stubEnv("VITE_GOOGLE_OAUTH_CLIENT_ID", ""));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { HOME_KEY } from "@/app/composables/useHome";
import { resetDisplay } from "@/app/composables/usePrefs";
import { ROUTES } from "@/app/routes";
import { LIMITS_KEY } from "@/app/utils/limits";

const api = vi.hoisted(() => ({
  saveSettingsPatch: vi.fn(async () => {}),
  saveHouseholdBaby: vi.fn(async () => {}),
  leaveHousehold: vi.fn(async () => {}),
  deleteAccountFallback: vi.fn(async () => ({ removed: [], kept: ["the care log entries you wrote"] })),
  regenerateInviteCode: vi.fn(async () => ({ inviteCode: "NT-NEW1" })),
  checkInviteCode: vi.fn(async () => ({ ok: true, householdId: "h2", message: "" })),
  joinHousehold: vi.fn(async () => ({ householdId: "h2" })),
  getInvite: vi.fn(async () => ({ code: "NT-4F7K", expiresAt: new Date(Date.now() + 6 * 86400000 + 3600000) })),
  deleteAccount: vi.fn(async () => {}),
  startGoogleConnect: vi.fn(async () => "/api/google/connect"),
  disconnectGoogle: vi.fn(async () => {}),
}));

vi.mock("@/api/firebase", () => ({ default: {}, auth: { currentUser: { uid: "u1", providerData: [] } } }));
vi.mock("@/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("firebase/auth", () => ({ deleteUser: vi.fn() }));
vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: { value: { uid: "u1" } } }) }));
vi.mock("@/api/account", async (importOriginal) => ({
  ...(await importOriginal()),
  saveSettingsPatch: (...a) => api.saveSettingsPatch(...a),
  saveHouseholdBaby: (...a) => api.saveHouseholdBaby(...a),
  leaveHousehold: (...a) => api.leaveHousehold(...a),
  deleteAccountFallback: (...a) => api.deleteAccountFallback(...a),
}));
vi.mock("@/api/profile", async (importOriginal) => ({
  ...(await importOriginal()),
  regenerateInviteCode: (...a) => api.regenerateInviteCode(...a),
  getInvite: (...a) => api.getInvite(...a),
  checkInviteCode: (...a) => api.checkInviteCode(...a),
  joinHousehold: (...a) => api.joinHousehold(...a),
}));
vi.mock("@/api/server", async (importOriginal) => ({
  ...(await importOriginal()),
  deleteAccount: (...a) => api.deleteAccount(...a),
  startGoogleConnect: (...a) => api.startGoogleConnect(...a),
  disconnectGoogle: (...a) => api.disconnectGoogle(...a),
}));

import SettingsPage from "@/app/pages/settings/index.vue";

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
      { path: ROUTES.SETTINGS, component: { template: "<p />" } },
      { path: ROUTES.HOUSEHOLD, component: { template: "<p />" } },
      { path: ROUTES.HOME, component: { template: "<p />" } },
      { path: ROUTES.LANDING, component: { template: "<p />" } },
    ],
  });
  router.push(ROUTES.SETTINGS);
  await router.isReady();
  const wrapper = mount(SettingsPage, {
    global: { plugins: [router], provide: { [HOME_KEY]: home } },
  });
  await flushPromises();
  return { wrapper, home, router };
}

const btn = (wrapper, text) => wrapper.findAll("button").find((b) => b.text() === text);
const toggle = (wrapper, id) => wrapper.get(`#${id}`);

beforeEach(() => {
  localStorage.clear();
  resetDisplay();
  for (const fn of Object.values(api)) fn.mockClear();
  api.saveSettingsPatch.mockResolvedValue(undefined);
  api.saveHouseholdBaby.mockResolvedValue(undefined);
  api.deleteAccount.mockResolvedValue(undefined);
  api.regenerateInviteCode.mockResolvedValue({ inviteCode: "NT-NEW1" });
  api.checkInviteCode.mockResolvedValue({ ok: true, householdId: "h2", message: "" });
  api.joinHousehold.mockResolvedValue({ householdId: "h2" });
  api.leaveHousehold.mockResolvedValue(undefined);
  api.getInvite.mockResolvedValue({ code: "NT-4F7K", expiresAt: new Date(Date.now() + 6 * 86400000 + 3600000) });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

describe("App settings page", () => {
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
    const { usePrefs } = await import("@/app/composables/usePrefs");
    const prefs = usePrefs();
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
    expect(document.documentElement.getAttribute("data-app-motion")).toBe("reduce");
    await toggle(wrapper, "st-motion").trigger("click");
    expect(document.documentElement.getAttribute("data-app-motion")).toBeNull();
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
    expect(router.currentRoute.value.path).toBe(ROUTES.HOUSEHOLD);
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
    expect(router.currentRoute.value.path).toBe(ROUTES.LANDING);
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

describe("the settings section nav", () => {
  it("scrolls to the section, focuses its heading and marks the link current", async () => {
    const { wrapper } = await mountPage();
    const scroll = vi.fn();
    const card = wrapper.get('[aria-labelledby="st-privacy"]').element;
    card.scrollIntoView = scroll;
    const link = wrapper.findAll("nav a").find((a) => a.text() === "Privacy");
    expect(link.attributes("href")).toBe("#st-privacy");
    expect(link.attributes("aria-current")).toBeUndefined();
    await link.trigger("click");
    expect(scroll).toHaveBeenCalledWith({ behavior: expect.stringMatching(/^(auto|smooth)$/), block: "start" });
    expect(link.attributes("aria-current")).toBe("true");
    expect(wrapper.findAll("nav a[aria-current]")).toHaveLength(1);
  });

  it("scrolls without animation when the person reduces motion", async () => {
    const { wrapper } = await mountPage();
    await toggle(wrapper, "st-motion").trigger("click");
    const scroll = vi.fn();
    wrapper.get('[aria-labelledby="st-cal"]').element.scrollIntoView = scroll;
    await wrapper.findAll("nav a").find((a) => a.text() === "Google Calendar").trigger("click");
    expect(scroll).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("moves focus to the heading without scrolling again", async () => {
    const { wrapper } = await mountPage();
    const heading = wrapper.get("#st-house").element;
    const focus = vi.spyOn(heading, "focus");
    wrapper.get('[aria-labelledby="st-house"]').element.scrollIntoView = vi.fn();
    await wrapper.findAll("nav a").find((a) => a.text() === "Household").trigger("click");
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});

describe("joining a partner's household from a solo household", () => {
  const openForm = async (wrapper) => {
    await wrapper.findAll("button").find((b) => b.text().startsWith("Have a code from your partner")).trigger("click");
  };
  const submit = async (wrapper, code) => {
    await wrapper.get("#st-join-code").setValue(code);
    await btn(wrapper, "Join household").trigger("click");
    await flushPromises();
  };

  it("shows the link only when nobody else has joined", async () => {
    const solo = await mountPage();
    expect(solo.wrapper.text()).toContain("Have a code from your partner? Join their household");
    const home = makeHome();
    home.partner.value = { uid: "u2", firstName: "mei", displayName: "Mei Lin", role: "mum" };
    const paired = await mountPage(home);
    expect(paired.wrapper.text()).not.toContain("Have a code from your partner");
  });

  it("opens inline with a labelled input, a warning and an outline button", async () => {
    const { wrapper } = await mountPage();
    await openForm(wrapper);
    expect(wrapper.get('label[for="st-join-code"]').text()).toBe("Invitation code");
    expect(wrapper.text()).toContain("You will leave your current household.");
    expect(btn(wrapper, "Join household").classes()).toContain("btn-outline");
    await btn(wrapper, "Cancel").trigger("click");
    expect(wrapper.find("#st-join-code").exists()).toBe(false);
  });

  it.each([
    ["missing", "We could not find that code. Check it with your partner and try again."],
    ["expired", "That code has expired. Ask your partner for a new one."],
  ])("does not leave when the code is %s", async (_name, message) => {
    api.checkInviteCode.mockResolvedValue({ ok: false, householdId: null, message });
    const { wrapper } = await mountPage();
    await openForm(wrapper);
    await submit(wrapper, "NT-ZZZZ");
    expect(wrapper.get('[role="alert"]').text()).toBe(message);
    expect(api.leaveHousehold).not.toHaveBeenCalled();
    expect(api.joinHousehold).not.toHaveBeenCalled();
  });

  it("asks for a code before doing anything", async () => {
    const { wrapper } = await mountPage();
    await openForm(wrapper);
    await submit(wrapper, "  ");
    expect(wrapper.text()).toContain("Enter the invitation code from your partner.");
    expect(api.checkInviteCode).not.toHaveBeenCalled();
  });

  it("refuses the user's own household code", async () => {
    api.checkInviteCode.mockResolvedValue({ ok: true, householdId: "h1", message: "" });
    const { wrapper } = await mountPage();
    await openForm(wrapper);
    await submit(wrapper, "NT-4F7K");
    expect(wrapper.get('[role="alert"]').text()).toBe("That is your own household code. Give it to your partner instead.");
    expect(api.leaveHousehold).not.toHaveBeenCalled();
  });

  it("leaves, then joins, then reloads and goes Home", async () => {
    const order = [];
    api.leaveHousehold.mockImplementation(async () => order.push("leave"));
    api.joinHousehold.mockImplementation(async () => order.push("join"));
    const { wrapper, home, router } = await mountPage();
    home.reload.mockImplementation(async () => order.push("reload"));
    await openForm(wrapper);
    await submit(wrapper, "nt-ab2c");
    expect(api.leaveHousehold).toHaveBeenCalledWith("u1", "h1");
    expect(api.joinHousehold).toHaveBeenCalledWith(expect.objectContaining({ uid: "u1" }), "nt-ab2c");
    expect(order).toEqual(["leave", "join", "reload"]);
    expect(router.currentRoute.value.path).toBe(ROUTES.HOME);
  });

  it("explains and routes to the household page when joining fails after leaving", async () => {
    api.joinHousehold.mockRejectedValue(new Error("boom"));
    const { wrapper, router } = await mountPage();
    await openForm(wrapper);
    await submit(wrapper, "NT-AB2C");
    expect(api.leaveHousehold).toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe(ROUTES.HOUSEHOLD);
    expect(wrapper.text()).toContain("You are not in a household right now. Enter the code again.");
  });
});
