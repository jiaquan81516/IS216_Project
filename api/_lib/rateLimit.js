// A per uid sliding window kept in Firestore, so it survives a cold start and cannot be
// cleared by the person it limits. One document per user, serverLimits/{uid}, with one array
// of millisecond timestamps per action, trimmed every time it is written. The rules deny all
// client access to the collection: only Admin touches it.
//
// src/app/api/limits.js keeps the same windows in the browser as a courtesy guard. This one is
// the real limit.
import { db } from "./admin.js";
import { decide, LIMIT_MESSAGE, LIMITS, retryAfterSeconds, WINDOW_MS } from "./limitWindow.js";
import { fail } from "./respond.js";

export { LIMIT_MESSAGE, LIMITS };

// Records this call and says whether it is allowed. A Firestore failure never blocks the
// user: a limiter that cannot read its own counters should not take the app down with it.
export async function takeLimit(uid, action, { now = Date.now() } = {}) {
  const max = LIMITS[action];
  if (!uid || !max) return { allowed: true, retryAfterMs: 0 };
  const ref = db.collection("serverLimits").doc(uid);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const stored = snap.exists ? snap.data() : {};
      const outcome = decide(stored?.[action], now, max, WINDOW_MS);
      tx.set(ref, { [action]: outcome.stamps, updatedAt: now }, { merge: true });
      return outcome;
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
