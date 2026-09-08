<script setup>
import AppHeader from "@/components/layout/AppHeader.vue";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import { useAuth } from "@/composables/useAuth";

const { isAuthenticated } = useAuth();
</script>

<template>
  <div class="app-layout" :class="{ 'app-layout--public': !isAuthenticated }">
    <AppSidebar v-if="isAuthenticated" />
    <div class="app-layout__content">
      <AppHeader />
      <main class="app-layout__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>
