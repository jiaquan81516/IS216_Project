<script setup>
import { RouterLink } from "vue-router";

defineOptions({ inheritAttrs: false });
defineProps({
  to: { type: [String, Object], default: null },
  muted: { type: Boolean, default: false },
});
</script>

<template>
  <RouterLink v-if="to" :to="to" class="nt-link" :class="{ 'nt-link--muted': muted }" v-bind="$attrs"><slot /></RouterLink>
  <button v-else type="button" class="nt-link" :class="{ 'nt-link--muted': muted }" v-bind="$attrs"><slot /></button>
</template>
