import { ref } from "vue";
import { signInWithGoogle } from "@/api/authApi";
import { useAuth as useFirebaseAuth } from "@/composables/useAuth";
import { describeAuthError, signInWithEmail, signUpWithEmail } from "@/api/emailAuth";
import { ensureUserProfile } from "@/api/profile";
import { hasAdminClaim } from "@/api/adminAccess";
import { withTimeout } from "@/app/utils/timeout";
import { ROUTES } from "@/app/routes";
import { useOnboarding } from "@/app/stores/onboarding";

const authProfile = ref(null);

// The router guard reads useAuth().currentUser, which is updated by Firebase's
// auth listener a moment after sign in. Wait for it so the guard does not bounce
// the user back to sign in.
async function waitForSignedIn(currentUser, uid, timeoutMs = 3000) {
  const started = Date.now();
  while (currentUser.value?.uid !== uid && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export function useAuth() {
  const { currentUser } = useFirebaseAuth();
  const draft = useOnboarding();
  const busy = ref(false);
  const error = ref("");

  async function run(action, extraDraft = {}) {
    busy.value = true;
    error.value = "";
    try {
      const user = await action();
      await waitForSignedIn(currentUser, user.uid);
      if (await hasAdminClaim(user)) {
        authProfile.value = null;
        return ROUTES.ADMIN;
      }
      const profile = await withTimeout(
        ensureUserProfile(user, {
          name: extraDraft.name || draft.name,
          journey: draft.journey,
          role: draft.role,
        }),
      );
      authProfile.value = profile;
      return profile.householdId ? ROUTES.HOME : ROUTES.HOUSEHOLD;
    } catch (cause) {
      console.error("[app auth]", cause);
      error.value = describeAuthError(cause);
      return null;
    } finally {
      busy.value = false;
    }
  }

  function signUp({ name, email, password }) {
    return run(() => signUpWithEmail({ name, email, password }), { name });
  }

  function signIn({ email, password }) {
    return run(() => signInWithEmail({ email, password }));
  }

  function continueWithGoogle() {
    return run(() => signInWithGoogle());
  }

  async function loadProfile() {
    const user = currentUser.value;
    if (!user) return null;
    const { getUserProfile } = await import("@/api/profile");
    authProfile.value = await withTimeout(getUserProfile(user.uid));
    return authProfile.value;
  }

  return { busy, error, signUp, signIn, continueWithGoogle, authProfile, loadProfile, currentUser };
}
