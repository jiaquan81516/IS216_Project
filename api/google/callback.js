/* global process */
// GET /api/google/callback?code=...&state=...
//
// Google sends the browser here. There is a person looking at this request, so every ending
// is a redirect back to Settings with a short query flag rather than a JSON error:
//   ?calendar=connected   the calendar is linked
//   ?calendar=error       something went wrong, the page says so in one line
//   ?calendar=denied      the user pressed Cancel on the consent screen
//
// Order matters. The state signature is checked first, the nonce is consumed second (so a
// replay of the same link does nothing), and only then is the code exchanged.
import { db, hasAdminConfig } from "../_lib/admin.js";
import {
  calendarClient,
  ensureCalendar,
  hasGoogleConfig,
  oauthClient,
  settingsUrl,
  stateRef,
  syncRef,
  tokenRef,
} from "../_lib/google.js";
import { allowMethod, logLine } from "../_lib/respond.js";
import { decodeState } from "../_lib/state.js";

function redirect(res, outcome) {
  res.statusCode = 302;
  res.setHeader("Location", settingsUrl(outcome));
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

// Reads the nonce document and deletes it in the same transaction, so two tabs racing the
// same link cannot both win.
async function consumeNonce(nonce, uid) {
  return db.runTransaction(async (tx) => {
    const ref = stateRef(nonce);
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const data = snap.data() || {};
    tx.delete(ref);
    if (data.uid !== uid) return false;
    const expiresAt = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : Date.parse(data.expiresAt);
    return !(Number.isFinite(expiresAt) && expiresAt <= Date.now());
  });
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, "GET")) return;
  if (!hasGoogleConfig() || !hasAdminConfig()) return redirect(res, "error");

  const query = req.query || {};
  if (query.error) {
    logLine("google callback", { outcome: "denied" });
    return redirect(res, query.error === "access_denied" ? "denied" : "error");
  }
  const code = Array.isArray(query.code) ? query.code[0] : query.code;
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  if (!code || !state) return redirect(res, "error");

  let uid;
  try {
    const decoded = decodeState(state, process.env.OAUTH_STATE_SECRET);
    uid = decoded.uid;
    if (!(await consumeNonce(decoded.nonce, uid))) {
      logLine("google callback", { uid, outcome: "stale-state" });
      return redirect(res, "error");
    }
  } catch (cause) {
    console.error("[google callback state]", cause?.code, cause?.message);
    return redirect(res, "error");
  }

  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens?.refresh_token) {
      // Google only hands back a refresh token on a fresh grant. prompt=consent on the
      // connect endpoint means this should not happen, so treat it as a real failure rather
      // than storing a connection that cannot be refreshed.
      logLine("google callback", { uid, outcome: "no-refresh-token" });
      return redirect(res, "error");
    }

    await tokenRef(uid).set(
      {
        refreshToken: tokens.refresh_token,
        scope: tokens.scope || "",
        connectedAt: new Date(),
      },
      { merge: true },
    );

    const { calendar } = await calendarClient(uid);
    const calendarId = await ensureCalendar(calendar, "");
    const connectedAt = new Date();

    await tokenRef(uid).set({ calendarId }, { merge: true });
    // A fresh connection starts with no sync token, so the first sync run reads everything.
    await syncRef(uid).set({ syncToken: null, pushed: {}, lastSyncedAt: null }, { merge: true });
    await db.collection("users").doc(uid).set(
      {
        settings: {
          calendar: { connected: true, calendarId, lastSyncedAt: connectedAt },
        },
      },
      { merge: true },
    );

    logLine("google callback", { uid, outcome: "connected" });
    return redirect(res, "connected");
  } catch (cause) {
    console.error("[google callback]", cause?.code, cause?.message);
    return redirect(res, "error");
  }
}
