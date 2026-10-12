// Light client side rate limiting. A sliding window per action, kept in localStorage.
//
// This is a courtesy guard, not security: anyone can clear their own storage. It exists so
// a stuck finger or an over eager tester does not write fifty reports in a minute. The real
// limits belong on the server (see docs/data-model.md, section 7).

export const LIMITS_KEY = "nt.app.limits";
const TEN_MINUTES = 10 * 60 * 1000;

// max actions per window, per action name.
export const LIMIT_RULES = Object.freeze({
  roomReport: { max: 5, windowMs: TEN_MINUTES },
  entry: { max: 10, windowMs: TEN_MINUTES },
  inviteRegenerate: { max: 3, windowMs: TEN_MINUTES },
  accountDelete: { max: 3, windowMs: TEN_MINUTES },
});

export const LIMIT_MESSAGE = "You have done that a few times just now. Try again in a few minutes.";

// Pure: the stamps still inside the window, oldest first.
export function pruneStamps(stamps, windowMs, now) {
  if (!Array.isArray(stamps)) return [];
  return stamps
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
