<script setup>
// Pill-style tabs: gray track, white active tab.
defineProps({
  modelValue: { type: String, required: true },
  tabs: { type: Array, required: true }, // [{ value, label }]
  ariaLabel: { type: String, default: "" },
});
defineEmits(["update:modelValue"]);
</script>

<template>
  <div class="pill-tabs" role="tablist" :aria-label="ariaLabel">
    <button
      v-for="t in tabs"
      :key="t.value"
      type="button"
      role="tab"
      class="pill-tabs__tab"
      :class="{ 'pill-tabs__tab--on': modelValue === t.value }"
      :aria-selected="modelValue === t.value"
      @click="$emit('update:modelValue', t.value)"
    >{{ t.label }}</button>
  </div>
</template>

<style scoped>
.pill-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
  background: var(--nt-gray);
  border-radius: 8px;
}
.pill-tabs__tab {
  padding: 8px 14px;
  font-size: 0.875rem;
  color: var(--nt-muted);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.pill-tabs__tab:hover {
  color: var(--nt-ink);
}
.pill-tabs__tab:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 1px;
}
.pill-tabs__tab--on {
  font-weight: 500;
  color: var(--nt-ink);
  background: var(--nt-white);
}
</style>
