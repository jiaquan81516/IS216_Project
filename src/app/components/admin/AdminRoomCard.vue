<script setup>
import "@/app/app.css";
import { tidyCaps } from "@/app/utils/roomHelpers";

// One room in an admin list. The slot holds the actions (or the decision) for that list.
defineProps({
  room: { type: Object, required: true },
  pill: { type: String, default: "" },
});
</script>

<template>
  <li class="arc">
    <div class="arc__head">
      <h2 class="arc__name">{{ tidyCaps(room.name) }}</h2>
      <span v-if="pill" class="app-pill arc__pill" :class="{ 'arc__pill--ok': pill === 'Accepted', 'arc__pill--no': pill === 'Rejected' }">{{ pill }}</span>
    </div>
    <p class="arc__text">{{ tidyCaps(room.address) }}</p>
    <p v-if="room.details" class="arc__muted">{{ room.details }}</p>
    <ul v-if="room.features.length" class="arc__chips" aria-label="Features">
      <li v-for="f in room.features" :key="f" class="app-pill">{{ f }}</li>
    </ul>
    <slot />
  </li>
</template>

<style scoped>
/* The same card as the parents' room list: cream, sand edge, serif name. */
.arc { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; min-width: 0; overflow-wrap: anywhere; padding: 22px 26px 20px; background: #fdf9f0; border: 1px solid #e9d9b8; border-bottom-width: 4px; border-radius: 24px; }
.arc__head { display: flex; flex-wrap: nowrap; align-items: flex-start; justify-content: space-between; gap: 12px; width: 100%; }
/* The decision sits flush in the top right corner of the card. */
.arc__pill { flex: none; margin-left: auto; }
.arc :deep(.app-pill.arc__pill--ok) { background: #c9e8cf; border-color: #8fc79b; color: #1d5a2e; }
.arc :deep(.app-pill.arc__pill--no) { background: #f9d9d9; border-color: #e3a1a1; color: #8f1f1f; }
.arc__name { margin: 0; font-family: var(--nt-serif); font-size: 1.3125rem; font-weight: 700; line-height: 1.25; color: #1f2a52; }
.arc__text { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: #1f2a52; }
.arc__muted { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: #6b7392; }
.arc__chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 2px; padding: 0; list-style: none; }
.arc :deep(.app-pill) { padding: 3px 12px; background: #f6efdc; border: 1px solid #e9d9b8; color: #243560; font-size: 0.8125rem; font-weight: 600; }
.arc :deep(.arc__actions) { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; }
.arc :deep(.btn) { min-height: 44px; padding: 7px 22px; border-radius: 999px; font-size: 0.9375rem; font-weight: 700; transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease; }
.arc :deep(.btn-primary) { background: #243560; border: 0; border-bottom: 3px solid #182246; color: #fff; }
.arc :deep(.btn-primary:hover:not(:disabled)) { background: #2c4175; transform: translateY(-1px); }
.arc :deep(.btn-outline) { background: #fff; border: 1.5px solid #e9d9b8; border-bottom-width: 3px; color: #243560; }
.arc :deep(.btn-outline:hover:not(:disabled)) { background: #fff; border-color: #243560; color: #243560; transform: translateY(-1px); }
.arc :deep(.btn:active:not(:disabled)) { transform: none; }
.arc :deep(.btn:focus-visible) { outline: 3px solid #f2a477; outline-offset: 2px; }
@media (max-width: 575px) { .arc { padding: 18px 18px 16px; } }
@media (prefers-reduced-motion: reduce) { .arc :deep(.btn) { transition: none; } }
</style>
