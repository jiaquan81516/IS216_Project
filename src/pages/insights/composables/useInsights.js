import { computed, ref } from "vue";
import { getFeedings } from "@/api/feedingApi";
import { calculateAverageInterval } from "@/pages/insights/shared/functions/insightFunctions";

export function useInsights() {
  const feedings = ref([]);
  const averageInterval = computed(() =>
    calculateAverageInterval(feedings.value),
  );
  async function loadInsights() {
    feedings.value = await getFeedings();
  }
  return { feedings, averageInterval, loadInsights };
}
