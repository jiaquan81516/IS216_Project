// Writes for the account and household management layer: the profile, the settings, the
// household's baby details, leaving a household and the client side fallback for account
// deletion. The real deletion runs on the server (see docs/account-deletion.md).
import { deleteUser } from "firebase/auth";
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { auth } from "@/api/firebase";
import { db } from "./db";
import { isSafePhotoUrl } from "@/app/utils/photoHelpers";

export const DISPLAY_NAME_MAX = 40;
export const PROFILE_ROLES = Object.freeze([
  { value: "mum", label: "Mum" },
  { value: "dad", label: "Dad" },
  { value: "carer", label: "Carer" },
]);

export function cleanDisplayName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, DISPLAY_NAME_MAX);
}

export function isProfileRole(value) {
  return PROFILE_ROLES.some((role) => role.value === value);
}

// Saves the profile and mirrors the two shared fields into the member document, so the
// partner sees the new name without reading the private user document. One batch, so the
// two copies can never disagree.
export async function saveProfile(uid, householdId, { displayName, role }) {
  const name = cleanDisplayName(displayName);
  if (!name) {
    const error = new Error("Enter the name your partner will see.");
    error.code = "profile/no-name";
    throw error;
  }
  const nextRole = isProfileRole(role) ? role : null;
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), { displayName: name, role: nextRole });
  if (householdId) {
    batch.set(
      doc(db, "households", householdId, "members", uid),
      { displayName: name, role: nextRole },
      { merge: true },
    );
  }
  await batch.commit();
  return { displayName: name, role: nextRole };
}

// Saves or clears the profile photo. The picture is a small JPEG data URL kept in the profile and
// mirrored into your member document in every household you belong to, so your partner sees it
// without reading the private user document. One batch, so the copies can never disagree. Pass
// null to remove the photo. Households you are not a member of are skipped, because the rules do
// not let a member document be created from here.
export async function savePhoto(uid, householdIds, photoURL) {
  if (photoURL !== null && !isSafePhotoUrl(photoURL)) {
    const error = new Error("That photo cannot be saved. Try a different one.");
    error.code = "photo/invalid";
    throw error;
  }
  const ids = [...new Set((householdIds ?? []).filter(Boolean))];
  const members = await Promise.all(ids.map((id) => getDoc(doc(db, "households", id, "members", uid))));
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), { photoURL });
  for (const member of members) if (member.exists()) batch.update(member.ref, { photoURL });
  await batch.commit();
  return photoURL;
}

// One settings field at a time, written with a dotted path so two sections saved close
// together never overwrite each other. `patch` comes from settingsPatch().
export function saveSettingsPatch(uid, patch) {
  return setDoc(doc(db, "users", uid), unflatten(patch), { merge: true });
}

// setDoc with merge needs nested objects, updateDoc takes dotted paths. The settings
// document may not exist yet on an older account, so we merge and build the nesting here.
function unflatten(patch) {
  const out = {};
  for (const [path, value] of Object.entries(patch)) {
    const parts = path.split(".");
    let node = out;
    for (let i = 0; i < parts.length - 1; i += 1) {
      node[parts[i]] ??= {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
  return out;
}

// Leaving removes you from the household and clears your own pointer to it. Everything you
// logged stays with the household, because the other parent still needs it.
export async function leaveHousehold(uid, householdId, nextHouseholdId = null) {
  if (!householdId) {
    const error = new Error("You are not in a household.");
    error.code = "household/none";
    throw error;
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, "households", householdId, "members", uid));
  batch.update(doc(db, "households", householdId), { memberIds: arrayRemove(uid) });
  batch.update(doc(db, "users", uid), {
    householdId: nextHouseholdId && nextHouseholdId !== householdId ? nextHouseholdId : null,
    householdIds: arrayRemove(householdId),
    leftHouseholdAt: serverTimestamp(),
  });
  await batch.commit();
}

async function deleteSubcollection(uid, name) {
  const snap = await getDocs(collection(db, "users", uid, name));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.docs.length;
}

// Best effort deletion from the browser, used only when /api/account/delete is not there.
// It can remove what the signed in user is allowed to remove, which is their own user
// document, their private check-ins, their device tokens and their member document. It
// cannot anonymise the shared household entries, because the rules only let the author of
// an entry change it and there is no way to rewrite them all safely from here. The caller
// must say so in the UI; `kept` names what was left behind.
export async function deleteAccountFallback(user, householdId) {
  const uid = user?.uid;
  if (!uid) {
    const error = new Error("Sign in again to delete your account.");
    error.code = "account/no-user";
    throw error;
  }
  const removed = [];
  const kept = [];

  try {
    const checkins = await deleteSubcollection(uid, "checkins");
    removed.push(checkins === 1 ? "1 private check-in" : `${checkins} private check-ins`);
  } catch {
    kept.push("your private check-ins");
  }
  try {
    await deleteSubcollection(uid, "devices");
    removed.push("your saved devices");
  } catch {
    kept.push("your saved devices");
  }
  let householdIds = [householdId].filter(Boolean);
  try {
    const profile = await getDoc(doc(db, "users", uid));
    if (profile.exists()) householdIds = [...new Set([...(profile.data()?.householdIds ?? []), profile.data()?.householdId, ...householdIds].filter(Boolean))];
  } catch {
    // The current household argument is still useful when the profile cannot be read.
  }
  let leftHouseholds = 0;
  for (const id of householdIds) {
    try {
      await leaveHousehold(uid, id);
      leftHouseholds += 1;
    } catch {
      // Continue so one stale membership does not prevent removing other memberships.
    }
  }
  if (leftHouseholds) removed.push(leftHouseholds === 1 ? "your place in one household" : `your place in ${leftHouseholds} households`);
  if (leftHouseholds < householdIds.length) kept.push("one or more household memberships");
  kept.push('the care log entries you wrote, which stay with the household and will still show your name rather than "A parent"');
  try {
    await deleteDoc(doc(db, "users", uid));
    removed.push("your profile and settings");
  } catch {
    kept.push("your profile and settings");
  }

  try {
    await deleteUser(auth.currentUser ?? user);
    removed.push("your sign in");
  } catch (cause) {
    if (cause?.code === "auth/requires-recent-login") {
      const error = new Error("For your safety, sign in again and then delete your account.");
      error.code = "auth/requires-recent-login";
      error.removed = removed;
      error.kept = kept;
      throw error;
    }
    const error = new Error("We removed your data but could not remove the sign in itself.");
    error.code = cause?.code ?? "account/signin-kept";
    error.removed = removed;
    error.kept = [...kept, "your sign in"];
    throw error;
  }

  return { removed, kept };
}
