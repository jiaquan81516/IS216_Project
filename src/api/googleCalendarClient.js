// Google Calendar straight from the browser, with Google Identity Services (GIS). No server.
//
// The access token lives in this module's memory and nowhere else: not in localStorage, not
// in Firestore, not in a log line. It is sent only to www.googleapis.com. Closing the tab
// forgets it, and the user connects again. Scope: calendar.events and nothing broader.
import { errorOf, GoogleCalendarError, isClientModeAvailable, mapHttpError } from "@/app/utils/googleCalendarClientHelpers";

export { isClientModeAvailable };

export const GSI_URL = "https://accounts.google.com/gsi/client";
export const SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const API_BASE = "https://www.googleapis.com/calendar/v3";
export const LOAD_TIMEOUT_MS = 10000;
const CONSENT_FLAG = "nt.app.gcalClient.consented"; // a yes flag, never the token
const EXPIRY_MARGIN_MS = 60000;

let scriptPromise = null;
let tokenClient = null;
let pending = null;
let token = null;
let expiresAt = 0;

const clientId = () => String(import.meta.env?.VITE_GOOGLE_OAUTH_CLIENT_ID ?? "").trim();

function readConsent() {
  try {
    return localStorage.getItem(CONSENT_FLAG) === "1";
  } catch {
    return false;
  }
}
function writeConsent(on) {
  try {
    if (on) localStorage.setItem(CONSENT_FLAG, "1");
    else localStorage.removeItem(CONSENT_FLAG);
  } catch {
    /* a private window may refuse storage, and nothing depends on it */
  }
}

// Loads the Google script once. Resolves with window.google.accounts.oauth2.
export function loadGis() {
  if (typeof window === "undefined") return Promise.reject(errorOf("script"));
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (fn === reject) {
        script.remove();
        scriptPromise = null;
      }
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, errorOf("timeout")), LOAD_TIMEOUT_MS);
    script.src = GSI_URL;
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.oauth2 ? finish(resolve, window.google.accounts.oauth2) : finish(reject, errorOf("script"));
    script.onerror = () => finish(reject, errorOf("script"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function settle(error, value) {
  const current = pending;
  pending = null;
  if (!current) return;
  if (error) current.reject(error);
  else current.resolve(value);
}

function onTokenResponse(response) {
  if (!response || response.error || !response.access_token) {
    settle(errorOf("denied"));
    return;
  }
  const check = window.google?.accounts?.oauth2?.hasGrantedAllScopes;
  if (typeof check === "function" && !check(response, SCOPE)) {
    settle(errorOf("scope"));
    return;
  }
  token = response.access_token;
  expiresAt = Date.now() + Math.max(0, Number(response.expires_in ?? 3600) * 1000 - EXPIRY_MARGIN_MS);
  writeConsent(true);
  settle(null, true);
}

async function requestToken(prompt) {
  if (!isClientModeAvailable()) throw errorOf("config");
  const oauth2 = await loadGis();
  if (!tokenClient) {
    tokenClient = oauth2.initTokenClient({
      client_id: clientId(),
      scope: SCOPE,
      callback: onTokenResponse,
      error_callback: () => settle(errorOf("denied")),
    });
  }
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    try {
      tokenClient.requestAccessToken({ prompt });
    } catch {
      settle(errorOf("script"));
    }
  });
}

export const hasToken = () => token !== null;
export const tokenIsFresh = () => token !== null && Date.now() < expiresAt;

// A usable token, asking Google silently again when the old one has expired.
async function ensureToken() {
  if (tokenIsFresh()) return token;
  if (token === null) throw errorOf("notconnected");
  try {
    await requestToken("");
  } catch (cause) {
    token = null;
    throw cause instanceof GoogleCalendarError ? errorOf("reconnect") : cause;
  }
  return token;
}

// A tiny wrapper over fetch for the Calendar v3 API. `path` starts with "/", for example
// "/calendars/primary/events". A plain object body is sent as JSON.
export async function calendarFetch(path, init = {}) {
  if (typeof path !== "string" || !path.startsWith("/")) throw errorOf("unknown");
  const bearer = await ensureToken();
  const headers = { Accept: "application/json", ...(init.headers ?? {}), Authorization: `Bearer ${bearer}` };
  let body = init.body;
  if (body !== undefined && typeof body !== "string") {
    body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, body });
  } catch {
    throw errorOf("network");
  }
  if (!response.ok) {
    let detail = null;
    try {
      detail = await response.json();
    } catch {
      /* no JSON body */
    }
    if (response.status === 401) token = null;
    throw mapHttpError(response.status, detail);
  }
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Asks for consent the first time on this browser, and not again after that. Returns the
// calendar's summary, which for a primary calendar is the account's email address. This uses
// the events list, because the calendar.events scope does not allow reading the calendar itself.
export async function connect() {
  await requestToken(readConsent() ? "" : "consent");
  const primary = await calendarFetch("/calendars/primary/events?maxResults=1&fields=summary");
  return { email: String(primary?.summary ?? "") };
}

// Revokes the token with Google and forgets it. Always clears local state, even offline.
export async function disconnect() {
  const old = token;
  token = null;
  expiresAt = 0;
  tokenClient = null;
  pending = null;
  writeConsent(false);
  if (!old) return;
  try {
    const oauth2 = window.google?.accounts?.oauth2;
    if (oauth2?.revoke) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 4000);
        oauth2.revoke(old, () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  } catch {
    /* the token is already gone from this tab, and it expires within the hour */
  }
}

// Test helper: forgets everything in this module.
export function resetClientForTests() {
  scriptPromise = null;
  tokenClient = null;
  pending = null;
  token = null;
  expiresAt = 0;
}
