<script setup>
import { babySummary } from "@/api/profile";
import "@/app/app.css";

// One baby in the household, shown as its own card. `number` is the baby's place in the
// list, used when the baby has no name yet.
const props = defineProps({
  baby: { type: Object, required: true },
  number: { type: Number, required: true },
});
const line = () => babySummary(props.baby).line;
const initial = () => (props.baby.babyName || "").trim().charAt(0).toUpperCase() || String(props.number);
</script>

<template>
  <div class="bc">
    <span class="bc__ava" aria-hidden="true">{{ initial() }}</span>
    <div class="bc__body">
      <p class="bc__name">{{ baby.babyName || `Baby ${number}` }}</p>
      <p v-if="line()" class="bc__line">{{ line() }}</p>
    </div>
    <span class="bc__tag">Baby {{ number }}</span>
  </div>
</template>

<style scoped>
.bc { display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px 16px; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 20px; }
.bc__ava { display: grid; place-items: center; flex: none; width: 48px; height: 48px; border-radius: 16px; background: #cfe3d4; color: #2f5d43; font-family: var(--nt-serif); font-size: 1.25rem; font-weight: 700; }
.bc__body { min-width: 0; }
.bc__name { margin: 0; font-family: var(--nt-serif); font-size: 1.125rem; font-weight: 700; line-height: 1.3; color: var(--ink, #1f2a52); }
.bc__line { margin: 2px 0 0; font-size: 0.875rem; line-height: 1.4; color: var(--mut, #5b6692); }
.bc__tag { margin-left: auto; padding: 4px 10px; background: #fbe3d3; border-radius: 999px; color: #8a3f14; font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
@media (max-width: 575px) { .bc { padding: 12px; } }
</style>
