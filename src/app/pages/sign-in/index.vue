<script setup>
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AuthShell from "@/app/components/AuthShell.vue";
import Field from "@/app/components/Field.vue";
import GoogleButton from "@/app/components/GoogleButton.vue";
import OrDivider from "@/app/components/OrDivider.vue";
import AppLink from "@/components/ui/AppLink.vue";
import LoadingScreen from "@/app/components/LoadingScreen.vue";
import { useDelayedFlag } from "@/app/composables/useDelayedFlag";
import { ROUTES } from "@/app/routes";
import { SIGN_IN_MESSAGES, WELCOME_MS, waitUntil } from "@/app/utils/pause";
import { useAuth } from "@/app/composables/useAuth";
import "@/app/app.css";

defineOptions({ name: "SignInPage" });

const router = useRouter();
const route = useRoute();
const { busy, error, signIn, continueWithGoogle } = useAuth();

// The loading screen stays up through the move to the next page, so there is no blank gap.
const navigating = ref(false);
const welcome = ref(false); // the longer "getting ready" screen after a successful sign in
const working = computed(() => busy.value || navigating.value || welcome.value);
const showLoader = useDelayedFlag(working);
async function go(to, startedAt = Date.now()) {
  navigating.value = true;
  welcome.value = true;
  try {
    await waitUntil(startedAt, WELCOME_MS);
    await router.push(route.query.code && to === ROUTES.HOUSEHOLD ? { path: to, query: { code: route.query.code } } : to);
  } finally {
    navigating.value = false;
    welcome.value = false;
  }
}

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
  const startedAt = Date.now();
  const to = await signIn({ email: email.value.trim(), password: password.value });
  if (to) await go(to, startedAt);
}

async function google() {
  if (busy.value) return;
  error.value = "";
  const startedAt = Date.now();
  const to = await continueWithGoogle();
  if (to) await go(to, startedAt);
}
</script>

<template>
  <LoadingScreen v-if="showLoader || welcome" variant="overlay" label="Signing you in" :messages="welcome ? SIGN_IN_MESSAGES : []" subtext="Welcome back." />
  <AuthShell split>
    <template #side>
      <div>
        <h2 class="signin__side-h">Welcome back.</h2>
        <p class="signin__side-p">Catch up on what your partner logged and get ready for the next handover.</p>
      </div>
    </template>
    <div class="signin__title">
      <h1 class="signin__h1">Sign in</h1>
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
    <p class="as__switch">
      <span>New here?</span>
      <AppLink :to="route.query.code ? { path: ROUTES.JOURNEY, query: { code: route.query.code } } : ROUTES.JOURNEY" class="app-text-link--sm">Create your household</AppLink>
    </p>
    <AppLink :to="ROUTES.LANDING" class="app-text-link">Back</AppLink>
  </AuthShell>
</template>

<style scoped>
.signin__title { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.signin__h1 { margin: 0; font-family: var(--nt-serif); font-weight: 700; font-size: 2.125rem; line-height: 1.15; color: var(--ink, #1f2a52); }
.signin__side-h { margin: 0 0 12px; font-family: var(--nt-serif); font-size: 2.125rem; line-height: 1.1; font-weight: 700; color: #fff; }
.signin__side-p { margin: 0; color: #dfe5f7; line-height: 1.5; }
</style>
