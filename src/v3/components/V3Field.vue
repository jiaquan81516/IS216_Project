<script setup>
import { computed } from "vue";
import "@/v3/v3.css";

const props = defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  modelValue: { type: String, default: "" },
  type: { type: String, default: "text" },
  placeholder: { type: String, default: "" },
  autocomplete: { type: String, default: undefined },
  hint: { type: String, default: "" },
  error: { type: String, default: "" },
  minlength: { type: Number, default: undefined },
  disabled: { type: Boolean, default: false },
});
defineEmits(["update:modelValue"]);

const describedBy = computed(
  () => [props.hint ? `${props.id}-hint` : null, props.error ? `${props.id}-error` : null].filter(Boolean).join(" ") || undefined,
);
</script>

<template>
  <div class="v3-field">
    <label class="v3-field__label" :for="id">{{ label }}</label>
    <input
      :id="id"
      class="v3-input"
      :class="{ 'v3-input--invalid': error }"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :minlength="minlength"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <p v-if="hint" :id="`${id}-hint`" class="v3-field__hint">{{ hint }}</p>
    <p v-if="error" :id="`${id}-error`" class="v3-field__error" role="alert">{{ error }}</p>
  </div>
</template>
