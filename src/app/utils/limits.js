// Rate limiting: one sliding window, used by the browser and by the Vercel functions.
//
// The browser keeps its stamps in localStorage as a courtesy guard against a stuck finger. It
// is not security, because anyone can clear their own storage. The real limit is the server's,
// api/_lib/rateLimit.js, which imports the same decide() and LIMIT_RULES from this file and
// keeps its stamps in Firestore. See docs/data-model.md, section 7.
//
// Nothing here touches the DOM at import time, so the server can load it safely.

export const LIMITS_KEY = "nt.app.limits";
export const WINDOW_MS = 10 * 60 * 1000;
const TEN_MINUTES = WINDOW_MS;

// max actions per window, per action name.
export const LIMIT_RULES = Object.freeze({
  roomReport: { max: 5, windowMs: TEN_MINUTES },
  entry: { max: 10, windowMs: TEN_MINUTES },
  inviteRegenerate: { max: 3, windowMs: TEN_MINUTES },
  accountDelete: { max: 3, windowMs: TEN_MINUTES },
  // Server only, see api/_lib/rateLimit.js.
  googleConnect: { max: 10, windowMs: TEN_MINUTES },
  googleSync: { max: 20, windowMs: TEN_MINUTES },
});

export const LIMIT_MESSAGE = "You have done that a few times just now. Try again in a few minutes.";

// Pure: the stamps still inside the window, oldest first.
export function pruneStamps(stamps, windowMs, now) {
  if (!Array.isArray(stamps)) return [];
  return stamps
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > now - windowMs && value <= now)
    .sort((a, b) => a - b);
}

// Pure: would one more action be allowed, given the stamps already inside the window?
export function decide(stamps, rule, now) {
  const kept = pruneStamps(stamps, rule.windowMs, now);
  const allowed = kept.length < rule.max;
  const oldest = kept[0] ?? now;
  return {
    allowed,
    stamps: kept,
    remaining: Math.max(0, rule.max - kept.length),
    retryAfterMs: allowed ? 0 : Math.max(0, oldest + rule.windowMs - now),
    message: allowed ? "" : LIMIT_MESSAGE,
  };
}

// Seconds for a Retry-After header. Always at least 1.
export function retryAfterSeconds(retryAfterMs) {
  return Math.max(1, Math.ceil((Number(retryAfterMs) || 0) / 1000));
}

function readAll() {
  try {
    const data = JSON.parse(localStorage.getItem(LIMITS_KEY) || "null");
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(LIMITS_KEY, JSON.stringify(data));
  } catch {
    // Storage can be blocked. The limit then only holds for this page view.
  }
}

function ruleFor(action) {
  return LIMIT_RULES[action] ?? { max: 10, windowMs: TEN_MINUTES };
}

// Read only: is one more of this action allowed right now?
export function checkLimit(action, now = Date.now()) {
  return decide(readAll()[action], ruleFor(action), now);
}

// Check and, when allowed, record the action. Returns { allowed, message, remaining }.
export function takeLimit(action, now = Date.now()) {
  const all = readAll();
  const outcome = decide(all[action], ruleFor(action), now);
  if (!outcome.allowed) return outcome;
  all[action] = [...outcome.stamps, now];
  writeAll(all);
  return { ...outcome, remaining: Math.max(0, outcome.remaining - 1) };
}

// Used by tests and by sign out, so one person's counters do not follow the next.
export function resetLimits() {
  try {
    localStorage.removeItem(LIMITS_KEY);
  } catch {
    // Nothing to do.
  }
}
