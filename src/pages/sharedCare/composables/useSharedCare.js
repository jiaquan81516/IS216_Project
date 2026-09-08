import { ref } from "vue";
import {
  addCaregiverToGroup,
  getCareGroupsForUser,
  removeCaregiverFromGroup,
} from "@/api/sharedCareApi";
import { useAuth } from "@/composables/useAuth";

export function useSharedCare() {
  const { currentUser } = useAuth();
  const careGroups = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function loadCareGroups() {
    loading.value = true;
    error.value = null;
    try {
      careGroups.value = await getCareGroupsForUser(currentUser.value?.uid);
    } catch (cause) {
      error.value = cause;
      throw cause;
    } finally {
      loading.value = false;
    }
  }

  return {
    careGroups,
    loading,
    error,
    loadCareGroups,
    addCaregiverToGroup,
    removeCaregiverFromGroup,
  };
}
