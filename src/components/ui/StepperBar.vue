<script setup>
import StepMarker from "./StepMarker.vue";

const props = defineProps({ current: { type: Number, required: true } }); // 1 to 4
const STEPS = ["About you", "Your baby", "Your partner", "Nights and alerts"];
const stateOf = (i) => (i + 1 < props.current ? "done" : i + 1 === props.current ? "now" : "todo");
</script>

<template>
  <ol class="stepper" aria-label="Setup progress">
    <template v-for="(label, i) in STEPS" :key="label">
      <li class="stepper__item" :aria-current="stateOf(i) === 'now' ? 'step' : undefined">
        <StepMarker :n="i + 1" :state="stateOf(i)" />
        <span :class="['stepper__label', { 'stepper__label--todo': stateOf(i) === 'todo', 'stepper__label--now': stateOf(i) === 'now' }]">{{ label }}</span>
      </li>
      <li v-if="i < STEPS.length - 1" class="stepper__line" aria-hidden="true" />
    </template>
  </ol>
</template>

<style scoped>
.stepper { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 0; padding: 0; list-style: none; }
.stepper__item { display: flex; align-items: center; gap: 8px; }
.stepper__label { font-size: 0.875rem; font-weight: 500; }
.stepper__label--now { font-weight: 600; }
.stepper__label--todo { color: var(--nt-muted); }
.stepper__line { width: 20px; height: 1px; background: var(--nt-line); }
</style>
