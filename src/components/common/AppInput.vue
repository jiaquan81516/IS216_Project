<script setup>
defineProps({
  id: { type: String, required: true },
  label: { type: String, default: "" },
  modelValue: { type: [String, Number], default: "" },
});
defineEmits(["update:modelValue"]);
</script>

<template>
  <label class="app-input" :for="id">
    <span v-if="label">{{ label }}</span>
    <input
      :id="id"
      :value="modelValue"
      v-bind="$attrs"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  </label>
</template>

<style scoped>
.app-input {
  display: grid;
  gap: 0.35rem;
}
.app-input input {
  padding: 0.65rem 0.75rem;
  border: 1px solid #b9c5ca;
  border-radius: 0.5rem;
}
</style>
