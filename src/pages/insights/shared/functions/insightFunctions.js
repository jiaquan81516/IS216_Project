export function calculateAverageInterval(feedings) {
  if (feedings.length < 2) return 0;
  const total = feedings
    .slice(1)
    .reduce(
      (sum, feeding, index) =>
        sum + Math.abs(new Date(feeding.date) - new Date(feedings[index].date)),
      0,
    );
  return total / (feedings.length - 1);
}
