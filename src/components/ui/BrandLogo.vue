<script setup>
import { RouterLink } from "vue-router";
import { ROUTES } from "@/shared/constants/routes";
import { APP_NAME } from "@/shared/constants/appConstants";

defineProps({ to: { type: String, default: ROUTES.HOME } });
</script>

<template>
  <RouterLink :to="to" class="brand" aria-label="NurtureTrack home">
    <img src="/logo.svg" width="32" height="32" alt="" />
    <span class="brand__name">{{ APP_NAME }}</span>
  </RouterLink>
</template>

<style scoped>
.brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: var(--nt-ink); }
.brand__name { font-family: var(--nt-serif); font-size: 1.5rem; line-height: 1.2; letter-spacing: -0.01em; }
</style>
