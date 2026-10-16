/* global process */
// GET /api/health
// Says whether each group of environment variables is present, and never what is in them.
// The quickest way to tell a Vercel project that is missing a variable from one that is
// simply broken. See docs/setup.md, "How to verify it works".
import { allowMethod, sendJson } from "./_lib/respond.js";

const GROUPS = Object.freeze({
  firebaseAdmin: ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"],
  webPush: ["VITE_FIREBASE_VAPID_KEY"],
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  oauthState: ["OAUTH_STATE_SECRET"],
  app: ["APP_URL"],
});

function present(name) {
  return Boolean(String(process.env[name] || "").trim());
}

export default function handler(req, res) {
  if (!allowMethod(req, res, ["GET", "HEAD"])) return;
  const env = {};
  const missing = [];
  for (const [group, names] of Object.entries(GROUPS)) {
    const have = names.filter(present);
    env[group] = have.length === names.length;
    for (const name of names) if (!present(name)) missing.push(name);
  }
  sendJson(res, 200, {
    ok: true,
    time: new Date().toISOString(),
    env,
    missing,
    notes: {
      push: "Web push needs firebaseAdmin and webPush to be true. The Google and app groups are only for the Google Calendar server flow.",
    },
  });
}
