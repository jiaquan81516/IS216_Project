/* global process */
// GET /api/google/connect
//
// Two ways in, one behaviour:
//   fetch (Accept: application/json) answers { url } and the page navigates there itself,
//   a top level navigation is answered with a 302 to the same URL.
// The second one is why the ID token is accepted as a `token` query parameter: a browser
// cannot put an Authorization header on a navigation. The token is still verified; it is
// never trusted because it arrived in a query.
//
// The `state` carries the uid and a nonce, signed with OAUTH_STATE_SECRET and good for five
// minutes. The nonce is also written to oauthStates/{nonce} and consumed exactly once by the
// callback, so a state value cannot be replayed even while the signature is still valid.
import { hasAdminConfig, notConfigured } from "../_lib/admin.js";
import { requireUser } from "../_lib/auth.js";
import { consentUrl, hasGoogleConfig, notConfigured as googleNotConfigured, stateRef } from "../_lib/google.js";
import { guardLimit } from "../_lib/rateLimit.js";
import { allowMethod, fail, logLine, sendJson } from "../_lib/respond.js";
import { encodeState, newNonce, STATE_TTL_MS } from "../_lib/state.js";

function wantsJson(req) {
  const accept = String(req.headers?.accept || "");
  if (String(req.query?.mode || "") === "json") return true;
  if (accept.includes("text/html")) return false;
  return accept.includes("application/json") || accept === "*/*" || accept === "";
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, "GET")) return;
  if (!hasAdminConfig()) {
    const error = notConfigured();
    return fail(res, 500, error.code, error.message);
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (error) {
    return fail(res, 401, error.code || "auth/invalid-token", error.message);
  }

  if (!hasGoogleConfig()) {
    const error = googleNotConfigured();
    return fail(res, 500, error.code, error.message);
  }
  if (!(await guardLimit(res, user.uid, "googleConnect"))) return;

  try {
    const nonce = newNonce();
    const now = Date.now();
    await stateRef(nonce).set({
      uid: user.uid,
      createdAt: new Date(now),
      expiresAt: new Date(now + STATE_TTL_MS),
    });
    const url = consentUrl(encodeState({ uid: user.uid, nonce }, process.env.OAUTH_STATE_SECRET, { now }));
    logLine("google connect", { uid: user.uid });
    if (wantsJson(req)) return sendJson(res, 200, { ok: true, url });
    res.statusCode = 302;
    res.setHeader("Location", url);
    res.setHeader("Cache-Control", "no-store");
    return res.end();
  } catch (cause) {
    console.error("[google connect]", cause?.code, cause?.message);
    return fail(res, 500, cause?.code || "calendar/connect-failed", "We could not start the Google sign in. Try again.");
  }
}
