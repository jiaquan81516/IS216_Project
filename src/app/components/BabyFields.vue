<script setup>
import { computed } from "vue";
import Field from "@/app/components/Field.vue";
import "@/app/app.css";

// The three things we ask about a baby: a name, whether the baby is here or on the way, and
// the birth or due date. Used when setting up a household and when adding another baby.
// `modelValue` is { name, status, date }.
const props = defineProps({
  modelValue: { type: Object, required: true },
  idPrefix: { type: String, required: true },
  hint: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

const STATUSES = [
  { value: "born", label: "Baby is here" },
  { value: "expected", label: "Baby is on the way" },
];

const pad = (n) => String(n).padStart(2, "0");
const today = new Date();
const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

const dateLabel = computed(() => (props.modelValue.status === "born" ? "Date of birth" : "Due date"));
const dateMax = computed(() => (props.modelValue.status === "born" ? todayIso : undefined));
const dateMin = computed(() => (props.modelValue.status === "expected" ? todayIso : undefined));

const set = (patch) => emit("update:modelValue", { ...props.modelValue, ...patch });

function onStatusKeydown(event) {
  if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
  event.preventDefault();
  const next = props.modelValue.status === "born" ? "expected" : "born";
  set({ status: next });
  event.currentTarget.querySelector(`[data-status="${next}"]`)?.focus();
}
</script>

<template>
  <div class="app-stack app-stack--24 w-100">
    <Field
      :id="`${idPrefix}-name`"
      :model-value="modelValue.name"
      label="Baby's name (optional)"
      autocomplete="off"
      :hint="hint"
      :disabled="disabled"
      @update:model-value="set({ name: $event })"
    />
    <div class="bf__status" role="radiogroup" aria-label="Baby status" @keydown="onStatusKeydown">
      <button
        v-for="option in STATUSES"
        :key="option.value"
        type="button"
        role="radio"
        class="bf__seg"
        :class="{ 'bf__seg--on': modelValue.status === option.value }"
        :data-status="option.value"
        :aria-checked="modelValue.status === option.value"
        :tabindex="modelValue.status === option.value ? 0 : -1"
        :disabled="disabled"
        @click="set({ status: option.value })"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="app-field">
      <label class="app-field__label" :for="`${idPrefix}-date`">{{ dateLabel }} (optional)</label>
      <input
        :id="`${idPrefix}-date`"
        :value="modelValue.date"
        class="app-input"
        type="date"
        :min="dateMin"
        :max="dateMax"
        :disabled="disabled"
        @input="set({ date: $event.target.value })"
      />
    </div>
  </div>
</template>

<style scoped>
.bf__status { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%; }
.bf__seg { padding: 12px 16px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 8px; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-ink); cursor: pointer; }
.bf__seg:hover { border-color: var(--nt-muted); }
.bf__seg--on, .bf__seg--on:hover { border-color: var(--nt-plum); box-shadow: 0 0 0 1px var(--nt-plum); }
.bf__seg:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
</style>
