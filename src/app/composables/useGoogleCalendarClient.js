// Shared, module level state for the browser only Google Calendar mode, so the Settings card
// and the Calendar page agree. The access token is NOT here: it stays inside
// googleCalendarClient.js. Only the toggles are remembered, in localStorage, as a per viewer
// convenience.
import { computed, reactive } from "vue";
import * as client from "@/app/api/googleCalendarClient";
import * as sync from "@/app/api/googleCalendarSync";
import { describeCounts, ERROR_TEXT } from "@/app/api/googleCalendarClientHelpers";

const PREFS_KEY = "nt.app.gcalClient.prefs";

function readPrefs() {
  const base = { rota: true, appointments: true, show: true };
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    if (raw && typeof raw === "object") {
      for (const key of Object.keys(base)) if (typeof raw[key] === "boolean") base[key] = raw[key];
    }
  } catch {
    /* storage unavailable or not JSON */
  }
  return base;
}

const state = reactive({
  connected: false,
  connecting: false,
  syncing: false,
  email: "",
  error: "",
  toggles: readPrefs(),
  lastSync: null, // { at, added, updated, removed }
  googleEvents: [],
});

function writePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(state.toggles));
  } catch {
    /* ignore */
  }
}

function fail(cause) {
  console.error("[app google client]", cause?.code ?? "unknown");
  state.error = cause?.code && ERROR_TEXT[cause.code] ? ERROR_TEXT[cause.code] : ERROR_TEXT.unknown;
  if (cause?.code === "reconnect" || cause?.code === "notconnected") {
    state.connected = false;
    state.googleEvents = [];
  }
}

export async function refreshGoogleEvents() {
  if (!state.connected || !state.toggles.show) {
    state.googleEvents = [];
    return;
  }
  try {
    state.googleEvents = await sync.fetchUpcoming();
  } catch (cause) {
    fail(cause);
  }
}

export async function connectGoogle() {
  state.error = "";
  state.connecting = true;
  try {
    const { email } = await client.connect();
    state.email = email;
    state.connected = true;
    await refreshGoogleEvents();
  } catch (cause) {
    fail(cause);
  } finally {
    state.connecting = false;
  }
}

export async function disconnectGoogle() {
  state.error = "";
  await client.disconnect();
  state.connected = false;
  state.email = "";
  state.googleEvents = [];
  state.lastSync = null;
}

export async function syncGoogleNow(ctx) {
  state.error = "";
  state.syncing = true;
  try {
    const result = await sync.runSync(ctx, { ...state.toggles });
    state.lastSync = { at: new Date(), added: result.added, updated: result.updated, removed: result.removed, wanted: result.wanted ?? null };
    await refreshGoogleEvents();
  } catch (cause) {
    fail(cause);
  } finally {
    state.syncing = false;
  }
}

export function setGoogleToggle(key, value) {
  if (!(key in state.toggles)) return;
  state.toggles[key] = Boolean(value);
  writePrefs();
  if (key === "show") refreshGoogleEvents();
}

export function resetGoogleCalendarClientState() {
  Object.assign(state, {
    connected: false,
    connecting: false,
    syncing: false,
    email: "",
    error: "",
    toggles: { rota: true, appointments: true, show: true },
    lastSync: null,
    googleEvents: [],
  });
}

export function useGoogleCalendarClient() {
  return {
    state,
    available: computed(() => client.isClientModeAvailable()),
    layerEvents: computed(() => (state.connected && state.toggles.show ? state.googleEvents : [])),
    countsText: computed(() => (state.lastSync ? describeCounts(state.lastSync) : "")),
  };
}
