import { describe, expect, it } from "vitest";
import {
  describeInviteState,
  expiresInText,
  INVITE_ERROR_CODES,
  INVITE_TTL_DAYS,
  inviteExpiryMs,
  inviteState,
  isInviteExpired,
} from "@/app/api/inviteHelpers";

const DAY = 86400000;
const NOW = new Date("2026-10-10T09:00:00Z");

describe("inviteExpiryMs", () => {
  it("is seven days after creation", () => {
    expect(INVITE_TTL_DAYS).toBe(7);
    expect(inviteExpiryMs(NOW.getTime())).toBe(NOW.getTime() + 7 * DAY);
    expect(inviteExpiryMs(NOW)).toBe(NOW.getTime() + 7 * DAY);
  });
});

describe("inviteState", () => {
  const valid = { expiresAt: new Date(NOW.getTime() + DAY) };
  it("reads a live code as valid", () => {
    expect(inviteState(valid, NOW)).toBe("valid");
    expect(isInviteExpired(valid, NOW)).toBe(false);
  });
  it("treats a missing expiry as valid, so old codes keep working", () => {
    expect(inviteState({ householdId: "h1" }, NOW)).toBe("valid");
  });
  it("reads an expired code, including one that expired this instant", () => {
    expect(inviteState({ expiresAt: new Date(NOW.getTime() - 1) }, NOW)).toBe("expired");
    expect(inviteState({ expiresAt: NOW }, NOW)).toBe("expired");
  });
  it("reads a used code and a revoked one before the expiry", () => {
    expect(inviteState({ ...valid, usedAt: NOW }, NOW)).toBe("used");
    expect(inviteState({ ...valid, usedBy: "u2" }, NOW)).toBe("used");
    expect(inviteState({ ...valid, revokedAt: NOW }, NOW)).toBe("revoked");
    expect(inviteState({ expiresAt: new Date(0), revokedAt: NOW }, NOW)).toBe("revoked");
  });
  it("reads nothing as missing", () => {
    expect(inviteState(null, NOW)).toBe("missing");
  });
});

describe("describeInviteState", () => {
  it("tells the partner what to do", () => {
    expect(describeInviteState("expired")).toBe("That code has expired. Ask your partner for a new one.");
    expect(describeInviteState("used")).toMatch(/already been used/);
    expect(describeInviteState("revoked")).toMatch(/was replaced/);
    expect(describeInviteState("missing")).toMatch(/could not find/);
    expect(describeInviteState("nonsense")).toMatch(/new one/);
  });
  it("has one error code per state", () => {
    expect(INVITE_ERROR_CODES).toEqual({
      missing: "invite/not-found",
      expired: "invite/expired",
      used: "invite/used",
      revoked: "invite/revoked",
    });
  });
});

describe("expiresInText", () => {
  it("counts whole days left", () => {
    expect(expiresInText(new Date(NOW.getTime() + 6 * DAY + 3600000), NOW)).toBe("Expires in 6 days");
    expect(expiresInText(new Date(NOW.getTime() + 2 * DAY), NOW)).toBe("Expires in 2 days");
    expect(expiresInText(new Date(NOW.getTime() + DAY), NOW)).toBe("Expires in 1 day");
    expect(expiresInText(new Date(NOW.getTime() + 3600000), NOW)).toBe("Expires today");
  });
  it("says Expired once the moment has passed, and nothing with no expiry", () => {
    expect(expiresInText(new Date(NOW.getTime() - 1), NOW)).toBe("Expired");
    expect(expiresInText(null, NOW)).toBe("");
  });
});
