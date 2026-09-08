export function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
export function formatAmount(amount, unit = "ml") {
  return `${amount} ${unit}`;
}
