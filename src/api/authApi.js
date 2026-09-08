import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "@/api/firebase";

const googleProvider = new GoogleAuthProvider();
let persistencePromise;

function ensureLocalPersistence() {
  persistencePromise ??= setPersistence(auth, browserLocalPersistence);
  return persistencePromise;
}

export async function signInWithGoogle() {
  await ensureLocalPersistence();
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export function logoutUser() {
  return signOut(auth);
}

export function subscribeToAuthState(callback, onError) {
  return onAuthStateChanged(auth, callback, onError);
}
