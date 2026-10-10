/* global process */
// Google OAuth and the Calendar client.
//
// What is stored, and where:
//   googleTokens/{uid}  { refreshToken, scope, connectedAt, calendarId }
//   googleSync/{uid}    { syncToken, pushed: { firestoreEventId: googleEventId }, lastSyncedAt }
//   oauthStates/{nonce} { uid, createdAt, expiresAt }
// All three are denied to every client in firestore.rules. A refresh token is a long lived
// key to somebody's calendar, so nothing in the browser ever sees it.
//
// Access tokens are never stored. The refresh token is exchanged for a fresh access token on
// each run, which costs one extra request and saves having to expire anything.
import { google } from "googleapis";
import { db } from "./admin.js";

export const SCOPES = Object.freeze([
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
]);

export const CALENDAR_NAME = "NurtureTrack";
export const CALENDAR_DESCRIPTION = "Appointments and family plans from NurtureTrack.";
export const TIME_ZONE = "Asia/Singapore";

export const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
export const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
export const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "";
export const APP_URL = (process.env.APP_URL || "").replace(/\/+$/, "");
export const STATE_SECRET = process.env.OAUTH_STATE_SECRET || "";

export function hasGoogleConfig() {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI && STATE_SECRET);
}

export function notConfigured() {
  const error = new Error("The calendar server is not set up yet. See docs/setup.md.");
  error.code = "server/not-configured";
  error.status = 500;
  return error;
}

export function oauthClient() {
  if (!hasGoogleConfig()) throw notConfigured();
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

// The consent URL. offline plus consent is what makes Google hand back a refresh token, and
// asking again every time means a user who revoked access can reconnect without having to
// clear anything by hand.
export function consentUrl(state) {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [...SCOPES],
    state,
  });
}

export const tokenRef = (uid) => db.collection("googleTokens").doc(uid);
export const syncRef = (uid) => db.collection("googleSync").doc(uid);
export const stateRef = (nonce) => db.collection("oauthStates").doc(nonce);

export async function readToken(uid) {
  const snap = await tokenRef(uid).get();
  return snap.exists ? snap.data() : null;
}

export function notConnected() {
  const error = new Error("Connect Google Calendar in Settings first.");
  error.code = "calendar/not-connected";
  error.status = 409;
  return error;
}

// An OAuth2 client signed in as the user, plus the stored record. Throws
// calendar/not-connected when there is no refresh token, and calendar/revoked when Google
// refuses the one we have, which is what happens after the user removes access in their
// Google account.
export async function authorisedClient(uid) {
  const stored = await readToken(uid);
  if (!stored?.refreshToken) throw notConnected();
  const client = oauthClient();
  client.setCredentials({ refresh_token: stored.refreshToken });

  // googleapis emits "tokens" when it rotates the refresh token. Persist it, or the next run
  // reconnects with a token Google has retired.
  client.on("tokens", (tokens) => {
    if (!tokens?.refresh_token) return;
    tokenRef(uid)
      .set({ refreshToken: tokens.refresh_token, rotatedAt: new Date() }, { merge: true })
      .catch((cause) => console.error("[google tokens]", cause?.code, cause?.message));
  });

  try {
    await client.getAccessToken();
  } catch (cause) {
    const error = new Error("Google has stopped sharing that calendar. Connect it again in Settings.");
    error.code = "calendar/revoked";
    error.status = 409;
    error.cause = cause;
    throw error;
  }
  return { client, stored };
}

export async function calendarClient(uid) {
  const { client, stored } = await authorisedClient(uid);
  return { calendar: google.calendar({ version: "v3", auth: client }), stored, client };
}

// The secondary calendar called NurtureTrack. Found by id when we already stored one, then by
// name, and created when neither turns one up. Returns the calendar id.
export async function ensureCalendar(calendar, knownId = "") {
  if (knownId) {
    try {
      const existing = await calendar.calendars.get({ calendarId: knownId });
      if (existing?.data?.id) return existing.data.id;
    } catch {
      // Deleted in Google, or never ours. Fall through and look again.
    }
  }
  let pageToken;
  do {
    const list = await calendar.calendarList.list({ maxResults: 250, pageToken, showHidden: true });
    const match = (list.data.items || []).find((item) => item.summary === CALENDAR_NAME);
    if (match?.id) return match.id;
    pageToken = list.data.nextPageToken || undefined;
  } while (pageToken);

  const created = await calendar.calendars.insert({
    requestBody: { summary: CALENDAR_NAME, description: CALENDAR_DESCRIPTION, timeZone: TIME_ZONE },
  });
  return created.data.id;
}

// Tells Google to forget the grant. A revoke that fails is logged and ignored: the stored
// token is deleted either way, so the app has no way back in.
export async function revokeToken(refreshToken) {
  if (!refreshToken) return false;
  try {
    await oauthClient().revokeToken(refreshToken);
    return true;
  } catch (cause) {
    console.error("[google revoke]", cause?.code, cause?.message);
    return false;
  }
}

// Where to send the browser after the consent screen.
export function settingsUrl(outcome) {
  const base = APP_URL || "";
  return `${base}/settings?calendar=${outcome}`;
}
