<script setup>
import "@/v3/v3.css";

defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  selected: { type: Boolean, default: false },
  variant: { type: String, default: "card" }, // card | radio
  radio: { type: Boolean, default: true }, // radio semantics, otherwise a pressed button
  tabindex: { type: Number, default: 0 },
});
defineEmits(["select"]);
</script>

<template>
  <button
    type="button"
    class="option"
    :class="[`option--${variant}`, { 'option--selected': selected }]"
    :role="radio ? 'radio' : undefined"
    :aria-checked="radio ? selected : undefined"
    :aria-pressed="radio ? undefined : selected"
    :tabindex="tabindex"
    @click="$emit('select')"
  >
    <span v-if="variant === 'radio'" class="option__dot" aria-hidden="true" />
    <span class="option__body">
      <span class="option__title">{{ title }}</span>
      <span class="option__desc">{{ description }}</span>
    </span>
  </button>
</template>

<style scoped>
.option { display: flex; align-items: flex-start; width: 100%; padding: 24px; text-align: left; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; font-family: inherit; color: var(--nt-ink); cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
.option:hover { border-color: var(--nt-muted); }
.option--selected, .option--selected:hover { border-color: var(--nt-plum); box-shadow: 0 0 0 1px var(--nt-plum); }
.option__body { display: flex; flex-direction: column; gap: 8px; min-width: 0; flex: 1; }
.option__title { font-size: 1rem; font-weight: 600; line-height: normal; color: var(--nt-ink); }
.option__desc { font-size: 0.875rem; line-height: 21px; color: var(--nt-muted); }

.option--radio { gap: 14px; padding: 16px; border-radius: 8px; }
.option--radio .option__body { gap: 2px; }
.option--radio .option__title { font-weight: 500; }
.option__dot { flex: none; width: 16px; height: 16px; margin-top: 4px; border-radius: 50%; border: 1px solid var(--nt-line); background: #fff; }
.option--selected .option__dot { border-color: var(--nt-plum); background: radial-gradient(circle, var(--nt-plum) 0 3px, #fff 3.5px 5px, var(--nt-plum) 5.5px); }
</style>
