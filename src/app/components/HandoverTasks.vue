<script setup>
// The tasks that came with a handover. Each carries `done`, read from the checklist, so ticking
// one here is the same as ticking it there. The reader can tick; the sender only sees.
defineProps({
  tasks: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  busy: { type: String, default: "" },
  label: { type: String, default: "Tasks" },
});
defineEmits(["toggle"]);
</script>

<template>
  <ul class="hot" :aria-label="label">
    <li v-for="task in tasks" :key="task.id" class="hot__row">
      <label class="hot__label" :class="{ 'hot__label--done': task.done }">
        <input
          type="checkbox"
          class="hot__box"
          :checked="task.done"
          :disabled="!editable || busy === task.id"
          @change="$emit('toggle', task)"
        />
        <span class="hot__text">{{ task.text }}</span>
      </label>
    </li>
  </ul>
</template>

<style scoped>
.hot { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.hot__row { display: flex; flex-direction: column; gap: 2px; padding: 10px 0; border-bottom: 1px solid var(--nt-line); }
.hot__label { display: flex; align-items: flex-start; gap: 10px; font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); cursor: pointer; }
.hot__label--done .hot__text { color: var(--nt-muted); text-decoration: line-through; }
.hot__box { flex: none; width: 18px; height: 18px; margin: 2px 0 0; accent-color: var(--nt-plum); cursor: pointer; }
.hot__box:disabled { cursor: default; }
.hot__box:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.hot__text { min-width: 0; overflow-wrap: anywhere; }
</style>
