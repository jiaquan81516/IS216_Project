/* global process */
// Firebase Admin, started once per serverless instance. Admin is not bound by
// firestore.rules, which is the whole point: it can anonymise an entry the author no longer
// exists to sign, and it can read the collections the rules deny to every client.
//
// The private key arrives from Vercel as one line with literal backslash n sequences in it,
// because an environment variable cannot hold a real newline, so it is put back here.
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

export const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";
export const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || "";

function privateKey() {
  return String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

export function hasAdminConfig() {
  return Boolean(PROJECT_ID && CLIENT_EMAIL && privateKey());
}

const APP_NAME = "nurturetrack-admin";

export function notConfigured() {
  const error = new Error("The server is not set up yet. See docs/setup.md.");
  error.code = "server/not-configured";
  error.status = 500;
  return error;
}

let started = null;

// Started on first use, not on import. A deploy with a missing variable then answers a clean
// "server/not-configured" from the endpoint instead of crashing before the handler runs, and
// /api/health keeps working so the user can see which variable is missing.
function appOnce() {
  if (started) return started;
  const existing = getApps().find((item) => item.name === APP_NAME);
  if (existing) {
    started = existing;
    return started;
  }
  if (!hasAdminConfig()) throw notConfigured();
  started = initializeApp(
    {
      credential: cert({ projectId: PROJECT_ID, clientEmail: CLIENT_EMAIL, privateKey: privateKey() }),
      projectId: PROJECT_ID,
    },
    APP_NAME,
  );
  return started;
}

export const app = { get current() { return appOnce(); } };

// Thin lazy stand ins, so `db.collection(...)` and `auth.verifyIdToken(...)` read the same as
// they would with the real objects while nothing is created until the first call.
function lazy(make) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        const real = make(appOnce());
        const value = real[prop];
        return typeof value === "function" ? value.bind(real) : value;
      },
    },
  );
}

export const auth = lazy(getAuth);
export const db = lazy(getFirestore);
export const messaging = lazy(getMessaging);
