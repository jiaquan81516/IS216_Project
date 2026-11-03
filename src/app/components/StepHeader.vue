<script setup>
import "@/app/app.css";

defineProps({
  step: { type: Number, required: true },
  title: { type: String, required: true },
  lead: { type: String, default: "" },
});
</script>

<template>
  <div class="step">
    <p class="step__count">Step {{ step }} of 4</p>
    <div
      class="step__bar"
      role="progressbar"
      aria-label="Setup progress"
      :aria-valuenow="step"
      aria-valuemin="1"
      aria-valuemax="4"
      :aria-valuetext="`Step ${step} of 4`"
    >
      <span v-for="n in 4" :key="n" class="step__seg" :class="{ 'step__seg--on': n < step, 'step__seg--now': n === step }" />
    </div>
  </div>
  <div class="step__title">
    <h1 class="step__h1">{{ title }}</h1>
    <p v-if="lead" class="step__lead">{{ lead }}</p>
  </div>
</template>

<style scoped>
.step { display: flex; align-items: center; gap: 12px; width: 100%; }
.step__count { margin: 0; font-size: 0.8125rem; font-weight: 700; color: var(--mut, #5b6692); white-space: nowrap; }
.step__bar { display: flex; flex: 1; gap: 6px; min-width: 120px; max-width: 360px; height: 8px; }
.step__seg { position: relative; flex: 1 1 0; min-width: 1px; height: 8px; overflow: hidden; border-radius: 999px; background: #e2d2ae; }
.step__seg::after { content: ""; position: absolute; inset: 0; border-radius: 999px; background: var(--navy, #243560); transform: scaleX(0); transform-origin: left; }
.step__seg--on::after { transform: scaleX(1); }
.step__seg--now::after { background: #f2a477; animation: step-fill 650ms 280ms cubic-bezier(0.22, 0.61, 0.36, 1) both; }
@keyframes step-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@media (prefers-reduced-motion: reduce) { .step__seg--now::after { animation: none; transform: scaleX(1); } }
.step__title { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.step__h1 { margin: 0; font-family: var(--nt-serif); font-weight: 700; font-size: 2rem; line-height: 1.15; color: var(--ink, #1f2a52); }
.step__lead { margin: 0; font-size: 1rem; line-height: 1.55; color: var(--mut, #5b6692); }
@media (max-width: 575px) {
  .step__h1 { font-size: 1.625rem; }
}
</style>
