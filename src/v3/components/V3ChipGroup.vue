<script setup>
import "@/v3/v3.css";
defineOptions({ name: "V3ChipGroup" });

defineProps({
  modelValue: { type: [String, Number, null], default: null },
  options: { type: Array, required: true }, // [{ value, label }]
  label: { type: String, required: true },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <div class="chips" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="v3-chip"
      :aria-checked="modelValue === option.value ? 'true' : 'false'"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
