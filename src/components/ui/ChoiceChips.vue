<script setup>
// Single or multi select made of tappable cells.
// variant: chips (hug content), scale (equal-width cells), tinted (scale on a butter box)
const props = defineProps({
  modelValue: { type: [String, Number, Array], default: null },
  options: { type: Array, required: true }, // [{ value, label }] or plain strings
  multiple: { type: Boolean, default: false },
  variant: { type: String, default: "chips" },
  ariaLabel: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

const items = props.options.map((o) => (typeof o === "object" ? o : { value: o, label: o }));
const isOn = (v) => (props.multiple ? (props.modelValue ?? []).includes(v) : props.modelValue === v);

function pick(v) {
  if (!props.multiple) return emit("update:modelValue", v);
  const cur = props.modelValue ?? [];
  emit("update:modelValue", cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
}
</script>

<template>
  <div class="chips" :class="`chips--${variant}`" role="group" :aria-label="ariaLabel">
    <button
      v-for="o in items"
      :key="o.value"
      type="button"
      class="chip"
      :class="{ 'chip--on': isOn(o.value) }"
      :aria-pressed="isOn(o.value)"
      @click="pick(o.value)"
    >{{ o.label }}</button>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  padding: 0.65rem 1rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--nt-ink);
  background: var(--nt-white);
  border: 1px solid var(--nt-line);
  border-radius: 8px;
  cursor: pointer;
}
.chip--on {
  font-weight: 600;
  border: 2px solid var(--nt-plum);
  padding: calc(0.65rem - 1px) calc(1rem - 1px);
}
.chips--scale .chip,
.chips--tinted .chip {
  flex: 1 1 0;
  padding-inline: 4px;
  font-size: 0.875rem;
  text-align: center;
}
.chips--tinted .chip:not(.chip--on) {
  background: transparent;
  border-color: var(--nt-butter-d);
}
</style>
