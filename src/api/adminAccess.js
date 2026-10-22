import { withTimeout } from "@/app/utils/timeout";

// Share refreshes across the route guard, sidebar and room editor. Refresh again
// on a later navigation so role changes are not cached for the whole session.
const claimChecks = new WeakMap();
const REFRESH_INTERVAL_MS = 60000;

// Use the signed Firebase token, never a role stored in an editable profile.
export async function hasAdminClaim(user) {
  if (!user?.getIdTokenResult) return false;
  try {
    let check = claimChecks.get(user);
    if (!check || Date.now() - check.at >= REFRESH_INTERVAL_MS) {
      check = {
        at: Date.now(),
        token: withTimeout(user.getIdTokenResult(true), 10000),
      };
      claimChecks.set(user, check);
    }
    const token = await check.token;
    return token.claims.admin === true;
  } catch {
    claimChecks.delete(user);
    return false;
  }
}
