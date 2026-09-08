<script setup>
defineOptions({ inheritAttrs: false });
</script>

<template>
  <button class="app-button" type="button" v-bind="$attrs"><slot /></button>
</template>

<style scoped>
.app-button {
  padding: 0.65rem 1rem;
  color: #fff;
  background: #3a6870;
  border: 0;
  border-radius: 0.5rem;
  cursor: pointer;
}
.app-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
