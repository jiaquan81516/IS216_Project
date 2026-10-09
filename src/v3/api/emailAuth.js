import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/api/firebase";

let persistencePromise;

function ensureLocalPersistence() {
  persistencePromise ??= setPersistence(auth, browserLocalPersistence);
  return persistencePromise;
}

export async function signUpWithEmail({ name, email, password }) {
  await ensureLocalPersistence();
  const result = await createUserWithEmailAndPassword(auth, String(email).trim(), password);
  const displayName = String(name || "").trim();
  if (displayName) {
    await updateProfile(result.user, { displayName });
  }
  return result.user;
}

export async function signInWithEmail({ email, password }) {
  await ensureLocalPersistence();
  const result = await signInWithEmailAndPassword(auth, String(email).trim(), password);
  return result.user;
}

const MESSAGES = {
  "auth/email-already-in-use": "That email already has an account. Try signing in instead.",
  "auth/invalid-email": "That email address does not look right. Check it and try again.",
  "auth/weak-password": "Choose a password with at least 6 characters.",
  "auth/invalid-credential": "Email or password did not match. Check both and try again.",
  "auth/user-not-found": "We could not find an account for that email. Check it or create an account.",
  "auth/wrong-password": "Email or password did not match. Check both and try again.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Could not reach the network. Check your connection and try again.",
  "auth/popup-closed-by-user": "The Google window was closed before finishing. Try again when you are ready.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/cancelled-popup-request": "Another sign in window is already open. Finish it or close it and try again.",
  "auth/operation-not-allowed": "This sign in method is not turned on yet. Try another way or ask the app owner.",
  "permission-denied": "You are signed in, but the database refused to save your profile. The app owner needs to deploy the Firestore rules.",
  "failed-precondition": "You are signed in, but the database is not set up yet. The app owner needs to create the Firestore database.",
  "not-found": "You are signed in, but the database is not set up yet. The app owner needs to create the Firestore database.",
  unavailable: "You are signed in, but the database did not answer. Check your connection, and that the Firestore database exists in the Firebase console.",
};

export function describeAuthError(error) {
  const code = error && typeof error === "object" ? error.code : undefined;
  return MESSAGES[code] || "Something went wrong. Please try again.";
}
