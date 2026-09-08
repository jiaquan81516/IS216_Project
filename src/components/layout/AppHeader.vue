<script setup>
import { APP_NAME } from "@/shared/constants/appConstants";
</script>

<template>
  <header class="app-header">
    <RouterLink class="app-header__brand" to="/">
      <h1>You did it!</h1>
      <span class="visually-hidden">{{ APP_NAME }}</span>
    </RouterLink>
  </header>
</template>

<style scoped>
h1 {
  margin: 0;
  font-size: 1.125rem;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
