<script setup>
import "@/v3/v3.css";

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
      <span v-for="n in 4" :key="n" class="step__seg" :class="{ 'step__seg--on': n <= step }" />
    </div>
  </div>
  <div class="step__title">
    <h1 class="step__h1">{{ title }}</h1>
    <p v-if="lead" class="step__lead">{{ lead }}</p>
  </div>
</template>

<style scoped>
.step { display: flex; flex-direction: column; gap: 10px; }
.step__count { margin: 0; font-size: 0.875rem; line-height: normal; color: var(--nt-muted); }
.step__bar { display: flex; gap: 6px; width: 320px; max-width: 100%; height: 4px; }
.step__seg { flex: 1 1 0; min-width: 1px; height: 4px; border-radius: 2px; background: var(--nt-line); }
.step__seg--on { background: var(--nt-plum); }
.step__title { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.step__h1 { margin: 0; font-family: var(--nt-serif); font-weight: 400; font-size: 36px; line-height: 44px; letter-spacing: -0.36px; color: var(--nt-ink); }
.step__lead { margin: 0; font-size: 17px; line-height: 26px; color: var(--nt-muted); }
@media (max-width: 575px) {
  .step__h1 { font-size: 30px; line-height: 38px; }
}
</style>
