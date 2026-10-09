import { ref } from "vue";
import { useAuth } from "@/composables/useAuth";
import { ROUTES } from "@/shared/constants/routes";

// Shared "Continue with Google" behaviour for sign up, sign in, join and the hand-off screen.
// Message shown inline on the page the parent came from when Google does not finish.
export const googleError = ref("");

let attempt = 0;
let pending = null;

function messageFor(error) {
  if (error?.code === "auth/popup-blocked") {
    return "Your browser blocked the Google window. Allow pop-ups for this site and try again.";
  }
  if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") {
    return "The Google window was closed before sign in finished. Try again when you are ready.";
  }
  return "We could not sign you in with Google. Try again in a moment.";
}

export function destinationFor(household) {
  return () => (household.onboarded ? ROUTES.HOME : ROUTES.SETUP_ABOUT);
}

async function run() {
  const { router, origin, onSuccess } = pending;
  const id = ++attempt;
  googleError.value = "";
  // signInWithGoogle must be called synchronously from the click handler so the popup is allowed.
  const request = useAuth().signInWithGoogle();
  if (router.currentRoute.value.path !== ROUTES.GOOGLE) router.push(ROUTES.GOOGLE);
  try {
    await request;
    if (id === attempt) await router.push(await onSuccess());
  } catch (error) {
    if (id !== attempt) return;
    googleError.value = messageFor(error);
    router.push(origin);
  }
}

// Call straight from a click handler. onSuccess returns the route to open once signed in.
export function startGoogleSignIn({ router, origin, onSuccess }) {
  pending = { router, origin, onSuccess };
  return run();
}

// "Window not showing? Open Google again".
export function retryGoogleSignIn({ router, household }) {
  pending = pending || { router, origin: ROUTES.SIGN_UP, onSuccess: destinationFor(household) };
  pending.router = router;
  return run();
}

// Ignore any sign in still in flight and go back to sign up.
export function cancelGoogleSignIn(router) {
  attempt += 1;
  googleError.value = "";
  return router.push(ROUTES.SIGN_UP);
}
