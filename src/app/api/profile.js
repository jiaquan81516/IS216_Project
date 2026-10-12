import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./db";
import { describeInviteState, INVITE_ERROR_CODES, inviteExpiryMs, inviteState } from "./inviteHelpers";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_PREFIX = "NT-";

export function generateInviteCode() {
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `${CODE_PREFIX}${suffix}`;
}

export function normaliseInviteCode(input) {
  const cleaned = String(input ?? "").replace(/\s+/g, "").toUpperCase();
  if (!cleaned) return "";
  return cleaned.startsWith(CODE_PREFIX) ? cleaned : `${CODE_PREFIX}${cleaned}`;
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function ensureUserProfile(user, draft = {}) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const profile = {
      displayName: draft.name || user.displayName || "",
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
      journey: draft.journey || null,
      role: draft.role || null,
      householdId: null,
      onboarded: false,
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    };
    await setDoc(ref, profile);
    return profile;
  }

  const existing = snap.data();
  const updates = { lastSeenAt: serverTimestamp() };
  if (existing.journey == null && draft.journey) updates.journey = draft.journey;
  if (existing.role == null && draft.role) updates.role = draft.role;
  await updateDoc(ref, updates);
  return { ...existing, ...updates };
}

const BABY_STATUSES = ["born", "expected"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

function cleanBaby({ babyName, babyStatus, babyDate } = {}) {
  const name = typeof babyName === "string" ? babyName.trim() : "";
  const status = BABY_STATUSES.includes(babyStatus) ? babyStatus : "born";
  const date = typeof babyDate === "string" && ISO_DATE.test(babyDate) ? babyDate : null;
  return { babyName: name || null, babyStatus: status, babyDate: date };
}

// Whole days from today (local) to an ISO date. Positive means the date is in the future.
function daysUntil(isoDate, today) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - now) / DAY_MS);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function babySummary(baby = {}, today = new Date()) {
  const { babyName, babyStatus, babyDate } = cleanBaby(baby);
  let line = "";
  if (babyDate) {
    const days = daysUntil(babyDate, today);
    if (babyStatus === "born") {
      const age = -days;
      if (age < 0) line = "";
      else if (age === 0) line = "Born today";
      else if (age < 7) line = `${plural(age, "day")} old`;
      else line = `${plural(Math.floor(age / 7), "week")} old`;
    } else if (days < 0) {
      line = "Past due date";
    } else if (days === 0) {
      line = "Due today";
    } else if (days < 7) {
      line = "Due this week";
    } else {
      line = `Due in ${plural(Math.floor(days / 7), "week")}`;
    }
  }
  return { name: babyName, line };
}

export async function createHousehold(user, baby = {}) {
  const { babyName, babyStatus, babyDate } = cleanBaby(baby);
  const profile = (await getUserProfile(user.uid)) || {};

  const inviteCode = await freshCode();

  const householdRef = doc(db, "households", crypto.randomUUID());
  const householdId = householdRef.id;
  const batch = writeBatch(db);

  batch.set(householdRef, {
    memberIds: [user.uid],
    inviteCode,
    journey: profile.journey ?? null,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    babyName,
    babyStatus,
    babyDate,
  });
  batch.set(doc(db, "households", householdId, "members", user.uid), {
    displayName: profile.displayName || user.displayName || "",
    photoURL: profile.photoURL ?? user.photoURL ?? null,
    role: profile.role ?? null,
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(db, "invites", inviteCode), inviteDoc(householdId, user.uid));
  batch.update(doc(db, "users", user.uid), { householdId, onboarded: true });

  await batch.commit();
  return { householdId, inviteCode };
}

// Reads the invite and says whether it can be used, without changing anything. Lets a page
// check a code before it takes the user out of their current household.
export async function checkInviteCode(code) {
  const inviteCode = normaliseInviteCode(code);
  const inviteSnap = inviteCode ? await getDoc(doc(db, "invites", inviteCode)) : null;
  const invite = inviteSnap?.exists() ? inviteSnap.data() : null;
  const state = inviteState(invite);
  if (state !== "valid") return { ok: false, householdId: null, message: describeInviteState(state) };
  return { ok: true, householdId: invite.householdId ?? null, message: "" };
}

export async function joinHousehold(user, code) {
  const inviteCode = normaliseInviteCode(code);
  const inviteSnap = inviteCode ? await getDoc(doc(db, "invites", inviteCode)) : null;
  const invite = inviteSnap?.exists() ? inviteSnap.data() : null;
  const state = inviteState(invite);
  if (state !== "valid") {
    const error = new Error(describeInviteState(state));
    error.code = INVITE_ERROR_CODES[state] ?? INVITE_ERROR_CODES.missing;
    throw error;
  }
  const { householdId } = invite;
  const profile = (await getUserProfile(user.uid)) || {};

  const batch = writeBatch(db);
  batch.update(doc(db, "households", householdId), { memberIds: arrayUnion(user.uid) });
  batch.set(doc(db, "households", householdId, "members", user.uid), {
    displayName: profile.displayName || user.displayName || "",
    photoURL: profile.photoURL ?? user.photoURL ?? null,
    role: profile.role ?? null,
    joinedAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", user.uid), { householdId, onboarded: true });
  // Mark the code used so it cannot be shared on to a third person.
  batch.update(doc(db, "invites", inviteCode), { usedAt: serverTimestamp(), usedBy: user.uid });
  await batch.commit();
  return { householdId };
}

// A fresh invite doc. Every code made from now on carries an expiry; codes made before this
// release have no expiresAt and are treated as valid for ever (see inviteHelpers.js).
function inviteDoc(householdId, uid, now = Date.now()) {
  return {
    householdId,
    createdBy: uid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(inviteExpiryMs(now)),
    usedAt: null,
    usedBy: null,
    revokedAt: null,
  };
}

async function freshCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateInviteCode();
    const taken = await getDoc(doc(db, "invites", candidate));
    if (!taken.exists()) return candidate;
  }
  const error = new Error("Could not create an invitation code.");
  error.code = "invite/generation-failed";
  throw error;
}

// Replaces the household's code. The old invite document is marked revoked rather than
// deleted, so a partner who tries the old code gets a clear answer instead of "not found".
export async function regenerateInviteCode(user, householdId, oldCode = null) {
  if (!householdId) {
    const error = new Error("You need a household before you can make a code.");
    error.code = "invite/no-household";
    throw error;
  }
  const inviteCode = await freshCode();
  const batch = writeBatch(db);
  batch.set(doc(db, "invites", inviteCode), inviteDoc(householdId, user.uid));
  batch.update(doc(db, "households", householdId), { inviteCode });
  if (oldCode && oldCode !== inviteCode) {
    batch.update(doc(db, "invites", oldCode), { revokedAt: serverTimestamp() });
  }
  await batch.commit();
  return { inviteCode };
}

export async function getInvite(code) {
  const inviteCode = normaliseInviteCode(code);
  if (!inviteCode) return null;
  const snap = await getDoc(doc(db, "invites", inviteCode));
  return snap.exists() ? { code: inviteCode, ...snap.data() } : null;
}

export async function getHouseholdInviteCode(householdId) {
  if (!householdId) return null;
  const snap = await getDoc(doc(db, "households", householdId));
  return snap.exists() ? (snap.data().inviteCode ?? null) : null;
}

export async function getHousehold(householdId) {
  if (!householdId) return null;
  const snap = await getDoc(doc(db, "households", householdId));
  return snap.exists() ? snap.data() : null;
}

export async function getHouseholdMembers(householdId) {
  if (!householdId) return [];
  const snap = await getDocs(collection(db, "households", householdId, "members"));
  const joined = (data) => data.joinedAt?.toMillis?.() ?? 0;
  return snap.docs
    .map((d) => ({ data: d.data(), uid: d.id }))
    .sort((a, b) => joined(a.data) - joined(b.data))
    .map(({ data, uid }) => ({ uid, displayName: data.displayName ?? "", role: data.role ?? null }));
}
