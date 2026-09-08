import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  logoutUser,
  signInWithGoogle as signInWithGoogleApi,
  subscribeToAuthState,
} from "@/api/authApi";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(null);
  const initialized = ref(false);
  const actionLoading = ref(false);
  const error = ref(null);
  const isAuthenticated = computed(() => user.value !== null);
  const loading = computed(() => !initialized.value || actionLoading.value);
  let unsubscribe;
  let resolveInitialization;
  const initialization = new Promise((resolve) => {
    resolveInitialization = resolve;
  });

  function initializeAuthListener() {
    if (unsubscribe) return initialization;
    unsubscribe = subscribeToAuthState(
      (currentUser) => {
        user.value = currentUser;
        initialized.value = true;
        resolveInitialization();
      },
      (cause) => {
        error.value = cause;
        initialized.value = true;
        resolveInitialization();
      },
    );
    return initialization;
  }

  function waitForAuthInitialization() {
    initializeAuthListener();
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
    const signedInUser = await runAuthAction(signInWithGoogleApi);
    user.value = signedInUser;
    return signedInUser;
  }

  async function logout() {
    await runAuthAction(logoutUser);
    user.value = null;
  }

  return {
    user,
    loading,
    error,
    isAuthenticated,
    initializeAuthListener,
    waitForAuthInitialization,
    signInWithGoogle,
    logout,
  };
});
