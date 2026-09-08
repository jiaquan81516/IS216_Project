import { computed, ref, toValue } from "vue";
import { getFeedingsByBaby } from "@/api/feedingApi";

export function useDashboard(babyId) {
  const feedings = ref([]);
  const latestFeeding = computed(() => feedings.value[0] ?? null);
  async function loadDashboard() {
    feedings.value = await getFeedingsByBaby(toValue(babyId));
  }
  return { feedings, latestFeeding, loadDashboard };
}
