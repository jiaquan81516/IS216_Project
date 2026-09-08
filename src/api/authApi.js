import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "@/api/firebase";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export function logoutUser() {
  return signOut(auth);
}

export function subscribeToAuthState(callback, onError) {
  return onAuthStateChanged(auth, callback, onError);
}
