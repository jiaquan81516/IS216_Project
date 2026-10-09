import { ref } from "vue";
import { signInWithGoogle } from "@/api/authApi";
import { useAuth } from "@/composables/useAuth";
import { describeAuthError, signInWithEmail, signUpWithEmail } from "@/v3/api/emailAuth";
import { ensureUserProfile } from "@/v3/api/profile";
import { withTimeout } from "@/v3/api/timeout";
import { V3_ROUTES } from "@/v3/routes";
import { useV3Onboarding } from "@/v3/stores/onboarding";

const v3Profile = ref(null);

// The router guard reads useAuth().currentUser, which is updated by Firebase's
// auth listener a moment after sign in. Wait for it so the guard does not bounce
// the user back to sign in.
async function waitForSignedIn(currentUser, uid, timeoutMs = 3000) {
  const started = Date.now();
  while (currentUser.value?.uid !== uid && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export function useV3Auth() {
  const { currentUser } = useAuth();
  const draft = useV3Onboarding();
  const busy = ref(false);
  const error = ref("");

  async function run(action, extraDraft = {}) {
    busy.value = true;
    error.value = "";
    try {
      const user = await action();
      await waitForSignedIn(currentUser, user.uid);
      const profile = await withTimeout(
        ensureUserProfile(user, {
          name: extraDraft.name || draft.name,
          journey: draft.journey,
          role: draft.role,
        }),
      );
      v3Profile.value = profile;
      return profile.householdId ? V3_ROUTES.HOME : V3_ROUTES.HOUSEHOLD;
    } catch (cause) {
      console.error("[v3 auth]", cause);
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
    const { getUserProfile } = await import("@/v3/api/profile");
    v3Profile.value = await withTimeout(getUserProfile(user.uid));
    return v3Profile.value;
  }

  return { busy, error, signUp, signIn, continueWithGoogle, v3Profile, loadProfile, currentUser };
}
