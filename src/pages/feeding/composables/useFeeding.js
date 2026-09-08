import { ref } from "vue";
import { addFeeding, getFeedings } from "@/api/feedingApi";

export function useFeeding() {
  const feedings = ref([]);
  const loading = ref(false);
  const error = ref(null);
  async function loadFeedings() {
    loading.value = true;
    error.value = null;
    try {
      feedings.value = await getFeedings();
    } catch (cause) {
      error.value = cause;
    } finally {
      loading.value = false;
    }
  }
  async function saveFeeding(feeding) {
    return addFeeding(feeding);
  }
  return { feedings, loading, error, loadFeedings, saveFeeding };
}
