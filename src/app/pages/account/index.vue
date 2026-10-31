<script setup>
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Header from "@/app/components/Header.vue";
import StepHeader from "@/app/components/StepHeader.vue";
import Field from "@/app/components/Field.vue";
import GoogleButton from "@/app/components/GoogleButton.vue";
import OrDivider from "@/app/components/OrDivider.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { ROUTES } from "@/app/routes";
import { useAuth } from "@/app/composables/useAuth";
import { useOnboarding } from "@/app/stores/onboarding";
import "@/app/app.css";

defineOptions({ name: "AccountPage" });

const router = useRouter();
const route = useRoute();
const draft = useOnboarding();
const { busy, error, signUp, continueWithGoogle } = useAuth();

const name = ref(draft.name);
const email = ref("");
const password = ref("");
const errors = reactive({ name: "", email: "", password: "" });

function validate() {
  errors.name = name.value.trim() ? "" : "Enter your name.";
  errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? "" : "Enter a valid email address.";
  errors.password = password.value.length >= 8 ? "" : "Use at least 8 characters.";
  return !errors.name && !errors.email && !errors.password;
}

async function submit() {
  if (busy.value) return;
  error.value = "";
  if (!validate()) return;
  draft.name = name.value.trim();
  const to = await signUp({ name: draft.name, email: email.value.trim(), password: password.value });
  if (to) router.push(route.query.code && to === ROUTES.HOUSEHOLD ? { path: to, query: { code: route.query.code } } : to);
}

async function google() {
  if (busy.value) return;
  error.value = "";
  const to = await continueWithGoogle();
  if (to) router.push(route.query.code && to === ROUTES.HOUSEHOLD ? { path: to, query: { code: route.query.code } } : to);
}
</script>

<template>
  <Header>
    <AppLink :to="route.query.code ? { path: ROUTES.SIGN_IN, query: { code: route.query.code } } : ROUTES.SIGN_IN" class="app-text-link--sm">Sign in</AppLink>
  </Header>
  <main class="app-container app-body">
    <div class="account">
      <div class="app-stack app-stack--24 account__intro">
        <StepHeader :step="3" title="Create your account" lead="Use an email you can access on your phone." />
        <p class="app-note">Your wellness responses are private by default. You decide what to share with your partner.</p>
        <AppLink :to="route.query.code ? { path: ROUTES.ROLE, query: { code: route.query.code } } : ROUTES.ROLE" class="app-text-link">Back</AppLink>
      </div>
      <div class="app-stack app-stack--24 account__card">
        <form class="app-stack app-stack--24 w-100" novalidate :aria-busy="busy" @submit.prevent="submit">
          <Field
            id="app-name"
            v-model="name"
            label="Your name"
            placeholder="Jocelyn"
            autocomplete="name"
            :error="errors.name"
            :disabled="busy"
          />
          <Field
            id="app-email"
            v-model="email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            autocomplete="email"
            :error="errors.email"
            :disabled="busy"
          />
          <Field
            id="app-password"
            v-model="password"
            type="password"
            label="Create a password"
            placeholder="••••••••"
            autocomplete="new-password"
            hint="At least 8 characters"
            :minlength="8"
            :error="errors.password"
            :disabled="busy"
          />
          <div v-if="error" class="alert alert-danger app-alert" role="alert">{{ error }}</div>
          <button type="submit" class="app-btn app-btn--primary app-btn--block" :disabled="busy">
            {{ busy ? "Creating account..." : "Create account" }}
          </button>
        </form>
        <OrDivider />
        <GoogleButton :disabled="busy" @click="google" />
        <p class="account__signin">
          <span>Already have an account?</span>
          <AppLink :to="route.query.code ? { path: ROUTES.SIGN_IN, query: { code: route.query.code } } : ROUTES.SIGN_IN" class="app-text-link--sm">Sign in</AppLink>
        </p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.account { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 520px); gap: 64px; align-items: start; }
.account__intro { min-width: 0; }
.account__card { width: 100%; padding: 32px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 12px; }
.account__signin { display: flex; gap: 6px; margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
@media (max-width: 991px) {
  .account { grid-template-columns: minmax(0, 1fr); gap: 32px; }
}
@media (max-width: 575px) { .account__card { padding: 24px 16px; } }
</style>
