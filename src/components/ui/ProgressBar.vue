<script setup>
defineProps({ value: { type: Number, default: 0 }, color: { type: String, default: "var(--nt-plum)" } });
</script>

<template>
  <div class="bar" role="progressbar" :aria-valuenow="value" aria-valuemin="0" aria-valuemax="100">
    <div class="bar__fill" :style="{ width: `${value}%`, background: color }" />
  </div>
</template>

<style scoped>
.bar { height: 6px; background: var(--nt-gray); border-radius: 3px; overflow: hidden; }
.bar__fill { height: 100%; border-radius: 3px; }
</style>
