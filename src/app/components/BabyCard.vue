<script setup>
import { babySummary } from "@/api/profile";
import "@/app/app.css";

// One baby in the household, shown as its own box. `number` is the baby's place in the
// list, used when the baby has no name yet.
const props = defineProps({
  baby: { type: Object, required: true },
  number: { type: Number, required: true },
});
const line = () => babySummary(props.baby).line;
</script>

<template>
  <div class="bc">
    <p class="bc__label">Baby {{ number }}</p>
    <p class="bc__name">{{ baby.babyName || `Baby ${number}` }}</p>
    <p v-if="line()" class="bc__line">{{ line() }}</p>
  </div>
</template>

<style scoped>
.bc { width: 100%; padding: 20px 24px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 12px; }
.bc__label { margin: 0; font-size: 0.875rem; line-height: 1.4; color: var(--nt-muted); }
.bc__name { margin: 2px 0 0; font-size: 1rem; font-weight: 600; line-height: 1.4; color: var(--nt-ink); }
.bc__line { margin: 2px 0 0; font-size: 0.875rem; line-height: 1.4; color: var(--nt-muted); }
@media (max-width: 575px) { .bc { padding: 16px; } }
</style>
