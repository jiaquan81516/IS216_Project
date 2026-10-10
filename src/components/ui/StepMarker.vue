<script setup>
defineProps({
  n: { type: Number, required: true },
  state: { type: String, default: "todo" }, // now | done | todo
});
</script>

<template>
  <span class="marker" :class="`marker--${state}`">{{ state === "done" ? "✓" : n }}</span>
</template>

<style scoped>
.marker {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 6px;
  background: var(--nt-white);
  border: 1px solid var(--nt-line);
  color: var(--nt-muted);
}
.marker--now { background: var(--nt-plum); border-color: var(--nt-plum); color: #fff; }
.marker--done { border: 1.5px solid var(--nt-plum); color: var(--nt-plum); }
</style>
