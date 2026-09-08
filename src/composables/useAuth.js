import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/authStore";

export function useAuth() {
  const authStore = useAuthStore();
  const {
    user: currentUser,
    isAuthenticated,
    loading,
    error,
  } = storeToRefs(authStore);
  authStore.initializeAuthListener();

  return {
    currentUser,
    isAuthenticated,
    loading,
    error,
    signInWithGoogle: authStore.signInWithGoogle,
    logout: authStore.logout,
  };
}
