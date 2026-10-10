import { useAuth, waitForAuthInitialization } from "@/composables/useAuth";
import { getUserProfile } from "@/v3/api/profile";
import { withTimeout } from "@/v3/api/timeout";
import { V3_ROUTES } from "@/v3/routes";

// App pages that need sign in and a household (same rules as Home).
const GUARDED_APP_PATHS = new Set([
  V3_ROUTES.HOME,
  V3_ROUTES.CARE_LOG,
  V3_ROUTES.HANDOVER,
  V3_ROUTES.ROTA,
  V3_ROUTES.WELLNESS,
  V3_ROUTES.SUPPORT,
  V3_ROUTES.RETURN_TO_WORK,
  V3_ROUTES.CALENDAR,
  V3_ROUTES.SETTINGS,
  V3_ROUTES.PROFILE,
]);

// Authentication and household rules for the current app routes.
export function installV3Guard(router) {
  router.beforeEach(async (to) => {
    if (to.path === V3_ROUTES.HOUSEHOLD) {
      await waitForAuthInitialization();
      const { isAuthenticated } = useAuth();
      if (!isAuthenticated.value) return V3_ROUTES.SIGN_IN;
      return true;
    }

    if (GUARDED_APP_PATHS.has(to.path)) {
      await waitForAuthInitialization();
      const { isAuthenticated, currentUser } = useAuth();
      if (!isAuthenticated.value) return V3_ROUTES.SIGN_IN;
      try {
        const profile = await withTimeout(getUserProfile(currentUser.value.uid), 2500);
        if (profile && !profile.householdId) return V3_ROUTES.HOUSEHOLD;
      } catch {
        // If the profile cannot be read, let the page load and show its own error state.
      }
      return true;
    }

    if (to.path === V3_ROUTES.ACCOUNT || to.path === V3_ROUTES.SIGN_IN) {
      await waitForAuthInitialization();
      const { isAuthenticated, currentUser } = useAuth();
      if (!isAuthenticated.value) return true;
      try {
        const profile = await withTimeout(getUserProfile(currentUser.value.uid), 2500);
        if (profile?.householdId) return V3_ROUTES.HOME;
      } catch {
        // If the profile cannot be read, let the page load.
      }
    }
    return true;
  });
}
