<script setup>
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";

// Pages that belong to one baby (care log, checklist, sleep rota, calendar) show this when
// the household has more than one baby. Home shows every baby, so it does not need it.
defineOptions({ name: "BabySwitch" });
const { babies, selectedBaby, selectBaby } = useSelectedBaby();
const label = (b, i) => b.babyName || `Baby ${i + 1}`;
</script>

<template>
  <div v-if="babies.length > 1" class="bsw" role="group" aria-label="Which baby">
    <span class="bsw__lead">Showing</span>
    <button
      v-for="(b, i) in babies"
      :key="b.id"
      type="button"
      class="bsw__pill"
      :class="{ 'bsw__pill--on': b.id === selectedBaby?.id }"
      :aria-pressed="b.id === selectedBaby?.id ? 'true' : 'false'"
      @click="selectBaby(b.id)"
    >
      <span class="bsw__face" aria-hidden="true">{{ label(b, i).charAt(0).toUpperCase() }}</span>
      {{ label(b, i) }}
    </button>
  </div>
</template>

<style scoped>
.bsw {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
}
.bsw__lead {
  margin-right: 4px;
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.bsw__pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 14px 4px 4px;
  background: #fdf3e6;
  border: 1px solid #e3d3bf;
  border-radius: 999px;
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1f3556;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease;
}
.bsw__pill:hover {
  background: #fff;
}
.bsw__pill:focus-visible {
  outline: 2px solid #1f3556;
  outline-offset: 2px;
}
.bsw__pill--on,
.bsw__pill--on:hover {
  background: #1f3556;
  border-color: #1f3556;
  color: #fdf3e6;
}
.bsw__face {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #f1c9ad;
  border-radius: 50%;
  font-family: var(--nt-serif, inherit);
  font-size: 0.9375rem;
  color: #1f3556;
}
@media (prefers-reduced-motion: reduce) {
  .bsw__pill {
    transition: none;
  }
}
</style>
