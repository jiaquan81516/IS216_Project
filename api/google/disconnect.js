// POST /api/google/disconnect
// Tells Google to forget the grant, removes the stored refresh token and the sync state, and
// turns the Settings switch off. Idempotent: disconnecting something that is already gone
// answers 200.
import { db, hasAdminConfig, notConfigured } from "../_lib/admin.js";
import { requireUser } from "../_lib/auth.js";
import { readToken, revokeToken, syncRef, tokenRef } from "../_lib/google.js";
import { allowMethod, fail, logLine, ok } from "../_lib/respond.js";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  if (!hasAdminConfig()) {
    const error = notConfigured();
    return fail(res, 500, error.code, error.message);
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (error) {
    return fail(res, 401, error.code || "auth/invalid-token", error.message);
  }

  try {
    const stored = await readToken(user.uid);
    const revoked = await revokeToken(stored?.refreshToken);
    await tokenRef(user.uid).delete();
    await syncRef(user.uid).delete();
    await db.collection("users").doc(user.uid).set(
      { settings: { calendar: { connected: false, calendarId: null, lastSyncedAt: null } } },
      { merge: true },
    );
    logLine("google disconnect", { uid: user.uid, revoked });
    return ok(res, { revoked });
  } catch (cause) {
    console.error("[google disconnect]", cause?.code, cause?.message);
    return fail(res, 500, cause?.code || "calendar/disconnect-failed", "We could not disconnect the calendar. Try again.");
  }
}
