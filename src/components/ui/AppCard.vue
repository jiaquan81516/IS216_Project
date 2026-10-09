<script setup>
defineProps({
  variant: { type: String, default: "plain" }, // plain | danger | tint | dashed
  title: { type: String, default: "" },
  flush: { type: Boolean, default: false },
});
</script>

<template>
  <section class="nt-card" :class="[variant !== 'plain' ? `nt-card--${variant}` : '', { 'p-0': flush }]">
    <h2 v-if="title" class="nt-heading nt-heading--sm">{{ title }}</h2>
    <slot />
  </section>
</template>
