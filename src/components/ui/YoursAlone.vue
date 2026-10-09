<script setup>
defineProps({ label: { type: String, default: "Yours alone" } });
</script>

<template>
  <section class="nt-yours-alone">
    <span class="nt-yours-alone__label">{{ label }}</span>
    <slot />
  </section>
</template>
