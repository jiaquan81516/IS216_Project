import { calculateAverageInterval } from "@/pages/insights/shared/functions/insightFunctions";

export function predictNextFeeding(feedings) {
  if (feedings.length < 2) return null;
  return new Date(
    new Date(feedings[0].date).getTime() + calculateAverageInterval(feedings),
  );
}
