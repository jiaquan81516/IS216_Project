<script setup>
import "@/v3/v3.css";
import BrandLogo from "@/components/ui/BrandLogo.vue";
import { V3_ROUTES } from "@/v3/routes";

defineProps({ bordered: { type: Boolean, default: true } });
</script>

<template>
  <header class="v3-header" :class="{ 'v3-header--bordered': bordered }">
    <div class="v3-container v3-header__inner">
      <BrandLogo :to="V3_ROUTES.LANDING" />
      <nav v-if="$slots.default" class="v3-header__nav" aria-label="Main"><slot /></nav>
    </div>
  </header>
</template>

<style scoped>
.v3-header--bordered { border-bottom: 1px solid var(--nt-line); }
.v3-header__inner { display: flex; align-items: center; justify-content: space-between; gap: 32px; padding-top: 24px; padding-bottom: 24px; }
.v3-header__nav { display: flex; align-items: center; gap: 32px; font-size: 0.875rem; line-height: 21px; }
</style>
