import { ref, watch } from "vue";
import { useAuth } from "./useAuth";
import { hasAdminClaim } from "@/api/adminAccess";

// Only trusted Firebase custom claims grant access, never the editable user profile.
export function useAdmin() {
  const { currentUser } = useAuth();
  const isAdmin = ref(false);
  watch(() => currentUser.value, async (user, _previous, onCleanup) => {
    let active = true;
    onCleanup(() => { active = false; });
    isAdmin.value = false;
    const allowed = await hasAdminClaim(user);
    if (active) isAdmin.value = allowed;
  }, { immediate: true });
  return { isAdmin };
}
