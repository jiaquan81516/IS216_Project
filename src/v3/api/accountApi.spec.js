// The Firestore writes for the account layer: the profile, the settings, the household,
// leaving, deleting, the invitation expiry and the rooms directory.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  addDoc: vi.fn(async () => ({ id: "room-new" })),
  deleteDoc: vi.fn(async () => {}),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  getDocs: vi.fn(async () => ({ docs: [] })),
  onSnapshot: vi.fn(() => () => {}),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
  batch: { set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {}) },
  deleteUser: vi.fn(async () => {}),
}));

vi.mock("@/api/firebase", () => ({ default: {}, auth: { currentUser: { uid: "u1" } } }));
vi.mock("@/v3/api/db", () => ({ db: {} }));
vi.mock("firebase/auth", () => ({ deleteUser: fs.deleteUser }));
vi.mock("firebase/firestore", () => ({
  addDoc: fs.addDoc,
  arrayRemove: (...v) => ({ arrayRemove: v }),
  arrayUnion: (...v) => ({ arrayUnion: v }),
  collection: (_db, ...path) => ({ kind: "collection", path }),
  deleteDoc: fs.deleteDoc,
  doc: (first, ...path) => (path.length ? { kind: "doc", path } : { kind: "doc", path: [...(first?.path ?? []), "auto-id"] }),
  getDoc: fs.getDoc,
  getDocs: fs.getDocs,
  limit: (n) => ({ limit: n }),
  onSnapshot: fs.onSnapshot,
  orderBy: (field, direction = "asc") => ({ orderBy: field, direction }),
  query: (ref, ...parts) => ({ kind: "query", ref, parts }),
  serverTimestamp: () => "STAMP",
  setDoc: fs.setDoc,
  Timestamp: { fromMillis: (ms) => ({ ms }) },
  updateDoc: fs.updateDoc,
  writeBatch: () => fs.batch,
}));

import {
  cleanDisplayName,
  deleteAccountFallback,
  leaveHousehold,
  PROFILE_ROLES,
  saveHouseholdBaby,
  saveProfile,
  saveSettingsPatch,
} from "./account";
import { joinHousehold, regenerateInviteCode } from "./profile";
import { addRoom, reportRoom, subscribeRooms } from "./rooms";
import { INVITE_TTL_DAYS } from "./inviteHelpers";

const HID = "h1";
const ME = "u1";

beforeEach(() => {
  for (const key of ["addDoc", "deleteDoc", "setDoc", "updateDoc", "onSnapshot", "deleteUser"]) fs[key].mockClear();
  for (const key of ["set", "update", "delete", "commit"]) fs.batch[key].mockClear();
  fs.getDoc.mockResolvedValue({ exists: () => false });
  fs.getDocs.mockResolvedValue({ docs: [] });
  fs.deleteUser.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("saveProfile", () => {
  it("writes the user document and mirrors the name and role into the member document", async () => {
    await saveProfile(ME, HID, { displayName: "  Daniel  Tan ", role: "dad" });
    expect(fs.batch.update).toHaveBeenCalledTimes(1);
    expect(fs.batch.update.mock.calls[0][0].path).toEqual(["users", ME]);
    expect(fs.batch.update.mock.calls[0][1]).toEqual({ displayName: "Daniel Tan", role: "dad" });

    expect(fs.batch.set).toHaveBeenCalledTimes(1);
    const [ref, data, options] = fs.batch.set.mock.calls[0];
    expect(ref.path).toEqual(["households", HID, "members", ME]);
    expect(data).toEqual({ displayName: "Daniel Tan", role: "dad" });
    expect(options).toEqual({ merge: true });
    expect(fs.batch.commit).toHaveBeenCalledTimes(1);
  });

  it("writes only the user document when there is no household yet", async () => {
    await saveProfile(ME, "", { displayName: "Mei", role: "mum" });
    expect(fs.batch.set).not.toHaveBeenCalled();
    expect(fs.batch.update).toHaveBeenCalledTimes(1);
  });

  it("clears an unknown role rather than storing it", async () => {
    await saveProfile(ME, HID, { displayName: "Mei", role: "wizard" });
    expect(fs.batch.update.mock.calls[0][1].role).toBeNull();
  });

  it("refuses an empty name and does not write", async () => {
    await expect(saveProfile(ME, HID, { displayName: "   " })).rejects.toMatchObject({ code: "profile/no-name" });
    expect(fs.batch.commit).not.toHaveBeenCalled();
  });

  it("trims and caps the name at 40 characters", () => {
    expect(cleanDisplayName("a".repeat(60))).toHaveLength(40);
    expect(cleanDisplayName(null)).toBe("");
    expect(PROFILE_ROLES.map((r) => r.value)).toEqual(["mum", "dad", "carer"]);
  });
});

describe("saveSettingsPatch", () => {
  it("merges one nested field without touching its neighbours", async () => {
    await saveSettingsPatch(ME, { "settings.notifications.quietHours.start": "22:00" });
    const [ref, data, options] = fs.setDoc.mock.calls[0];
    expect(ref.path).toEqual(["users", ME]);
    expect(data).toEqual({ settings: { notifications: { quietHours: { start: "22:00" } } } });
    expect(options).toEqual({ merge: true });
  });
});

describe("saveHouseholdBaby", () => {
  it("writes the three fields, cleaning the date and the status", async () => {
    await saveHouseholdBaby(HID, { babyName: " Aria ", babyStatus: "nope", babyDate: "not a date" });
    expect(fs.updateDoc.mock.calls[0][0].path).toEqual(["households", HID]);
    expect(fs.updateDoc.mock.calls[0][1]).toEqual({ babyName: "Aria", babyStatus: "born", babyDate: null });
    await saveHouseholdBaby(HID, { babyName: "", babyStatus: "expected", babyDate: "2026-12-01" });
    expect(fs.updateDoc.mock.calls[1][1]).toEqual({ babyName: null, babyStatus: "expected", babyDate: "2026-12-01" });
  });
});

describe("leaveHousehold", () => {
  it("removes the member document, the uid and the pointer in one batch", async () => {
    await leaveHousehold(ME, HID);
    expect(fs.batch.delete.mock.calls[0][0].path).toEqual(["households", HID, "members", ME]);
    expect(fs.batch.update.mock.calls[0][1]).toEqual({ memberIds: { arrayRemove: [ME] } });
    expect(fs.batch.update.mock.calls[1][0].path).toEqual(["users", ME]);
    expect(fs.batch.update.mock.calls[1][1]).toMatchObject({ householdId: null });
    expect(fs.batch.commit).toHaveBeenCalled();
  });
  it("refuses when there is no household", async () => {
    await expect(leaveHousehold(ME, "")).rejects.toMatchObject({ code: "household/none" });
  });
});

describe("deleteAccountFallback", () => {
  it("removes the private data it can reach and says what it kept", async () => {
    fs.getDocs.mockResolvedValue({ docs: [{ ref: { kind: "doc", path: ["users", ME, "checkins", "2026-10-09"] } }] });
    const outcome = await deleteAccountFallback({ uid: ME }, HID);
    expect(fs.deleteDoc.mock.calls.some((c) => c[0].path?.join("/") === `users/${ME}`)).toBe(true);
    expect(fs.deleteUser).toHaveBeenCalled();
    expect(outcome.removed).toContain("your profile and settings");
    expect(outcome.removed).toContain("your sign in");
    expect(outcome.kept.join(" ")).toMatch(/care log entries/);
  });

  it("asks the user to sign in again when Firebase wants a fresh login", async () => {
    fs.deleteUser.mockRejectedValue({ code: "auth/requires-recent-login" });
    await expect(deleteAccountFallback({ uid: ME }, HID)).rejects.toMatchObject({
      code: "auth/requires-recent-login",
    });
  });

  it("refuses without a signed in user", async () => {
    await expect(deleteAccountFallback(null, HID)).rejects.toMatchObject({ code: "account/no-user" });
  });
});

describe("joinHousehold and the invitation expiry", () => {
  const invite = (data) => {
    fs.getDoc.mockImplementation(async (ref) =>
      ref.path[0] === "invites" ? { exists: () => Boolean(data), data: () => data } : { exists: () => false },
    );
  };

  it("joins with a live code and marks the invite used", async () => {
    invite({ householdId: HID, expiresAt: new Date(Date.now() + 86400000) });
    await joinHousehold({ uid: "u2", displayName: "Mei" }, "nt-ab2c");
    const used = fs.batch.update.mock.calls.find((c) => c[0].path[0] === "invites");
    expect(used[0].path).toEqual(["invites", "NT-AB2C"]);
    expect(used[1]).toEqual({ usedAt: "STAMP", usedBy: "u2" });
    expect(fs.batch.commit).toHaveBeenCalled();
  });

  it("joins with an old code that has no expiry at all", async () => {
    invite({ householdId: HID });
    await expect(joinHousehold({ uid: "u2" }, "NT-AB2C")).resolves.toEqual({ householdId: HID });
  });

  it("rejects an expired code and writes nothing", async () => {
    invite({ householdId: HID, expiresAt: new Date(Date.now() - 1000) });
    await expect(joinHousehold({ uid: "u2" }, "NT-AB2C")).rejects.toMatchObject({
      code: "invite/expired",
      message: "That code has expired. Ask your partner for a new one.",
    });
    expect(fs.batch.commit).not.toHaveBeenCalled();
  });

  it("rejects a code that has already been used", async () => {
    invite({ householdId: HID, usedAt: new Date(), usedBy: "u3" });
    await expect(joinHousehold({ uid: "u2" }, "NT-AB2C")).rejects.toMatchObject({ code: "invite/used" });
  });

  it("rejects a revoked code with the sentence that points at the new one", async () => {
    invite({ householdId: HID, revokedAt: new Date() });
    await expect(joinHousehold({ uid: "u2" }, "NT-AB2C")).rejects.toMatchObject({
      code: "invite/revoked",
      message: "That code was replaced. Ask your partner for the new one.",
    });
  });

  it("rejects a code that does not exist", async () => {
    invite(null);
    await expect(joinHousehold({ uid: "u2" }, "NT-AB2C")).rejects.toMatchObject({ code: "invite/not-found" });
  });
});

describe("regenerateInviteCode", () => {
  it("writes a new invite with an expiry, points the household at it and revokes the old one", async () => {
    const before = Date.now();
    const { inviteCode } = await regenerateInviteCode({ uid: ME }, HID, "NT-OLD1");
    expect(inviteCode).toMatch(/^NT-[A-Z2-9]{4}$/);

    const made = fs.batch.set.mock.calls[0];
    expect(made[0].path).toEqual(["invites", inviteCode]);
    expect(made[1]).toMatchObject({ householdId: HID, createdBy: ME, usedAt: null, usedBy: null, revokedAt: null });
    expect(made[1].expiresAt.ms).toBeGreaterThanOrEqual(before + INVITE_TTL_DAYS * 86400000);

    const pointed = fs.batch.update.mock.calls.find((c) => c[0].path.join("/") === `households/${HID}`);
    expect(pointed[1]).toEqual({ inviteCode });

    const revoked = fs.batch.update.mock.calls.find((c) => c[0].path.join("/") === "invites/NT-OLD1");
    expect(revoked[1]).toEqual({ revokedAt: "STAMP" });
  });

  it("does not revoke anything when there was no code before", async () => {
    await regenerateInviteCode({ uid: ME }, HID, null);
    expect(fs.batch.update.mock.calls.filter((c) => c[0].path[0] === "invites")).toHaveLength(0);
  });

  it("refuses without a household", async () => {
    await expect(regenerateInviteCode({ uid: ME }, "")).rejects.toMatchObject({ code: "invite/no-household" });
  });
});

describe("rooms api", () => {
  it("listens to the whole directory by name", () => {
    const onData = vi.fn();
    subscribeRooms(onData);
    const [q, handler] = fs.onSnapshot.mock.calls[0];
    expect(q.ref.path).toEqual(["pumpingRooms"]);
    expect(q.parts).toEqual([{ orderBy: "name", direction: "asc" }, { limit: 200 }]);
    handler({ docs: [{ id: "r1", data: () => ({ name: "A room" }) }] });
    expect(onData).toHaveBeenCalledWith([{ id: "r1", name: "A room" }]);
  });

  it("reports the error code", () => {
    const onError = vi.fn();
    subscribeRooms(vi.fn(), onError);
    fs.onSnapshot.mock.calls[0][2]({ code: "permission-denied" });
    expect(onError).toHaveBeenCalledWith({ code: "permission-denied" });
  });

  it("adds a room as unverified, with the features as a map", async () => {
    const id = await addRoom(ME, { name: "  Mall room  ", address: " 1 Road ", features: ["Chair", "Sink"] });
    expect(id).toBe("room-new");
    const [ref, data] = fs.addDoc.mock.calls[0];
    expect(ref.path).toEqual(["pumpingRooms"]);
    expect(data).toEqual({
      name: "Mall room",
      address: "1 Road",
      region: null,
      features: { chair: true, power: false, lockable: false, sink: true, stroller: false },
      status: "unverified",
      verifiedAt: null,
      lat: null,
      lng: null,
      createdBy: ME,
      createdAt: "STAMP",
    });
  });

  it("refuses a room without a name, an address or a signed in user", async () => {
    await expect(addRoom(ME, { name: "", address: "1 Road" })).rejects.toMatchObject({ code: "rooms/incomplete" });
    await expect(addRoom("", { name: "A", address: "B" })).rejects.toMatchObject({ code: "rooms/no-user" });
    expect(fs.addDoc).not.toHaveBeenCalled();
  });

  it("confirming writes a report and verifies the room in one batch", async () => {
    await reportRoom(ME, "r1", "confirm");
    const [reportRef, report] = fs.batch.set.mock.calls[0];
    expect(reportRef.path).toEqual(["pumpingRooms", "r1", "reports", "auto-id"]);
    expect(report).toEqual({ by: ME, field: "status", value: "verified", at: "STAMP" });
    const [roomRef, update] = fs.batch.update.mock.calls[0];
    expect(roomRef.path).toEqual(["pumpingRooms", "r1"]);
    expect(update).toEqual({ status: "verified", verifiedAt: "STAMP" });
    expect(fs.batch.commit).toHaveBeenCalled();
  });

  it("flagging as gone records the flag and clears the verification", async () => {
    await reportRoom(ME, "r1", "gone");
    expect(fs.batch.set.mock.calls[0][1].value).toBe("gone");
    expect(fs.batch.update.mock.calls[0][1]).toEqual({ status: "unverified", verifiedAt: null });
  });

  it("refuses a report that is neither a confirmation nor a flag", async () => {
    await expect(reportRoom(ME, "r1", "shrug")).rejects.toMatchObject({ code: "rooms/bad-report" });
    await expect(reportRoom("", "r1", "confirm")).rejects.toMatchObject({ code: "rooms/no-user" });
  });
});
