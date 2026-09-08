import { computed, ref } from "vue";
import { getFeedings } from "@/api/feedingApi";

export function useDashboard() {
  const feedings = ref([]);
  const latestFeeding = computed(() => feedings.value[0] ?? null);
  async function loadDashboard() {
    feedings.value = await getFeedings();
  }
  return { feedings, latestFeeding, loadDashboard };
}
