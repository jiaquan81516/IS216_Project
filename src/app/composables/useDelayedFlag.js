import { onBeforeUnmount, ref, watch } from "vue";

// Turns a quick on and off flag into one that does not flicker: it only turns on after `delay`
// ms of being on, and once on it stays on for at least `min` ms. A fast sign in shows nothing;
// a slow one shows the loading screen long enough to read. `delay` may be a function.
export function useDelayedFlag(source, { delay = 250, min = 500 } = {}) {
  const shown = ref(false);
  let showTimer = null;
  let hideTimer = null;
  let shownAt = 0;

  watch(
    source,
    (on) => {
      if (on) {
        clearTimeout(hideTimer);
        hideTimer = null;
        if (shown.value || showTimer) return;
        const wait = typeof delay === "function" ? delay() : delay;
        const show = () => {
          showTimer = null;
          shown.value = true;
          shownAt = Date.now();
        };
        if (wait <= 0) show();
        else showTimer = setTimeout(show, wait);
        return;
      }
      clearTimeout(showTimer);
      showTimer = null;
      if (!shown.value || hideTimer) return;
      const left = Math.max(0, min - (Date.now() - shownAt));
      hideTimer = setTimeout(() => {
        hideTimer = null;
        shown.value = false;
      }, left);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
  });
  return shown;
}
