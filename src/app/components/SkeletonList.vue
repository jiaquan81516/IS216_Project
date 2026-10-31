<script setup>
// Soft placeholder blocks for a list that is still loading, so the page does not jump when the
// real rows arrive. The shimmer stops when the device asks for reduced motion.
defineProps({
  rows: { type: Number, default: 3 },
  height: { type: Number, default: 72 },
  label: { type: String, default: "Loading" },
});
</script>

<template>
  <div class="sk" role="status" aria-live="polite" aria-busy="true">
    <span class="visually-hidden">{{ label }}</span>
    <span v-for="n in rows" :key="n" class="sk__row" :style="{ height: `${height}px` }" aria-hidden="true" />
  </div>
</template>

<style scoped>
.sk { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.sk__row {
  display: block;
  border-radius: 12px;
  background: linear-gradient(90deg, var(--nt-gray) 0%, color-mix(in srgb, var(--nt-gray) 35%, white) 50%, var(--nt-gray) 100%);
  background-size: 200% 100%;
  animation: sk-shimmer 1.8s ease-in-out infinite;
}
@keyframes sk-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .sk__row { animation: none; }
}
</style>
