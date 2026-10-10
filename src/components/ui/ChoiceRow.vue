<script setup>
import { computed } from "vue";

const props = defineProps({
  type: { type: String, default: "radio" }, // radio | checkbox
  modelValue: { type: [String, Number, Boolean, Array], default: null },
  value: { type: [String, Number, Boolean], default: true },
  name: { type: String, default: "" },
  title: { type: String, required: true },
  description: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

const checked = computed(() =>
  props.type === "checkbox"
    ? Array.isArray(props.modelValue)
      ? props.modelValue.includes(props.value)
      : Boolean(props.modelValue)
    : props.modelValue === props.value,
);

function onChange() {
  if (props.type === "radio") return emit("update:modelValue", props.value);
  if (Array.isArray(props.modelValue)) {
    emit(
      "update:modelValue",
      checked.value ? props.modelValue.filter((v) => v !== props.value) : [...props.modelValue, props.value],
    );
  } else {
    emit("update:modelValue", !checked.value);
  }
}
</script>

<template>
  <label class="choice-row" :class="{ 'choice-row--on': checked }">
    <input class="form-check-input mt-1" :type="type" :name="name" :checked="checked" @change="onChange" />
    <span class="choice-row__text">
      <span class="choice-row__title">{{ title }}</span>
      <span v-if="description" class="choice-row__desc">{{ description }}</span>
    </span>
    <slot />
  </label>
</template>

<style scoped>
.choice-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  background: var(--nt-white);
  border: 1px solid var(--nt-line);
  border-radius: 8px;
  cursor: pointer;
}
.choice-row--on {
  border: 2px solid var(--nt-plum);
  padding: 15px;
}
.choice-row__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}
.choice-row__title {
  font-weight: 500;
  font-size: 1rem;
}
.choice-row__desc {
  font-size: 0.875rem;
  color: var(--nt-muted);
}
</style>
