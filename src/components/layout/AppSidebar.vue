<script setup>
import { ROUTES } from "@/shared/constants/routes";

const navigationItems = [
  { label: "Home", to: ROUTES.DASHBOARD },
  { label: "Calendar", to: ROUTES.CALENDAR },
  { label: "Insights", to: ROUTES.INSIGHTS },
  { label: "Wellness", to: ROUTES.WELLNESS },
  { label: "Resources", to: ROUTES.RESOURCES },
  { label: "Shared Care", to: ROUTES.SHARED_CARE },
];
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
