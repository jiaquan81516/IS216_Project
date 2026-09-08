<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth";
import { APP_NAME } from "@/shared/constants/appConstants";

const router = useRouter();
const { currentUser, isAuthenticated, loading, logout } = useAuth();
const logoutError = ref("");

async function handleLogout() {
  logoutError.value = "";
  try {
    await logout();
    await router.push({ name: "login" });
  } catch {
    logoutError.value = "Unable to sign out. Please try again.";
  }
}
</script>

<template>
  <header class="app-header">
    <RouterLink class="app-header__brand" to="/">
      <h1>{{ APP_NAME }}</h1>
    </RouterLink>
    <div v-if="isAuthenticated" class="app-header__account">
      <span>{{ currentUser?.displayName || currentUser?.email }}</span>
      <button type="button" :disabled="loading" @click="handleLogout">
        Sign out
      </button>
    </div>
    <p v-if="logoutError" class="app-header__error" role="alert">
      {{ logoutError }}
    </p>
  </header>
</template>

<style scoped>
h1 {
  margin: 0;
  font-size: 1.125rem;
}
.app-header__account {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}
.app-header__error {
  margin: 0 0 0 1rem;
  color: #a52834;
}
</style>
