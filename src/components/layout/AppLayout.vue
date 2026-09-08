<script setup>
import AppHeader from "@/components/layout/AppHeader.vue";
import AppSidebar from "@/components/layout/AppSidebar.vue";
</script>

<template>
  <div class="app-layout">
    <AppSidebar />
    <div class="app-layout__content">
      <AppHeader />
      <main class="app-layout__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>
