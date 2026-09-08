import { ref } from "vue";
import {
  addWellnessCheckIn,
  getWellnessCheckInsByUser,
} from "@/api/wellnessApi";
import { useAuth } from "@/composables/useAuth";

export function useWellness() {
  const { currentUser } = useAuth();
  const entries = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function loadEntries() {
    loading.value = true;
    error.value = null;
    try {
      entries.value = await getWellnessCheckInsByUser(currentUser.value?.uid);
    } catch (cause) {
      error.value = cause;
      throw cause;
    } finally {
      loading.value = false;
    }
  }
  async function saveEntry(entry) {
    return addWellnessCheckIn({ ...entry, userId: currentUser.value?.uid });
  }
  return { entries, loading, error, loadEntries, saveEntry };
}
