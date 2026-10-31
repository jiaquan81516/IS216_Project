import { ref } from "vue";
import { signInWithGoogle } from "@/api/authApi";
import { useAuth as useFirebaseAuth } from "@/composables/useAuth";
import { describeAuthError, signInWithEmail, signUpWithEmail } from "@/api/emailAuth";
import { ensureUserProfile, getUserProfile } from "@/api/profile";
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

  async function run(action, extraDraft = {}, { deferProfile = false } = {}) {
    busy.value = true;
    error.value = "";
    try {
      const user = await action();
      await waitForSignedIn(currentUser, user.uid);
      if (await hasAdminClaim(user)) {
        authProfile.value = null;
        return ROUTES.ADMIN;
      }
      if (deferProfile) {
        // Sign up with Google: the person is signed in, but nothing is saved about them until the
        // last setup step. A returning person who already has a profile goes on as usual.
        const existing = await withTimeout(getUserProfile(user.uid));
        if (existing) {
          authProfile.value = existing;
          return existing.householdId ? ROUTES.HOME : ROUTES.HOUSEHOLD;
        }
        if (!draft.name && user.displayName) draft.name = user.displayName;
        return ROUTES.HOUSEHOLD;
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

  function continueWithGoogle(options) {
    return run(() => signInWithGoogle(), {}, options);
  }

  // The last setup step: create the account (unless the person is already signed in, for example
  // with Google, or this is a retry) and save their profile. Throws with a code on failure.
  async function commitAccount() {
    let user = currentUser.value;
    if (!user) {
      if (!draft.hasAccount) {
        const error = new Error("Go back to the account step and enter your details again.");
        error.code = "auth/missing-details";
        throw error;
      }
      user = await signUpWithEmail({ name: draft.name, email: draft.email, password: draft.password });
      await waitForSignedIn(currentUser, user.uid);
      draft.clearAccount();
    }
    const profile = await withTimeout(ensureUserProfile(user, { name: draft.name, journey: draft.journey, role: draft.role }));
    authProfile.value = profile;
    return user;
  }

  async function loadProfile() {
    const user = currentUser.value;
    if (!user) return null;
    const { getUserProfile } = await import("@/api/profile");
    authProfile.value = await withTimeout(getUserProfile(user.uid));
    return authProfile.value;
  }

  return { busy, error, signUp, signIn, continueWithGoogle, commitAccount, authProfile, loadProfile, currentUser };
}
