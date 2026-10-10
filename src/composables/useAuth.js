import { computed, ref } from "vue";
import {
  logoutUser,
  signInWithGoogle as signInWithGoogleApi,
  subscribeToAuthState,
} from "@/api/authApi";

const currentUser = ref(null);
const initializing = ref(true);
const actionLoading = ref(false);
const error = ref(null);
const isAuthenticated = computed(() => currentUser.value !== null);
const loading = computed(() => initializing.value || actionLoading.value);

let unsubscribe;
let resolveInitialization;
const initialization = new Promise((resolve) => {
  resolveInitialization = resolve;
});

function initializeAuth() {
  if (unsubscribe) return initialization;

  unsubscribe = subscribeToAuthState(
    (user) => {
      currentUser.value = user;
      initializing.value = false;
      resolveInitialization();
    },
    (cause) => {
      error.value = cause;
      initializing.value = false;
      resolveInitialization();
    },
  );

  return initialization;
}

async function runAuthAction(action) {
  actionLoading.value = true;
  error.value = null;

  try {
    return await action();
  } catch (cause) {
    error.value = cause;
    throw cause;
  } finally {
    actionLoading.value = false;
  }
}

async function signInWithGoogle() {
  currentUser.value = await runAuthAction(signInWithGoogleApi);
  return currentUser.value;
}

async function logout() {
  await runAuthAction(logoutUser);
  currentUser.value = null;
}

export function waitForAuthInitialization() {
  return initializeAuth();
}

export function useAuth() {
  initializeAuth();

  return {
    currentUser,
    loading,
    error,
    isAuthenticated,
    signInWithGoogle,
    logout,
  };
}
