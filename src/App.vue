<script setup>
import { computed, nextTick } from "vue";
import { RouterView } from "vue-router";
import LoadingScreen from "@/app/components/LoadingScreen.vue";
import { useDelayedFlag } from "@/app/composables/useDelayedFlag";
import { isStepPath, routeMotion } from "@/app/utils/routeMotion";

// A page change that takes a moment (the guard waits for sign in and the household) shows the
// loading screen; the very first load shows it at once, later ones only if they are slow.
const changing = computed(() => routeMotion.pending);
const showLoader = useDelayedFlag(changing, { delay: () => (routeMotion.initial ? 0 : 300), min: 450 });

// The sign up steps slide inside one frame. After a slide, move focus to the new heading so
// keyboard and screen reader users start at the top of the step.
async function focusHeading() {
  await nextTick();
  const heading = document.querySelector(".step-wrap h1");
  if (!heading) return;
  heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <Transition
      v-if="isStepPath(route.path)"
      name="step"
      mode="out-in"
      :duration="{ enter: 340, leave: 200 }"
      @after-enter="focusHeading"
    >
      <div :key="route.path" class="step-wrap"><component :is="Component" /></div>
    </Transition>
    <component :is="Component" v-else />
  </RouterView>
  <LoadingScreen v-if="showLoader" :variant="routeMotion.initial ? 'page' : 'overlay'" label="Getting things ready" subtext="Just a moment." />
</template>

<style>
/* Sign up steps. Only the page body slides, so the header stays where it is. The direction
   comes from data-step-dir on <html> (set by the router guard). */
.step-wrap { overflow-x: clip; }
.step-wrap h1:focus { outline: none; }

.step-enter-active main { animation: step-in-right 340ms cubic-bezier(0.22, 0.61, 0.36, 1) both; }
.step-leave-active main { animation: step-out-left 200ms ease-in both; }
[data-step-dir="back"] .step-enter-active main { animation-name: step-in-left; }
[data-step-dir="back"] .step-leave-active main { animation-name: step-out-right; }

@keyframes step-in-right { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }
@keyframes step-in-left { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: none; } }
@keyframes step-out-left { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateX(-28px); } }
@keyframes step-out-right { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateX(28px); } }
@keyframes step-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes step-fade-out { from { opacity: 1; } to { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .step-enter-active main,
  [data-step-dir="back"] .step-enter-active main { animation-name: step-fade-in; animation-duration: 150ms; }
  .step-leave-active main,
  [data-step-dir="back"] .step-leave-active main { animation-name: step-fade-out; animation-duration: 120ms; }
}
</style>
