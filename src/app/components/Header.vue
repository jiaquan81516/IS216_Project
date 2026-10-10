<script setup>
import "@/app/app.css";
import BrandLogo from "@/components/ui/BrandLogo.vue";
import { ROUTES } from "@/app/routes";

defineProps({ bordered: { type: Boolean, default: true } });
</script>

<template>
  <header class="app-header" :class="{ 'app-header--bordered': bordered }">
    <div class="app-container app-header__inner">
      <BrandLogo :to="ROUTES.LANDING" />
      <nav v-if="$slots.default" class="app-header__nav" aria-label="Main"><slot /></nav>
    </div>
  </header>
</template>

<style scoped>
.app-header--bordered { border-bottom: 1px solid var(--nt-line); }
.app-header__inner { display: flex; align-items: center; justify-content: space-between; gap: 32px; padding-top: 24px; padding-bottom: 24px; }
.app-header__nav { display: flex; align-items: center; gap: 32px; font-size: 0.875rem; line-height: 21px; }
</style>
