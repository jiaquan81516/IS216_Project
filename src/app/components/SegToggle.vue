<script setup>
import { computed } from "vue";

// Two or three choices side by side, with a navy highlight that slides to the chosen one.
defineOptions({ name: "SegToggle" });
const props = defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, required: true }, // [{ value, label }]
  label: { type: String, required: true },
});
const emit = defineEmits(["update:modelValue"]);
const index = computed(() => Math.max(0, props.options.findIndex((o) => o.value === props.modelValue)));
</script>

<template>
  <div class="sg" role="radiogroup" :aria-label="label" :style="{ '--n': options.length, '--i': index }">
    <span class="sg__thumb" aria-hidden="true"></span>
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      role="radio"
      class="sg__btn"
      :aria-checked="o.value === modelValue ? 'true' : 'false'"
      @click="emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped>
.sg {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  padding: 4px;
  background: #fffdf8;
  border: 1.5px solid var(--sand, #e9d9b8);
  border-radius: 999px;
}
.sg__thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 8px) / var(--n));
  background: var(--navy, #243560);
  border-radius: 999px;
  transform: translateX(calc(var(--i) * 100%));
  transition: transform 280ms cubic-bezier(0.34, 1.25, 0.64, 1);
}
.sg__btn {
  position: relative;
  z-index: 1;
  padding: 10px 12px;
  background: transparent;
  border: 0;
  border-radius: 999px;
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--navy, #243560);
  cursor: pointer;
  transition: color 200ms ease;
}
.sg__btn[aria-checked="true"] {
  color: #fff;
}
.sg__btn:not([aria-checked="true"]):hover {
  color: #5b6692;
}
.sg__btn:focus-visible {
  outline: 3px solid var(--navy, #243560);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .sg__thumb,
  .sg__btn {
    transition: none;
  }
}
</style>
