<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  variant: { type: String, default: "primary" }, // primary | outline
  size: { type: String, default: "lg" }, // sm | md | lg
  to: { type: [String, Object], default: null },
  block: { type: Boolean, default: false },
  type: { type: String, default: "button" },
});

const classes = computed(() => [
  "btn",
  props.variant === "primary" ? "btn-primary" : "btn-outline",
  props.size === "lg" ? "btn-lg" : props.size === "sm" ? "btn-sm" : "",
  { "w-100": props.block },
]);
</script>

<template>
  <RouterLink v-if="to" :to="to" :class="classes" v-bind="$attrs"><slot /></RouterLink>
  <button v-else v-bind="$attrs" :type="type" :class="classes"><slot /></button>
</template>
