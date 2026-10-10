import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  arrayUnion: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
  browserLocalPersistence: {},
  createUserWithEmailAndPassword: vi.fn(),
  setPersistence: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
}));

import { generateInviteCode, normaliseInviteCode } from "@/app/api/profile";
import { describeAuthError } from "@/app/api/emailAuth";

describe("generateInviteCode", () => {
  it("matches NT-XXXX with allowed characters only", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateInviteCode()).toMatch(/^NT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    }
  });
});

describe("normaliseInviteCode", () => {
  it("trims, uppercases and adds the prefix", () => {
    expect(normaliseInviteCode("  nt-ab2c ")).toBe("NT-AB2C");
    expect(normaliseInviteCode("ab2c")).toBe("NT-AB2C");
    expect(normaliseInviteCode("NT-AB2C")).toBe("NT-AB2C");
    expect(normaliseInviteCode("nt - ab 2c")).toBe("NT-AB2C");
  });
  it("returns an empty string for empty input", () => {
    expect(normaliseInviteCode("   ")).toBe("");
    expect(normaliseInviteCode(undefined)).toBe("");
  });
});

describe("describeAuthError", () => {
  it("maps known codes", () => {
    expect(describeAuthError({ code: "auth/email-already-in-use" })).toMatch(/signing in/);
    expect(describeAuthError({ code: "auth/weak-password" })).toMatch(/6 characters/);
    expect(describeAuthError({ code: "auth/network-request-failed" })).toMatch(/connection/);
  });
  it("falls back for unknown codes and bad input", () => {
    const fallback = "Something went wrong. Please try again.";
    expect(describeAuthError({ code: "auth/nope" })).toBe(fallback);
    expect(describeAuthError(null)).toBe(fallback);
  });
});
