<script setup>
import { RouterLink, RouterView, useRoute } from "vue-router";
import BrandLogo from "@/components/ui/BrandLogo.vue";
import { useAuth } from "@/composables/useAuth";
import { ROUTES } from "@/shared/constants/routes";

const route = useRoute();
const { currentUser, logout } = useAuth();
</script>

<template>
  <div class="auth">
    <header class="auth__bar">
      <div class="nt-container auth__bar-inner">
        <BrandLogo :to="ROUTES.LANDING" />
        <p v-if="route.meta.authHeader === 'signup'" class="auth__right">
          <span class="nt-muted">Already have an account?</span>
          <RouterLink class="nt-link" :to="ROUTES.SIGN_IN">Sign in</RouterLink>
        </p>
        <p v-else-if="route.meta.authHeader === 'signin'" class="auth__right">
          <span class="nt-muted">New here?</span>
          <RouterLink class="nt-link" :to="ROUTES.SIGN_UP">Create your household</RouterLink>
        </p>
        <p v-else-if="route.meta.authHeader === 'user'" class="auth__right">
          <span class="nt-muted">Signed in as {{ currentUser?.email || "daniel.tan@gmail.com" }}.</span>
          <button type="button" class="nt-link" @click="logout()">Not you?</button>
        </p>
        <p v-else-if="route.meta.authHeader === 'invite'" class="auth__right nt-muted">Invitation link for Mei</p>
        <p v-else-if="route.meta.authHeader === 'google'" class="auth__right nt-muted">Signing in with Google</p>
      </div>
    </header>
    <main class="nt-container auth__main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.auth__bar { border-bottom: 1px solid var(--nt-line); }
.auth__bar-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 90px; }
.auth__right { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; font-size: 0.875rem; }
.auth__main { padding-top: 64px; padding-bottom: 96px; }
</style>
