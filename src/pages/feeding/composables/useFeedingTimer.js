import { computed, onUnmounted, ref } from "vue";

export function useFeedingTimer() {
  const elapsedSeconds = ref(0);
  let intervalId;
  const isRunning = computed(() => intervalId !== undefined);
  function start() {
    if (intervalId === undefined)
      intervalId = window.setInterval(() => {
        elapsedSeconds.value += 1;
      }, 1000);
  }
  function stop() {
    window.clearInterval(intervalId);
    intervalId = undefined;
  }
  function reset() {
    stop();
    elapsedSeconds.value = 0;
  }
  onUnmounted(stop);
  return { elapsedSeconds, isRunning, start, stop, reset };
}
