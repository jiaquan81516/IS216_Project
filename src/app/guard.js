import { useAuth, waitForAuthInitialization } from "@/composables/useAuth";
import { getMember, getUserProfile } from "@/api/profile";
import { withTimeout } from "@/app/utils/timeout";
import { ROUTES } from "@/app/routes";

// App pages that need sign in and a household (same rules as Home).
const GUARDED_APP_PATHS = new Set([
  ROUTES.HOME,
  ROUTES.CARE_LOG,
  ROUTES.ROTA,
  ROUTES.WELLNESS,
  ROUTES.SUPPORT,
  ROUTES.ROOMS,
  ROUTES.KIDS_CARE,
  ROUTES.RETURN_TO_WORK,
  ROUTES.CALENDAR,
  ROUTES.SETTINGS,
  ROUTES.PROFILE,
  ROUTES.CARE_BRIEF,
]);

// Authentication and household rules for the current app routes.
export function installGuard(router) {
  router.beforeEach(async (to) => {
    if (to.path === ROUTES.HOUSEHOLD) {
      await waitForAuthInitialization();
      const { isAuthenticated, currentUser } = useAuth();
      if (!isAuthenticated.value) return { path: ROUTES.SIGN_IN, query: to.query.code ? { code: to.query.code } : {} };
      try {
        const profile = await withTimeout(getUserProfile(currentUser.value.uid), 2500);
        if (profile?.householdId) {
          const member = await withTimeout(getMember(profile.householdId, currentUser.value.uid), 2500);
          if (member?.accessLevel === "caregiver") return ROUTES.CARE_BRIEF;
        }
      } catch {
        // Let the household page show its own recovery state if profile loading fails.
      }
      return true;
    }

    if (GUARDED_APP_PATHS.has(to.path)) {
      await waitForAuthInitialization();
      const { isAuthenticated, currentUser } = useAuth();
      if (!isAuthenticated.value) return ROUTES.SIGN_IN;
      try {
        const profile = await withTimeout(getUserProfile(currentUser.value.uid), 2500);
        if (profile && !profile.householdId) return ROUTES.HOUSEHOLD;
        if (profile?.householdId) {
          const me = await withTimeout(getMember(profile.householdId, currentUser.value.uid), 2500);
          if (!me) return ROUTES.HOUSEHOLD;
          if (me && me.accessLevel !== "parent" && to.path !== ROUTES.CARE_BRIEF) return ROUTES.CARE_BRIEF;
          if (me?.accessLevel === "parent" && to.path === ROUTES.CARE_BRIEF) return ROUTES.HOME;
        }
      } catch {
        // If the profile cannot be read, let the page load and show its own error state.
      }
      return true;
    }

    if (to.path === ROUTES.ACCOUNT || to.path === ROUTES.SIGN_IN) {
      await waitForAuthInitialization();
      const { isAuthenticated, currentUser } = useAuth();
      if (!isAuthenticated.value) return true;
      try {
        const profile = await withTimeout(getUserProfile(currentUser.value.uid), 2500);
        if (profile?.householdId) return ROUTES.HOME;
      } catch {
        // If the profile cannot be read, let the page load.
      }
    }
    return true;
  });
}
