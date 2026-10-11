// Pure helpers for invitation codes and their expiry. No Firebase imports.
import { toDate } from "./entryHelpers";

export const INVITE_TTL_DAYS = 7;
const DAY_MS = 86400000;

// When an invite created at `createdAt` stops working.
export function inviteExpiryMs(createdAt = Date.now(), ttlDays = INVITE_TTL_DAYS) {
  const date = toDate(createdAt);
  const base = date ? date.getTime() : Date.now();
  return base + ttlDays * DAY_MS;
}

// "valid" | "expired" | "used" | "revoked" | "missing".
// Backwards compatible on purpose: an invite with no expiresAt never expires, so codes made
// before this release keep working.
export function inviteState(invite, now = new Date()) {
  if (!invite) return "missing";
  if (invite.revokedAt) return "revoked";
  if (invite.usedAt || invite.usedBy) return "used";
  const expires = toDate(invite.expiresAt);
  if (expires && expires.getTime() <= toDate(now).getTime()) return "expired";
  return "valid";
}

const MESSAGES = Object.freeze({
  missing: "We could not find that code. Check it with your partner and try again.",
  expired: "That code has expired. Ask your partner for a new one.",
  used: "That code has already been used. Ask your partner for a new one.",
  revoked: "That code was replaced. Ask your partner for the new one.",
});

export function describeInviteState(state) {
  return MESSAGES[state] ?? "We could not use that code. Ask your partner for a new one.";
}

// The error codes joinHousehold throws, so the pages can tell the cases apart.
export const INVITE_ERROR_CODES = Object.freeze({
  missing: "invite/not-found",
  expired: "invite/expired",
  used: "invite/used",
  revoked: "invite/revoked",
});

// "Expires in 6 days", "Expires today", "Expired", or "" when there is no expiry.
export function expiresInText(expiresAt, now = new Date()) {
  const expires = toDate(expiresAt);
  if (!expires) return "";
  const nowMs = toDate(now).getTime();
  const left = expires.getTime() - nowMs;
  if (left <= 0) return "Expired";
  const days = Math.floor(left / DAY_MS);
  if (days < 1) return "Expires today";
  if (days === 1) return "Expires in 1 day";
  return `Expires in ${days} days`;
}

export function isInviteExpired(invite, now = new Date()) {
  return inviteState(invite, now) !== "valid";
}
