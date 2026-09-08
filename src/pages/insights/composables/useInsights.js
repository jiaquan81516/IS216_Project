import { computed, ref, toValue } from "vue";
import { getFeedingsByBaby } from "@/api/feedingApi";
import { calculateAverageInterval } from "@/pages/insights/shared/functions/insightFunctions";

export function useInsights(babyId) {
  const feedings = ref([]);
  const averageInterval = computed(() =>
    calculateAverageInterval(feedings.value),
  );
  async function loadInsights() {
    feedings.value = await getFeedingsByBaby(toValue(babyId));
  }
  return { feedings, averageInterval, loadInsights };
}
