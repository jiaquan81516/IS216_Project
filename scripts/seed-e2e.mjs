import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { assertSafeE2EEnvironment, emulatorEnvironment, E2E_PROJECT_ID } from "./e2e-env.mjs";
import { E2E_IDS, E2E_USERS } from "./e2e-fixtures.mjs";

assertSafeE2EEnvironment(process.env);
const env = emulatorEnvironment();
Object.assign(process.env, env);
const { authHost, firestoreHost } = assertSafeE2EEnvironment(env);

const app = getApps().find((item) => item.name === "e2e-seed")
  ?? initializeApp({ projectId: E2E_PROJECT_ID }, "e2e-seed");
const auth = getAuth(app);
const db = getFirestore(app);

async function clearAuth() {
  let token;
  do {
    const page = await auth.listUsers(1000, token);
    if (page.users.length) await auth.deleteUsers(page.users.map((user) => user.uid));
    token = page.pageToken;
  } while (token);
}

async function clearFirestore() {
  const response = await fetch(`http://${firestoreHost}/emulator/v1/projects/${E2E_PROJECT_ID}/databases/(default)/documents`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`Could not reset Firestore Emulator (${response.status}).`);
}

async function createUsers() {
  for (const user of Object.values(E2E_USERS)) {
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      emailVerified: true,
    });
  }
  await auth.setCustomUserClaims(E2E_USERS.admin.uid, { admin: true });
}

const permissions = {
  careBrief: true,
  careLogRead: true,
  careLogAdd: true,
  careLogEdit: true,
  careLogMedication: true,
  feedingInstructions: true,
  allergyInfo: true,
  medicationInfo: true,
  appointments: true,
  napRoutine: true,
  dutyView: true,
  dutyEdit: true,
};

function member(displayName, accessLevel, extra = {}) {
  return { displayName, photoURL: null, accessLevel, joinedAt: Timestamp.now(), ...extra };
}

async function seedFirestore() {
  const now = Timestamp.now();
  const yesterday = Timestamp.fromMillis(Date.now() - 86_400_000);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const batch = db.batch();

  batch.set(db.doc(`users/${E2E_USERS.parent.uid}`), {
    displayName: E2E_USERS.parent.displayName,
    email: E2E_USERS.parent.email,
    role: "parent",
    journey: "newborn",
    householdId: E2E_IDS.household,
    householdIds: [E2E_IDS.household, E2E_IDS.secondHousehold],
    onboarded: true,
    createdAt: now,
  });
  batch.set(db.doc(`users/${E2E_USERS.caregiver.uid}`), {
    displayName: E2E_USERS.caregiver.displayName,
    email: E2E_USERS.caregiver.email,
    role: "grandparent",
    householdId: E2E_IDS.household,
    householdIds: [E2E_IDS.household, E2E_IDS.secondHousehold],
    householdLabels: {
      [E2E_IDS.household]: "Tan family",
      [E2E_IDS.secondHousehold]: "Lim family",
    },
    onboarded: true,
    createdAt: now,
  });

  for (const [id, babyName] of [[E2E_IDS.household, "Milo"], [E2E_IDS.secondHousehold, "Nora"]]) {
    batch.set(db.doc(`households/${id}`), {
      memberIds: [E2E_USERS.parent.uid, E2E_USERS.caregiver.uid],
      createdBy: E2E_USERS.parent.uid,
      createdAt: now,
      journey: "newborn",
      babyName,
      babyStatus: "born",
      babyDate: "2026-10-01",
      primaryBabyActive: true,
      inviteCode: id === E2E_IDS.household ? "NT-E2E00001" : "NT-E2E00002",
    });
    batch.set(db.doc(`households/${id}/members/${E2E_USERS.parent.uid}`), member(E2E_USERS.parent.displayName, "parent", { role: "parent" }));
    batch.set(db.doc(`households/${id}/members/${E2E_USERS.caregiver.uid}`), member(E2E_USERS.caregiver.displayName, "caregiver", {
      role: "grandparent",
      permissions,
    }));
    batch.set(db.doc(`households/${id}/careBrief/feeding`), { feeding: "Offer 90 ml expressed milk every three hours." });
    batch.set(db.doc(`households/${id}/careBrief/routine`), { napRoutine: "Dim the lights and use the white-noise machine." });
    batch.set(db.doc(`households/${id}/careBrief/contacts`), { parentContacts: "Pat Parent|+65 9000 0001" });
    batch.set(db.doc(`households/${id}/careBrief/child`), { babyName, active: true });
    batch.set(db.doc(`households/${id}/careBrief/allergies`), { allergies: "No known allergies." });
    batch.set(db.doc(`households/${id}/careBrief/medications`), { medications: "Vitamin D after the morning feed." });
  }

  batch.set(db.doc(`households/${E2E_IDS.household}/babies/${E2E_IDS.secondBaby}`), {
    babyName: "Zoe",
    babyStatus: "born",
    babyDate: "2026-10-15",
    active: true,
    createdAt: now,
  });
  batch.set(db.doc(`households/${E2E_IDS.household}/entries/${E2E_IDS.seededEntry}`), {
    type: "note",
    babyId: "primary",
    at: yesterday,
    endedAt: null,
    by: E2E_USERS.caregiver.uid,
    byName: E2E_USERS.caregiver.displayName,
    details: { text: "Seeded handover note" },
    seenBy: {},
    createdAt: yesterday,
  });
  batch.set(db.doc(`households/${E2E_IDS.household}/events/${E2E_IDS.seededEvent}`), {
    title: "Paediatric appointment",
    date: tomorrow,
    endDate: tomorrow,
    allDay: false,
    start: "10:00",
    end: "11:00",
    owner: "both",
    type: "appointment",
    notes: "Bring the health booklet.",
    babyIds: [],
    createdBy: E2E_USERS.parent.uid,
    createdAt: now,
    updatedAt: now,
    googleEventId: null,
  });
  batch.set(db.doc(`households/${E2E_IDS.household}/rota/settings`), {
    pattern: "manual",
    schedule: [],
    startDate: "2026-11-02",
    handoverTime: "20:00",
    manualNights: {},
    updatedAt: now,
    updatedBy: E2E_USERS.parent.uid,
  });

  batch.set(db.doc(`pumpingRooms/${E2E_IDS.pendingRoom}`), {
    name: "E2E Family Room",
    address: "81 Victoria Street, Singapore 188065",
    details: "Level 2, near the lifts",
    placeId: "e2e-place",
    lat: 1.2966,
    lng: 103.852,
    roomType: "Family room",
    feedback: "Seeded for local testing",
    features: { chair: true, power: true, lockable: true, sink: true, stroller: true },
    status: "unverified",
    verifiedAt: null,
    approval: "pending",
    createdBy: E2E_USERS.parent.uid,
    createdAt: now,
  });
  batch.set(db.doc("supportContent/guides"), { items: [], updatedBy: E2E_USERS.admin.uid, updatedAt: now });
  batch.set(db.doc("supportContent/contacts"), { items: [], updatedBy: E2E_USERS.admin.uid, updatedAt: now });
  batch.set(db.doc(`admins/${E2E_USERS.admin.uid}`), { email: E2E_USERS.admin.email, seededAt: now });

  await batch.commit();
}

export async function seedE2E() {
  // Verify both endpoints before destructive reset. These are emulator-only administrative APIs.
  const [authReady, firestoreReady] = await Promise.all([
    fetch(`http://${authHost}/`).catch(() => null),
    fetch(`http://${firestoreHost}/`).catch(() => null),
  ]);
  if (!authReady || !firestoreReady) throw new Error("Auth and Firestore emulators must be running before seeding.");
  await clearAuth();
  await clearFirestore();
  await createUsers();
  await seedFirestore();
  console.log(`Seeded isolated E2E fixtures in ${E2E_PROJECT_ID}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedE2E().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
