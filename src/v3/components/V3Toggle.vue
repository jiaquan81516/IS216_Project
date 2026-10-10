<script setup>
import "@/v3/v3.css";
defineOptions({ name: "V3Toggle" });

const props = defineProps({
  id: { type: String, required: true },
  modelValue: { type: Boolean, default: false },
  label: { type: String, required: true },
  hint: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

function toggle() {
  if (props.disabled) return;
  emit("update:modelValue", !props.modelValue);
}
</script>

<template>
  <div class="tg">
    <div class="tg__text">
      <label class="tg__label" :for="id">{{ label }}</label>
      <p v-if="hint" :id="`${id}-hint`" class="tg__hint">{{ hint }}</p>
    </div>
    <button
      :id="id"
      type="button"
      role="switch"
      class="tg__switch"
      :aria-checked="modelValue ? 'true' : 'false'"
      :aria-describedby="hint ? `${id}-hint` : undefined"
      :disabled="disabled"
      @click="toggle"
    >
      <span class="tg__knob" aria-hidden="true"></span>
      <span class="visually-hidden">{{ modelValue ? "On" : "Off" }}</span>
    </button>
  </div>
</template>

<style scoped>
.tg {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.tg__text {
  min-width: 0;
}
.tg__label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 20px;
  color: var(--nt-ink);
}
.tg__hint {
  margin: 2px 0 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--nt-muted);
}
.tg__switch {
  position: relative;
  flex: none;
  width: 44px;
  height: 24px;
  padding: 0;
  background: #fff;
  border: 1px solid var(--nt-line);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}
.tg__switch[aria-checked="true"] {
  background: var(--nt-plum);
  border-color: var(--nt-plum);
}
.tg__switch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.tg__switch:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 2px;
}
.tg__knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  background: var(--nt-muted);
  border-radius: 999px;
}
.tg__switch[aria-checked="true"] .tg__knob {
  left: auto;
  right: 3px;
  background: #fff;
}
</style>
