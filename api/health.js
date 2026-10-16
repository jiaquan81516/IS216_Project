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

const first = (error) => String(error?.message || error).split("\n")[0].slice(0, 200);

// GET /api/health?deep=1 also loads the server files and starts the Admin SDK, and says
// which step fails and why. A Vercel function that crashes on load only shows
// FUNCTION_INVOCATION_FAILED, so this is the way to see the reason without the log page.
// It reports the first line of the error message, never a variable's value.
async function deepCheck() {
  const out = {};
  const files = {
    admin: () => import("./_lib/admin.js"),
    auth: () => import("./_lib/auth.js"),
    rateLimit: () => import("./_lib/rateLimit.js"),
    pushHelpers: () => import("./_lib/push.js"),
    notify: () => import("./push/notify.js"),
  };
  for (const [name, load] of Object.entries(files)) {
    try {
      await load();
      out[name] = "ok";
    } catch (error) {
      out[name] = `load failed: ${first(error)}`;
    }
  }
  try {
    const admin = await import("./_lib/admin.js");
    admin.app.current;
    out.adminStart = "ok";
    out.adminProjectId = admin.PROJECT_ID; // public, and it must match the web app's project id
    out.messaging = typeof admin.messaging.sendEachForMulticast === "function" ? "ok" : "missing";
    // Can the server reach Firestore with this service account? A read, nothing is written.
    try {
      await admin.db.collection("serverLimits").doc("health-check").get();
      out.firestore = "ok";
    } catch (error) {
      out.firestore = `failed: ${error?.code || ""} ${first(error)}`.trim();
    }
    // Can it reach Firebase Cloud Messaging? A dry run with a made up token delivers nothing.
    // FCM rejecting the fake token as invalid is the good answer: it means the credentials and
    // the FCM API both worked. Anything else names what is wrong (for example the API is off).
    try {
      await admin.messaging.send({ token: "nurturetrack-health-check", data: { check: "1" } }, true);
      out.fcm = "ok";
    } catch (error) {
      const code = error?.code || "";
      const reached = ["messaging/invalid-argument", "messaging/invalid-registration-token", "messaging/registration-token-not-registered"];
      out.fcm = reached.includes(code) ? "ok (FCM reached, the test token was rejected as expected)" : `failed: ${code} ${first(error)}`.trim();
    }
  } catch (error) {
    out.adminStart = `failed: ${first(error)}`;
  }
  return out;
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ["GET", "HEAD"])) return;
  const env = {};
  const missing = [];
  for (const [group, names] of Object.entries(GROUPS)) {
    const have = names.filter(present);
    env[group] = have.length === names.length;
    for (const name of names) if (!present(name)) missing.push(name);
  }
  const deep = req?.query?.deep === "1" ? { deep: await deepCheck() } : {};
  sendJson(res, 200, {
    ok: true,
    time: new Date().toISOString(),
    env,
    missing,
    ...deep,
    notes: {
      push: "Web push needs firebaseAdmin and webPush to be true. The Google and app groups are only for the Google Calendar server flow.",
    },
  });
}
