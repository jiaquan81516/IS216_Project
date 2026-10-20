import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  query,
  arrayRemove,
  writeBatch,
  limit,
  orderBy,
} from "firebase/firestore";
import { db } from "./db";
import { describeInviteState, INVITE_ERROR_CODES, inviteExpiryMs, inviteState } from "@/app/utils/inviteHelpers";
import { CAREGIVER_ROLES, caregiverPermissions, isPrimaryParent } from "@/app/utils/caregiverHelpers";

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
    accessLevel: "parent",
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(db, "invites", inviteCode), inviteDoc(householdId, user.uid));
  batch.update(doc(db, "users", user.uid), { householdId, householdIds: [householdId], onboarded: true });

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
  return { ok: true, householdId: invite.householdId ?? null, kind: invite.kind ?? "parent", message: "" };
}

export async function joinHousehold(user, code, { householdLabel = "" } = {}) {
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
  const currentMember = profile.householdId ? await getMember(profile.householdId, user.uid) : null;
  if (currentMember?.accessLevel === "caregiver" && invite.kind !== "caregiver") {
    const error = new Error("Caregiver accounts can only join households through a caregiver invitation.");
    error.code = "invite/caregiver-required";
    throw error;
  }

  const batch = writeBatch(db);
  batch.update(doc(db, "households", householdId), { memberIds: arrayUnion(user.uid) });
  batch.set(doc(db, "households", householdId, "members", user.uid), {
    displayName: profile.displayName || user.displayName || "",
    photoURL: profile.photoURL ?? user.photoURL ?? null,
    role: invite.kind === "caregiver" ? invite.caregiverRole : (profile.role ?? null),
    accessLevel: invite.kind === "caregiver" ? "caregiver" : "parent",
    inviteCode,
    ...(invite.kind === "caregiver" ? { permissions: caregiverPermissions(invite.caregiverRole, invite.permissions) } : {}),
    joinedAt: serverTimestamp(),
  });
  const userUpdates = {
    householdId,
    // arrayUnion keeps memberships already saved on the profile. Add the previous active
    // household too, so older caregiver accounts are upgraded as they join another one.
    householdIds: invite.kind === "caregiver"
      ? arrayUnion(...[profile.householdId, householdId].filter(Boolean))
      : [householdId],
    onboarded: true,
    ...(invite.kind === "caregiver" ? { role: invite.caregiverRole } : {}),
  };
  const cleanHouseholdLabel = String(householdLabel ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (cleanHouseholdLabel) userUpdates[`householdLabels.${householdId}`] = cleanHouseholdLabel;
  batch.update(doc(db, "users", user.uid), userUpdates);
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
    kind: "parent",
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
  // Revoke the old code only when this person made it and it still exists. The rules let only
  // the creator stamp revokedAt, and updating a missing document fails the whole batch, so a
  // partner (or a household from before invites existed) would otherwise never get a new code.
  let revokeOld = false;
  if (oldCode && oldCode !== inviteCode) {
    try {
      const oldSnap = await getDoc(doc(db, "invites", oldCode));
      const old = oldSnap.exists() ? oldSnap.data() : null;
      revokeOld = Boolean(old && old.createdBy === user.uid && !old.revokedAt);
    } catch {
      revokeOld = false;
    }
  }
  const batch = writeBatch(db);
  batch.set(doc(db, "invites", inviteCode), inviteDoc(householdId, user.uid));
  batch.update(doc(db, "households", householdId), { inviteCode });
  if (revokeOld) {
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
    .map(({ data, uid }) => ({
      uid,
      displayName: data.displayName ?? "",
      role: data.role ?? null,
      accessLevel: data.accessLevel ?? (isPrimaryParent(data) ? "parent" : "caregiver"),
      permissions: data.permissions ?? {},
      joinedAt: data.joinedAt ?? null,
    }));
}

export async function getMember(householdId, uid) {
  if (!householdId || !uid) return null;
  const snap = await getDoc(doc(db, "households", householdId, "members", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { uid, ...data, accessLevel: data.accessLevel ?? (isPrimaryParent(data) ? "parent" : "caregiver") };
}

export async function getCaregiverHouseholds(uid) {
  const profile = await getUserProfile(uid);
  const ids = [...new Set([...(profile?.householdIds ?? []), profile?.householdId].filter(Boolean))];
  const memberships = await Promise.all(ids.map(async (householdId) => {
    const member = await getMember(householdId, uid);
    if (member?.accessLevel !== "caregiver") return null;
    let babyName = "";
    if (member.permissions?.careBrief === true) {
      try {
        const brief = await getCareBrief(householdId, { routine: false, feeding: false, contacts: false, child: true, allergies: false, medications: false });
        babyName = String(brief.babyName ?? "").trim();
      } catch {
        // The household remains switchable when the parent has hidden the child's name.
      }
    }
    const customLabel = String(profile?.householdLabels?.[householdId] ?? "").trim();
    return {
      householdId,
      member,
      babyName,
      customLabel,
      editableLabel: customLabel || babyName,
      label: customLabel || babyName || "Caregiving household",
    };
  }));
  const activeHouseholds = memberships.filter(Boolean);
  const activeId = activeHouseholds.some((item) => item.householdId === profile?.householdId)
    ? profile.householdId
    : activeHouseholds[0]?.householdId ?? null;
  const validIds = activeHouseholds.map((item) => item.householdId);
  const activeRole = activeHouseholds.find((item) => item.householdId === activeId)?.member.role ?? profile?.role ?? null;
  if (profile && (JSON.stringify(profile.householdIds ?? []) !== JSON.stringify(validIds) || profile.householdId !== activeId || profile.role !== activeRole)) {
    await updateDoc(doc(db, "users", uid), { householdIds: validIds, householdId: activeId, role: activeRole });
  }
  const labelCounts = new Map();
  const labelOccurrences = new Map();
  activeHouseholds.forEach((item) => labelCounts.set(item.label, (labelCounts.get(item.label) ?? 0) + 1));
  return activeHouseholds.map((item) => {
    const duplicate = labelCounts.get(item.label) > 1;
    const occurrence = (labelOccurrences.get(item.label) ?? 0) + 1;
    labelOccurrences.set(item.label, occurrence);
    const label = duplicate ? `${item.label} ${occurrence}` : item.label;
    return { ...item, label, active: item.householdId === activeId };
  });
}

export async function setActiveCaregiverHousehold(uid, householdId) {
  const member = await getMember(householdId, uid);
  if (member?.accessLevel !== "caregiver") {
    const error = new Error("You no longer have access to that caregiving household.");
    error.code = "household/not-caregiver-member";
    throw error;
  }
  await updateDoc(doc(db, "users", uid), { householdId, role: member.role ?? null });
}

export async function setCaregiverHouseholdLabel(uid, householdId, label) {
  const member = await getMember(householdId, uid);
  if (member?.accessLevel !== "caregiver") {
    const error = new Error("You no longer have access to that caregiving household.");
    error.code = "household/not-caregiver-member";
    throw error;
  }
  const cleanLabel = String(label ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!cleanLabel) {
    const error = new Error("Enter a household name, such as Lee Family.");
    error.code = "household/empty-label";
    throw error;
  }
  await updateDoc(doc(db, "users", uid), { [`householdLabels.${householdId}`]: cleanLabel });
}

export async function createCaregiverInvite(uid, householdId, { name, role, permissions }) {
  if (!CAREGIVER_ROLES.some((item) => item.value === role)) {
    const error = new Error("Choose a caregiver role.");
    error.code = "caregiver/bad-role";
    throw error;
  }
  const display = String(name ?? "").trim().slice(0, 40);
  const code = await freshCode();
  const normalizedPermissions = caregiverPermissions(role, permissions);
  await setDoc(doc(db, "invites", code), {
    ...inviteDoc(householdId, uid),
    kind: "caregiver",
    caregiverName: display,
    caregiverRole: role,
    permissions: normalizedPermissions,
  });
  return { code, name: display, role, permissions: normalizedPermissions };
}

export async function listCaregiverInvites(householdId) {
  const q = query(collection(db, "invites"), where("householdId", "==", householdId), where("kind", "==", "caregiver"));
  const snap = await getDocs(q);
  return snap.docs.map((item) => ({ code: item.id, ...item.data() }));
}

export async function updateCaregiverPermissions(householdId, uid, role, permissions) {
  if (!CAREGIVER_ROLES.some((item) => item.value === role)) throw new Error("Choose a caregiver role.");
  await updateDoc(doc(db, "households", householdId, "members", uid), {
    role,
    accessLevel: "caregiver",
    permissions: caregiverPermissions(role, permissions),
  });
}

export async function removeCaregiver(householdId, uid) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "households", householdId, "members", uid));
  batch.update(doc(db, "households", householdId), { memberIds: arrayRemove(uid) });
  await batch.commit();
}

export async function revokeCaregiverInvite(code) {
  await updateDoc(doc(db, "invites", normaliseInviteCode(code)), { revokedAt: serverTimestamp() });
}

export async function saveCareBrief(householdId, brief) {
  const feeding = { feeding: String(brief?.feeding ?? "").trim().slice(0, 500) };
  const routine = { napRoutine: String(brief?.napRoutine ?? "").trim().slice(0, 500) };
  const contacts = { parentContacts: String(brief?.parentContacts ?? "").trim().slice(0, 500) };
  const allergies = { allergies: String(brief?.allergies ?? "").trim().slice(0, 500) };
  const medications = { medications: String(brief?.medications ?? "").trim().slice(0, 500) };
  const child = { babyName: String(brief?.babyName ?? "").trim().slice(0, 80) };
  await Promise.all([
    setDoc(doc(db, "households", householdId, "careBrief", "feeding"), feeding, { merge: true }),
    setDoc(doc(db, "households", householdId, "careBrief", "routine"), routine, { merge: true }),
    setDoc(doc(db, "households", householdId, "careBrief", "contacts"), contacts, { merge: true }),
    setDoc(doc(db, "households", householdId, "careBrief", "child"), child, { merge: true }),
    setDoc(doc(db, "households", householdId, "careBrief", "allergies"), allergies, { merge: true }),
    setDoc(doc(db, "households", householdId, "careBrief", "medications"), medications, { merge: true }),
  ]);
  const clean = { ...feeding, ...routine, ...contacts, ...child, ...allergies, ...medications };
  return clean;
}

export async function getCareBrief(householdId, { routine = true, feeding = true, contacts = true, child = true, allergies = true, medications = true } = {}) {
  const sections = ["routine", "feeding", "contacts", "child", "allergies", "medications"];
  const enabled = { routine, feeding, contacts, child, allergies, medications };
  const snaps = await Promise.all(sections.map((section) => enabled[section]
    ? getDocFromServer(doc(db, "households", householdId, "careBrief", section))
    : Promise.resolve(null)));
  return Object.assign({}, ...snaps.map((snap) => snap?.exists() ? snap.data() : {}));
}

export function subscribeCareBrief(householdId, options, onData, onError) {
  const { routine = true, feeding = true, contacts = true, child = true, allergies = true, medications = true } = options ?? {};
  const enabled = { routine, feeding, contacts, child, allergies, medications };
  const sections = ["routine", "feeding", "contacts", "child", "allergies", "medications"];
  const enabledSections = sections.filter((section) => enabled[section]);
  const values = Object.fromEntries(sections.map((section) => [section, {}]));
  const received = new Set();
  let active = true;
  const unsubscribes = enabledSections.map((section) => onSnapshot(
    doc(db, "households", householdId, "careBrief", section),
    (snap) => {
      values[section] = snap.exists() ? snap.data() : {};
      received.add(section);
      if (active && received.size === enabledSections.length) onData(Object.assign({}, ...Object.values(values)));
    },
    (cause) => {
      if (active) onError?.(cause);
    },
  ));
  if (active && enabledSections.length === 0) onData({});
  return () => {
    active = false;
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

export async function syncCareBriefChildName(householdId, babyName) {
  const name = String(babyName ?? "").trim().slice(0, 80);
  const ref = doc(db, "households", householdId, "careBrief", "child");
  const snap = await getDoc(ref);
  if (snap.data()?.babyName !== name) await setDoc(ref, { babyName: name }, { merge: true });
  return name;
}

export async function getRecentCareEntries(householdId, max = 100) {
  const q = query(collection(db, "households", householdId, "entries"), orderBy("at", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function getUpcomingCareAppointments(householdId, max = 10) {
  const now = new Date();
  const fromIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const q = query(
    collection(db, "households", householdId, "events"),
    where("date", ">=", fromIso),
    orderBy("date"),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function addBaby(householdId, baby = {}) {
  if (!householdId) {
    const error = new Error("You need a household before you can add a baby.");
    error.code = "baby/no-household";
    throw error;
  }
  const clean = cleanBaby(baby);
  const babyId = crypto.randomUUID();
  await setDoc(doc(db, "households", householdId, "babies", babyId), {
    ...clean,
    createdAt: serverTimestamp(),
  });
  return { babyId };
}

export async function getHouseholdBabies(householdId) {
  if (!householdId) return [];
  let household = null;
  try {
    household = await getHousehold(householdId);
  } catch {
    // Caregivers cannot read the household document. Their shared child section carries
    // the primary baby's name, while the babies collection contains the additional children.
    try {
      household = await getCareBrief(householdId, {
        routine: false, feeding: false, contacts: false, child: true, allergies: false, medications: false,
      });
    } catch {
      household = {};
    }
  }
  if (!household) household = {};
  const primary = {
    id: "primary",
    ...cleanBaby({
      babyName: household.babyName,
      babyStatus: household.babyStatus,
      babyDate: household.babyDate,
    }),
  };
  const snap = await getDocs(collection(db, "households", householdId, "babies"));
  const created = (data) => data.createdAt?.toMillis?.() ?? 0;
  const extra = snap.docs
    .map((d) => ({ id: d.id, ...cleanBaby(d.data()), createdAt: created(d.data()) }))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(({ createdAt, ...rest }) => rest);
  return [primary, ...extra];
}

export async function updateBaby(householdId, babyId, baby = {}) {
  if (!householdId || !babyId) return;
  const { babyName, babyStatus, babyDate } = cleanBaby(baby);
  if (babyId === "primary") {
    await updateDoc(doc(db, "households", householdId), { babyName, babyStatus, babyDate });
  } else {
    await updateDoc(doc(db, "households", householdId, "babies", babyId), { babyName, babyStatus, babyDate });
  }
}
