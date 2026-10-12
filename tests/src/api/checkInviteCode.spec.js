import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({ getDoc: vi.fn(), doc: vi.fn((...a) => ({ path: a.slice(1).join("/") })) }));

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  arrayUnion: vi.fn(),
  collection: vi.fn(),
  doc: fs.doc,
  getDoc: fs.getDoc,
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  Timestamp: { fromMillis: vi.fn() },
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
}));

import { checkInviteCode } from "@/api/profile";

const snap = (data) => ({ exists: () => data != null, data: () => data });

beforeEach(() => {
  fs.getDoc.mockReset();
  fs.doc.mockClear();
});

describe("checkInviteCode", () => {
  it("returns the household id for a valid code, normalising it, and writes nothing", async () => {
    fs.getDoc.mockResolvedValue(snap({ householdId: "h9", usedAt: null, usedBy: null, revokedAt: null }));
    const result = await checkInviteCode(" nt-ab2c ");
    expect(result).toEqual({ ok: true, householdId: "h9", message: "" });
    expect(fs.doc.mock.calls.at(-1).slice(1)).toEqual(["invites", "NT-AB2C"]);
  });

  it("says the code is missing for an empty code or an unknown code", async () => {
    const empty = await checkInviteCode("   ");
    expect(empty.ok).toBe(false);
    expect(empty.message).toMatch(/could not find that code/);
    expect(fs.getDoc).not.toHaveBeenCalled();
    fs.getDoc.mockResolvedValue(snap(null));
    const unknown = await checkInviteCode("NT-ZZZZ");
    expect(unknown).toMatchObject({ ok: false, householdId: null });
    expect(unknown.message).toMatch(/could not find that code/);
  });

  it("explains expired, used and revoked codes", async () => {
    fs.getDoc.mockResolvedValue(snap({ householdId: "h9", expiresAt: new Date(Date.now() - 1000) }));
    expect((await checkInviteCode("NT-AAAA")).message).toMatch(/expired/);
    fs.getDoc.mockResolvedValue(snap({ householdId: "h9", usedBy: "u2" }));
    expect((await checkInviteCode("NT-AAAA")).message).toMatch(/already been used/);
    fs.getDoc.mockResolvedValue(snap({ householdId: "h9", revokedAt: new Date() }));
    const revoked = await checkInviteCode("NT-AAAA");
    expect(revoked.ok).toBe(false);
    expect(revoked.message).toMatch(/was replaced/);
  });
});
