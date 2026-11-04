import { describe, it, expect } from "vitest";
import {
  INVITE_TTL_DAYS, inviteExpiryMs, inviteState, describeInviteState, INVITE_ERROR_CODES, expiresInText,
} from "@/app/utils/inviteHelpers";

describe("INVITE_TTL_DAYS", () => {
  it("is 7 days", () => expect(INVITE_TTL_DAYS).toBe(7));
});

describe("inviteExpiryMs", () => {
  it("adds ttlDays (default 7) worth of ms to createdAt", () => {
    const created = new Date(2026, 0, 1).getTime();
    expect(inviteExpiryMs(created)).toBe(created + 7 * 86400000);
  });

  it("respects a custom ttlDays", () => {
    const created = new Date(2026, 0, 1).getTime();
    expect(inviteExpiryMs(created, 1)).toBe(created + 86400000);
  });

  it("falls back to Date.now() when createdAt is unusable", () => {
    const before = Date.now();
    const result = inviteExpiryMs(null, 0);
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});

describe("inviteState", () => {
  const now = new Date(2026, 10, 4);

  it("is 'missing' for a falsy invite", () => {
    expect(inviteState(null, now)).toBe("missing");
    expect(inviteState(undefined, now)).toBe("missing");
  });

  it("is 'revoked' when revokedAt is set, even if also used/expired", () => {
    expect(inviteState({ revokedAt: new Date() }, now)).toBe("revoked");
  });

  it("is 'used' when usedAt or usedBy is set", () => {
    expect(inviteState({ usedAt: new Date() }, now)).toBe("used");
    expect(inviteState({ usedBy: "uid1" }, now)).toBe("used");
  });

  it("is 'expired' once expiresAt has passed (inclusive of the exact instant)", () => {
    expect(inviteState({ expiresAt: new Date(2026, 10, 3) }, now)).toBe("expired");
    expect(inviteState({ expiresAt: now }, now)).toBe("expired");
  });

  it("is 'valid' before expiresAt", () => {
    expect(inviteState({ expiresAt: new Date(2026, 10, 5) }, now)).toBe("valid");
  });

  it("is 'valid' forever when there is no expiresAt at all (back-compat for old codes)", () => {
    expect(inviteState({}, now)).toBe("valid");
  });

  it("checks revoked/used before expiry", () => {
    expect(inviteState({ revokedAt: new Date(), expiresAt: new Date(2030, 0, 1) }, now)).toBe("revoked");
    expect(inviteState({ usedAt: new Date(), expiresAt: new Date(2030, 0, 1) }, now)).toBe("used");
  });
});

describe("describeInviteState", () => {
  it("has a specific message for each known state", () => {
    expect(describeInviteState("missing")).toMatch(/could not find/i);
    expect(describeInviteState("expired")).toMatch(/expired/i);
    expect(describeInviteState("used")).toMatch(/already been used/i);
    expect(describeInviteState("revoked")).toMatch(/replaced/i);
  });

  it("falls back to a generic message for 'valid' or an unknown state", () => {
    expect(describeInviteState("valid")).toMatch(/could not use/i);
    expect(describeInviteState("something-else")).toMatch(/could not use/i);
  });
});

describe("INVITE_ERROR_CODES", () => {
  it("is frozen and covers missing/expired/used/revoked", () => {
    expect(Object.isFrozen(INVITE_ERROR_CODES)).toBe(true);
    expect(Object.keys(INVITE_ERROR_CODES).sort()).toEqual(["expired", "missing", "revoked", "used"]);
  });
});

describe("expiresInText", () => {
  const now = new Date(2026, 10, 4, 12, 0);

  it("returns '' when there is no expiry", () => {
    expect(expiresInText(null, now)).toBe("");
    expect(expiresInText(undefined, now)).toBe("");
  });

  it("says 'Expired' once past expiry", () => {
    expect(expiresInText(new Date(2026, 10, 3), now)).toBe("Expired");
    expect(expiresInText(now, now)).toBe("Expired");
  });

  it("says 'Expires today' for anything under 24h away", () => {
    expect(expiresInText(new Date(2026, 10, 4, 23, 59), now)).toBe("Expires today");
  });

  it("says 'Expires in 1 day' for 1-2 days away", () => {
    expect(expiresInText(new Date(2026, 10, 5, 13, 0), now)).toBe("Expires in 1 day");
  });

  it("says 'Expires in N days' further out", () => {
    expect(expiresInText(new Date(2026, 10, 10, 12, 0), now)).toBe("Expires in 6 days");
  });
});
