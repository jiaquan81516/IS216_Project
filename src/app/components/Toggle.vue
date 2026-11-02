<script setup>
import "@/app/app.css";
defineOptions({ name: "Toggle" });

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
.tg { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.tg__text { min-width: 0; }
.tg__label { display: block; font-size: 0.9375rem; font-weight: 600; line-height: 1.4; color: var(--ink, #1f2a52); }
.tg__hint { margin: 2px 0 0; font-size: 0.875rem; line-height: 1.45; color: var(--mut, #5b6692); }
.tg__switch { position: relative; flex: none; width: 48px; height: 28px; padding: 0; background: #d9d2c0; border: 0; border-radius: 999px; cursor: pointer; transition: background-color 0.15s; }
.tg__switch[aria-checked="true"] { background: var(--navy, #243560); }
.tg__switch:disabled { opacity: 0.55; cursor: not-allowed; }
.tg__switch:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.tg__knob { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; background: #fff; border-radius: 999px; box-shadow: 0 1px 3px rgb(0 0 0 / 25%); transition: transform 0.15s; }
.tg__switch[aria-checked="true"] .tg__knob { transform: translateX(20px); }
@media (prefers-reduced-motion: reduce) { .tg__knob, .tg__switch { transition: none; } }
</style>
