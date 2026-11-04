import process from "node:process";

export const E2E_PROJECT_ID = "demo-is216";
export const AUTH_HOST = "127.0.0.1:9099";
export const FIRESTORE_HOST = "127.0.0.1:8080";
export const E2E_BASE_URL = "http://127.0.0.1:4173";

export function assertSafeE2EEnvironment(env = process.env) {
  const projectId = env.GCLOUD_PROJECT || env.FIREBASE_PROJECT_ID || E2E_PROJECT_ID;
  const authHost = env.FIREBASE_AUTH_EMULATOR_HOST || AUTH_HOST;
  const firestoreHost = env.FIRESTORE_EMULATOR_HOST || FIRESTORE_HOST;
  const local = (value) => /^(127\.0\.0\.1|localhost):\d+$/.test(String(value || ""));
  if (projectId !== E2E_PROJECT_ID || !local(authHost) || !local(firestoreHost)) {
    throw new Error("E2E scripts only run against demo-is216 with Auth and Firestore on localhost.");
  }
  return { projectId, authHost, firestoreHost };
}

export function emulatorEnvironment(extra = {}) {
  return {
    ...process.env,
    E2E_EMULATORS: "true",
    GCLOUD_PROJECT: E2E_PROJECT_ID,
    FIREBASE_PROJECT_ID: E2E_PROJECT_ID,
    FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST,
    FIRESTORE_EMULATOR_HOST: FIRESTORE_HOST,
    ADMIN_UID: "e2e-admin",
    ...extra,
  };
}

export async function waitForUrl(url, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready at ${url}.${lastError ? ` ${lastError.message}` : ""}`);
}
