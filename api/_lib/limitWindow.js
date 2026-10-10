// The deciding half of the per uid rate limiter, kept pure so it can be unit tested. The
// storage half lives in rateLimit.js, which keeps one array of millisecond timestamps per
// action in serverLimits/{uid} and trims it on every write.

export const WINDOW_MS = 10 * 60 * 1000;

// Per action: how many calls are allowed inside the window.
export const LIMITS = Object.freeze({
  accountDelete: 3,
  googleConnect: 10,
  googleSync: 20,
});

export const LIMIT_MESSAGE = "You have done that a few times just now. Try again in a few minutes.";

// Drops the timestamps that fall outside the window and sorts what is left.
export function pruneStamps(stamps, now, windowMs = WINDOW_MS) {
  if (!Array.isArray(stamps)) return [];
  const since = now - windowMs;
  return stamps
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > since && value <= now)
    .sort((a, b) => a - b);
}

// Decides whether this call is allowed and gives back the array to store.
// Returns { allowed, stamps, retryAfterMs, remaining }.
export function decide(stamps, now, max, windowMs = WINDOW_MS) {
  const kept = pruneStamps(stamps, now, windowMs);
  if (kept.length >= max) {
    const oldest = kept[0];
    return {
      allowed: false,
      stamps: kept,
      retryAfterMs: Math.max(1000, oldest + windowMs - now),
      remaining: 0,
    };
  }
  const next = [...kept, now];
  return { allowed: true, stamps: next, retryAfterMs: 0, remaining: Math.max(0, max - next.length) };
}

// Seconds for the Retry-After header. Always at least 1.
export function retryAfterSeconds(retryAfterMs) {
  return Math.max(1, Math.ceil((Number(retryAfterMs) || 0) / 1000));
}
