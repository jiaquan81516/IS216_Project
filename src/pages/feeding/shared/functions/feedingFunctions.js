export function calculateDuration(startTime, endTime) {
  return Math.max(0, endTime - startTime);
}
