<script setup>
import { computed } from "vue";
import "@/app/app.css";

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
  <div class="app-field">
    <label class="app-field__label" :for="id">{{ label }}</label>
    <input
      :id="id"
      class="app-input"
      :class="{ 'app-input--invalid': error }"
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
    <p v-if="hint" :id="`${id}-hint`" class="app-field__hint">{{ hint }}</p>
    <p v-if="error" :id="`${id}-error`" class="app-field__error" role="alert">{{ error }}</p>
  </div>
</template>
