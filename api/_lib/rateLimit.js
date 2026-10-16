// A per uid sliding window kept in Firestore, so it survives a cold start and cannot be
// cleared by the person it limits. One document per user, serverLimits/{uid}, with one array
// of millisecond timestamps per action, trimmed every time it is written. The rules deny all
// client access to the collection: only Admin touches it.
//
// The window logic and the limits live in src/app/utils/limits.js, which the browser also uses
// as a courtesy guard. This one is the real limit.
import { db } from "./admin.js";
import { decide, LIMIT_MESSAGE, LIMIT_RULES, retryAfterSeconds } from "../../src/app/utils/limits.js";
import { fail } from "./respond.js";

export { LIMIT_MESSAGE, LIMIT_RULES };

// Records this call and says whether it is allowed. A Firestore failure never blocks the
// user: a limiter that cannot read its own counters should not take the app down with it.
export async function takeLimit(uid, action, { now = Date.now() } = {}) {
  const rule = LIMIT_RULES[action];
  if (!uid || !rule) return { allowed: true, retryAfterMs: 0 };
  const ref = db.collection("serverLimits").doc(uid);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const stored = snap.exists ? snap.data() : {};
      const outcome = decide(stored?.[action], rule, now);
      const stamps = outcome.allowed ? [...outcome.stamps, now] : outcome.stamps;
      tx.set(ref, { [action]: stamps, updatedAt: now }, { merge: true });
      return { ...outcome, retryAfterMs: outcome.allowed ? 0 : Math.max(1000, outcome.retryAfterMs) };
    });
  } catch (cause) {
    console.error("[rate limit]", action, cause?.code, cause?.message);
    return { allowed: true, retryAfterMs: 0 };
  }
}

// Answers 429 and returns false when the caller is over the limit.
export async function guardLimit(res, uid, action) {
  const outcome = await takeLimit(uid, action);
  if (outcome.allowed) return true;
  res.setHeader("Retry-After", String(retryAfterSeconds(outcome.retryAfterMs)));
  fail(res, 429, "server/too-many", LIMIT_MESSAGE);
  return false;
}
