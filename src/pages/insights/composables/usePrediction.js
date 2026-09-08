import { computed } from "vue";
import { predictNextFeeding } from "@/pages/insights/shared/functions/predictionFunctions";

export function usePrediction(feedings) {
  const prediction = computed(() => predictNextFeeding(feedings.value));
  return { prediction };
}
