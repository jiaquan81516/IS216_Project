import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/api/firebase";

const googleProvider = new GoogleAuthProvider();

async function ensureUserProfile(user) {
  const userReference = doc(db, "users", user.uid);
  const userSnapshot = await getDoc(userReference);
  const profile = { uid: user.uid };

  if (user.displayName !== null) profile.displayName = user.displayName;
  if (user.email !== null) profile.email = user.email;
  if (user.photoURL !== null) profile.photoURL = user.photoURL;

  if (userSnapshot.exists()) {
    await setDoc(userReference, profile, { merge: true });
    return;
  }

  await setDoc(userReference, { ...profile, createdAt: serverTimestamp() });
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(result.user);
  return result.user;
}

export function logoutUser() {
  return signOut(auth);
}

export function subscribeToAuthState(callback, onError) {
  return onAuthStateChanged(auth, callback, onError);
}
