import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const E2E_PROJECT_ID = "demo-is216";
const e2eEmulators = import.meta.env.VITE_E2E_EMULATORS === "true";
const e2eProjectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || "");
const authEmulatorHost = String(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST || "");
const localHost = (value) => /^(127\.0\.0\.1|localhost):\d+$/.test(value);

if (e2eEmulators && (import.meta.env.MODE !== "e2e" || e2eProjectId !== E2E_PROJECT_ID || !localHost(authEmulatorHost))) {
  throw new Error("Unsafe Firebase E2E configuration. Use mode=e2e, project demo-is216 and local emulator hosts.");
}

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const productionConfig = {
  apiKey: "AIzaSyA2afMg2p_8RNPkOdnyuv86t8DJqup5oUo",
  authDomain: "is216-821c0.firebaseapp.com",
  projectId: "is216-821c0",
  storageBucket: "is216-821c0.firebasestorage.app",
  messagingSenderId: "566876046099",
  appId: "1:566876046099:web:d1b2d222cad1774a7f10e6",
  measurementId: "G-VPJCPYW094",
};

const firebaseConfig = e2eEmulators
  ? {
      apiKey: "demo-is216-api-key",
      authDomain: `${E2E_PROJECT_ID}.firebaseapp.com`,
      projectId: E2E_PROJECT_ID,
      storageBucket: `${E2E_PROJECT_ID}.appspot.com`,
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:e2e000000000000000000",
    }
  : productionConfig;

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
if (e2eEmulators) connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });

export const firebaseE2E = Object.freeze({
  enabled: e2eEmulators,
  projectId: firebaseConfig.projectId,
  firestoreHost: String(import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || ""),
});

export default app;
