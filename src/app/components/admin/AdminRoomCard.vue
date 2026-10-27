<script setup>
import "@/app/app.css";

// One room in an admin list. The slot holds the actions (or the decision) for that list.
defineProps({
  room: { type: Object, required: true },
  pill: { type: String, default: "" },
});
</script>

<template>
  <li class="arc">
    <div class="arc__head">
      <h2 class="arc__name">{{ room.name }}</h2>
      <span v-if="pill" class="app-pill">{{ pill }}</span>
    </div>
    <p class="arc__text">{{ room.address }}</p>
    <p v-if="room.details" class="arc__muted">{{ room.details }}</p>
    <ul v-if="room.features.length" class="arc__chips" aria-label="Features">
      <li v-for="f in room.features" :key="f" class="app-pill">{{ f }}</li>
    </ul>
    <slot />
  </li>
</template>

<style scoped>
.arc { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 20px 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.arc__head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.arc__name { margin: 0; font-size: 1rem; font-family: inherit; font-weight: 600; line-height: 1.4; color: var(--nt-ink); }
.arc__text { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.arc__muted { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.arc__chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; padding: 0; list-style: none; }
.arc :deep(.arc__actions) { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
@media (max-width: 575px) { .arc { padding: 16px; } }
</style>
