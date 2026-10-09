<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
});
</script>

<template>
  <div class="page-header">
    <div class="page-header__text">
      <h1 class="nt-title">{{ title }}</h1>
      <p v-if="subtitle" class="nt-lead mb-0 mt-2">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.default" class="page-header__actions"><slot /></div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px 24px;
}
.page-header__text {
  max-width: 720px;
}
.page-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
</style>
