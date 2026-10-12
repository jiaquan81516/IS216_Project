<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Header from "@/app/components/Header.vue";
import Field from "@/app/components/Field.vue";
import GoogleButton from "@/app/components/GoogleButton.vue";
import OrDivider from "@/app/components/OrDivider.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { ROUTES } from "@/app/routes";
import { useAuth } from "@/app/composables/useAuth";
import "@/app/app.css";

defineOptions({ name: "SignInPage" });

const router = useRouter();
const { busy, error, signIn, continueWithGoogle } = useAuth();

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
  <Header full />
  <main class="app-container app-body signin-wrap">
    <div class="app-stack app-stack--24 signin">
      <div class="signin__title">
        <h1 class="signin__h1">Sign in</h1>
        <p class="signin__lead">Welcome back.</p>
      </div>
      <form class="app-stack app-stack--24 w-100" novalidate :aria-busy="busy" @submit.prevent="submit">
        <Field
          id="app-signin-email"
          v-model="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          autocomplete="email"
          :error="errors.email"
          :disabled="busy"
        />
        <Field
          id="app-signin-password"
          v-model="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          autocomplete="current-password"
          :error="errors.password"
          :disabled="busy"
        />
        <div v-if="error" class="alert alert-danger app-alert" role="alert">{{ error }}</div>
        <button type="submit" class="app-btn app-btn--primary app-btn--block" :disabled="busy">
          {{ busy ? "Signing in..." : "Sign in" }}
        </button>
      </form>
      <OrDivider />
      <GoogleButton :disabled="busy" @click="google" />
      <p class="signin__new">
        <span>New here?</span>
        <AppLink :to="ROUTES.JOURNEY" class="app-text-link--sm">Create your household</AppLink>
      </p>
      <AppLink :to="ROUTES.LANDING" class="app-text-link">Back</AppLink>
    </div>
  </main>
</template>

<style scoped>
.signin-wrap { display: flex; justify-content: center; align-items: flex-start; padding-top: clamp(32px, 8vh, 96px); padding-bottom: 64px; }
.signin { width: 480px; max-width: 100%; box-sizing: border-box; padding: 40px; background: #fff; border: 1px solid var(--nt-line, #e5e7eb); border-radius: 12px; }
.signin :deep(.app-btn--outline) { color: var(--nt-ink); }
@media (max-width: 575px) { .signin { padding: 24px 20px; } }
.signin__title { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.signin__h1 { margin: 0; font-family: var(--nt-serif); font-weight: 400; font-size: 36px; line-height: 44px; letter-spacing: -0.36px; color: var(--nt-ink); }
.signin__lead { margin: 0; font-size: 17px; line-height: 26px; color: var(--nt-muted); }
.signin__new { display: flex; gap: 6px; margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
</style>
