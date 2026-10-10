import { describe, expect, it } from "vitest";
import {
  describeSharedError,
  ownerKey,
  ownerLabel,
  ownerUid,
  relativeTime,
  updatedLine,
} from "@/v3/api/sharedHelpers";

const ME = "uid-me";
const PARTNER = "uid-partner";

describe("ownerLabel", () => {
  it("names me, the partner and both", () => {
    expect(ownerLabel(ME, ME, "Daniel", "Mei")).toBe("Daniel");
    expect(ownerLabel(PARTNER, ME, "Daniel", "Mei")).toBe("Mei");
    expect(ownerLabel("both", ME, "Daniel", "Mei")).toBe("Both");
  });

  it("treats an unknown uid as the other parent", () => {
    expect(ownerLabel("uid-someone-else", ME, "Daniel", "Mei")).toBe("Mei");
  });

  it("has no label for nothing, and falls back without names", () => {
    expect(ownerLabel(null, ME, "Daniel", "Mei")).toBe("");
    expect(ownerLabel("", ME)).toBe("");
    expect(ownerLabel(PARTNER, ME)).toBe("Your partner");
    expect(ownerLabel(ME, ME)).toBe("Me");
    expect(ownerLabel("open", ME, "Daniel", "Mei")).toBe("Open");
  });

  it("still understands the old me and partner values", () => {
    expect(ownerLabel("me", ME, "Daniel", "Mei")).toBe("Daniel");
    expect(ownerLabel("partner", ME, "Daniel", "Mei")).toBe("Mei");
  });
});

describe("ownerKey and ownerUid", () => {
  it("maps an owner onto a styling key", () => {
    expect(ownerKey(ME, ME)).toBe("me");
    expect(ownerKey(PARTNER, ME)).toBe("partner");
    expect(ownerKey("both", ME)).toBe("both");
    expect(ownerKey("open", ME)).toBe("open");
    expect(ownerKey(null, ME)).toBeNull();
    expect(ownerKey("me", ME)).toBe("me");
    expect(ownerKey("partner", ME)).toBe("partner");
  });

  it("maps a chip choice back onto a stored value", () => {
    expect(ownerUid("me", ME, PARTNER)).toBe(ME);
    expect(ownerUid("partner", ME, PARTNER)).toBe(PARTNER);
    expect(ownerUid("both", ME, PARTNER)).toBe("both");
    expect(ownerUid("none", ME, PARTNER)).toBeNull();
    expect(ownerUid("partner", ME, "")).toBeNull();
  });
});

describe("relativeTime", () => {
  const now = new Date(2026, 9, 14, 12, 0, 0);
  const ago = (ms) => new Date(now.getTime() - ms);

  it("reads like a person wrote it", () => {
    expect(relativeTime(ago(2000), now)).toBe("just now");
    expect(relativeTime(ago(60000), now)).toBe("1 minute ago");
    expect(relativeTime(ago(5 * 60000), now)).toBe("5 minutes ago");
    expect(relativeTime(ago(70 * 60000), now)).toBe("1 hour ago");
    expect(relativeTime(ago(4 * 3600000), now)).toBe("4 hours ago");
    expect(relativeTime(new Date(2026, 9, 13, 22, 0, 0), now)).toBe("yesterday");
    expect(relativeTime(new Date(2026, 9, 2, 9, 0, 0), now)).toBe("on 2 October");
  });

  it("accepts a Firestore timestamp and handles nothing at all", () => {
    expect(relativeTime({ toDate: () => ago(5 * 60000) }, now)).toBe("5 minutes ago");
    expect(relativeTime(null, now)).toBe("");
  });
});

describe("updatedLine", () => {
  const now = new Date(2026, 9, 14, 12, 0, 0);
  it("says who saved the shared plan and when", () => {
    const record = { updatedAt: new Date(now.getTime() - 5 * 60000), updatedBy: PARTNER };
    expect(updatedLine(record, ME, "you", "Mei", now)).toBe("Updated by Mei 5 minutes ago");
    expect(updatedLine({ ...record, updatedBy: ME }, ME, "you", "Mei", now)).toBe("Updated by you 5 minutes ago");
  });

  it("is empty until something is saved", () => {
    expect(updatedLine(null, ME, "you", "Mei", now)).toBe("");
    expect(updatedLine({ updatedBy: ME }, ME, "you", "Mei", now)).toBe("");
  });
});

describe("describeSharedError", () => {
  it("names the rules file for permission-denied", () => {
    const { text } = describeSharedError("permission-denied", "sleep rota");
    expect(text).toContain("do not allow reading the sleep rota");
    expect(text).toContain("firestore.rules");
  });

  it("covers an index, a connection and an unknown code", () => {
    expect(describeSharedError("failed-precondition", "calendar").text).toContain("needs an index");
    expect(describeSharedError("unavailable", "calendar").text).toContain("Check your connection");
    expect(describeSharedError("timeout", "plan").text).toContain("Check your connection");
    const odd = describeSharedError("weird", "plan");
    expect(odd.text).toBe("We could not load the plan.");
    expect(odd.detail).toBe("Error code: weird");
  });

  it("uses no dashes", () => {
    for (const code of ["permission-denied", "failed-precondition", "unavailable", "weird"]) {
      const { text, detail } = describeSharedError(code, "plan");
      expect(`${text} ${detail}`).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
