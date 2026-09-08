<script setup>
import { ROUTES } from "@/shared/constants/routes";

const navigationItems = [{ label: "Home", to: ROUTES.DASHBOARD }];
</script>

<template>
  <aside class="app-sidebar" aria-label="Primary navigation">
    <nav>
      <RouterLink
        v-for="item in navigationItems"
        :key="item.to"
        class="app-sidebar__link"
        :to="item.to"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
  </aside>
</template>
