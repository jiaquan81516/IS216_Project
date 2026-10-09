<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import V3Header from "@/v3/components/V3Header.vue";
import V3Field from "@/v3/components/V3Field.vue";
import GoogleButton from "@/v3/components/GoogleButton.vue";
import OrDivider from "@/v3/components/OrDivider.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { V3_ROUTES } from "@/v3/routes";
import { useV3Auth } from "@/v3/composables/useV3Auth";
import "@/v3/v3.css";

defineOptions({ name: "V3SignInPage" });

const router = useRouter();
const { busy, error, signIn, continueWithGoogle } = useV3Auth();

const email = ref("");
const password = ref("");
const errors = reactive({ email: "", password: "" });

function validate() {
  errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? "" : "Enter a valid email address.";
  errors.password = password.value ? "" : "Enter your password.";
  return !errors.email && !errors.password;
}

async function submit() {
  if (busy.value) return;
  error.value = "";
  if (!validate()) return;
  const to = await signIn({ email: email.value.trim(), password: password.value });
  if (to) router.push(to);
}

async function google() {
  if (busy.value) return;
  error.value = "";
  const to = await continueWithGoogle();
  if (to) router.push(to);
}
</script>

<template>
  <V3Header />
  <main class="v3-container v3-body">
    <div class="v3-stack v3-stack--24 signin">
      <div class="signin__title">
        <h1 class="signin__h1">Sign in</h1>
        <p class="signin__lead">Welcome back.</p>
      </div>
      <form class="v3-stack v3-stack--24 w-100" novalidate :aria-busy="busy" @submit.prevent="submit">
        <V3Field
          id="v3-signin-email"
          v-model="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          autocomplete="email"
          :error="errors.email"
          :disabled="busy"
        />
        <V3Field
          id="v3-signin-password"
          v-model="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          autocomplete="current-password"
          :error="errors.password"
          :disabled="busy"
        />
        <div v-if="error" class="alert alert-danger v3-alert" role="alert">{{ error }}</div>
        <button type="submit" class="v3-btn v3-btn--primary v3-btn--block" :disabled="busy">
          {{ busy ? "Signing in..." : "Sign in" }}
        </button>
      </form>
      <OrDivider />
      <GoogleButton :disabled="busy" @click="google" />
      <p class="signin__new">
        <span>New here?</span>
        <AppLink :to="V3_ROUTES.JOURNEY" class="v3-text-link--sm">Create your household</AppLink>
      </p>
      <AppLink :to="V3_ROUTES.LANDING" class="v3-text-link">Back</AppLink>
    </div>
  </main>
</template>

<style scoped>
.signin { width: 480px; max-width: 100%; }
.signin__title { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.signin__h1 { margin: 0; font-family: var(--nt-serif); font-weight: 400; font-size: 36px; line-height: 44px; letter-spacing: -0.36px; color: var(--nt-ink); }
.signin__lead { margin: 0; font-size: 17px; line-height: 26px; color: var(--nt-muted); }
.signin__new { display: flex; gap: 6px; margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
</style>
