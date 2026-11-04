<script setup>
import Icon from "@/app/components/Icon.vue";
import "@/app/app.css";

defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  selected: { type: Boolean, default: false },
  variant: { type: String, default: "card" }, // card | radio
  radio: { type: Boolean, default: true }, // radio semantics, otherwise a pressed button
  tabindex: { type: Number, default: 0 },
  icon: { type: String, default: "" }, // an Icon name; shows a tile on the left of the card variant
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
    <span v-else-if="icon" class="option__ico" aria-hidden="true"><Icon :name="icon" :size="22" /></span>
    <span class="option__body">
      <span class="option__title">{{ title }}</span>
      <span class="option__desc">{{ description }}</span>
    </span>
    <span v-if="variant !== 'radio'" class="option__tick" aria-hidden="true"><Icon v-if="selected" name="check" :size="14" /></span>
  </button>
</template>

<style scoped>
.option { display: flex; align-items: center; gap: 16px; width: 100%; padding: 16px 18px; text-align: left; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 20px; font-family: inherit; color: var(--ink, #1f2a52); cursor: pointer; transition: border-color 0.15s, transform 0.12s, background 0.15s; }
.option:hover { border-color: var(--navy, #243560); transform: translateY(-1px); }
.option:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.option--selected, .option--selected:hover { background: #fff; border-color: var(--navy, #243560); box-shadow: 0 0 0 1.5px var(--navy, #243560) inset; }
.option__ico { display: grid; place-items: center; flex: none; width: 48px; height: 48px; border-radius: 16px; background: #cfe3d4; color: #2f5d43; }
.option--selected .option__ico { background: var(--navy, #243560); color: #fff; }
.option__body { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.option__title { font-family: var(--nt-serif); font-size: 1.1875rem; font-weight: 700; line-height: 1.25; color: var(--ink, #1f2a52); }
.option__desc { font-size: 0.9375rem; line-height: 1.45; color: var(--mut, #5b6692); }
.option__tick { display: grid; place-items: center; flex: none; width: 26px; height: 26px; border: 2px solid var(--sand, #e9d9b8); border-radius: 50%; background: #fff; color: #fff; }
.option--selected .option__tick { background: var(--navy, #243560); border-color: var(--navy, #243560); }

.option--radio { gap: 12px; padding: 14px 16px; border-radius: 18px; align-items: flex-start; }
.option--radio .option__body { gap: 2px; }
.option--radio .option__title { font-size: 1.0625rem; }
.option__dot { flex: none; width: 18px; height: 18px; margin-top: 3px; border-radius: 50%; border: 2px solid var(--sand, #e9d9b8); background: #fff; }
.option--selected .option__dot { border-color: var(--navy, #243560); background: radial-gradient(circle, var(--navy, #243560) 0 4px, #fff 4.5px); }
</style>
