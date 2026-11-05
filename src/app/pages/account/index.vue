<script setup>
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AuthShell from "@/app/components/AuthShell.vue";
import StepHeader from "@/app/components/StepHeader.vue";
import Field from "@/app/components/Field.vue";
import GoogleButton from "@/app/components/GoogleButton.vue";
import OrDivider from "@/app/components/OrDivider.vue";
import AppLink from "@/components/ui/AppLink.vue";
import LoadingScreen from "@/app/components/LoadingScreen.vue";
import { useDelayedFlag } from "@/app/composables/useDelayedFlag";
import { ROUTES } from "@/app/routes";
import { useAuth } from "@/app/composables/useAuth";
import { useOnboarding } from "@/app/stores/onboarding";
import "@/app/app.css";

defineOptions({ name: "AccountPage" });

const router = useRouter();
const route = useRoute();
const draft = useOnboarding();
const { busy, error, continueWithGoogle } = useAuth();

const navigating = ref(false);
const working = computed(() => busy.value || navigating.value);
const showLoader = useDelayedFlag(working);
async function go(to) {
  navigating.value = true;
  try {
    await router.push(to);
  } finally {
    navigating.value = false;
  }
}

const name = ref(draft.name);
const email = ref(draft.email);
const password = ref(draft.password);
const errors = reactive({ name: "", email: "", password: "" });

function validate() {
  errors.name = name.value.trim() ? "" : "Enter your name.";
  errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? "" : "Enter a valid email address.";
  errors.password = password.value.length >= 8 ? "" : "Use at least 8 characters.";
  return !errors.name && !errors.email && !errors.password;
}

// Nothing is saved here. The details are kept in memory and the account is created at the last step.
function submit() {
  if (busy.value) return;
  error.value = "";
  if (!validate()) return;
  draft.name = name.value.trim();
  draft.email = email.value.trim();
  draft.password = password.value;
  router.push(route.query.code ? { path: ROUTES.HOUSEHOLD, query: { code: route.query.code } } : ROUTES.HOUSEHOLD);
}

async function google() {
  if (busy.value) return;
  error.value = "";
  const to = await continueWithGoogle({ deferProfile: true });
  if (to) await go(route.query.code && to === ROUTES.HOUSEHOLD ? { path: to, query: { code: route.query.code } } : to);
}
</script>

<template>
  <LoadingScreen v-if="showLoader" variant="overlay" label="Signing you in" subtext="Just a moment." />
  <AuthShell wide>
    <template #nav>
      <AppLink :to="route.query.code ? { path: ROUTES.SIGN_IN, query: { code: route.query.code } } : ROUTES.SIGN_IN" class="app-text-link--sm">Sign in</AppLink>
    </template>
    <div class="account">
      <div class="app-stack app-stack--24 account__intro">
        <StepHeader :step="3" title="Create your account" lead="Use an email you can access on your phone. Nothing is saved until the last step." />
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
            {{ busy ? "Please wait..." : "Continue" }}
          </button>
        </form>
        <OrDivider />
        <GoogleButton :disabled="busy" @click="google" />
        <p class="as__switch">
          <span>Already have an account?</span>
          <AppLink :to="route.query.code ? { path: ROUTES.SIGN_IN, query: { code: route.query.code } } : ROUTES.SIGN_IN" class="app-text-link--sm">Sign in</AppLink>
        </p>
      </div>
    </div>
  </AuthShell>
</template>

<style scoped>
.account { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 440px); gap: 48px; align-items: start; }
.account__intro { min-width: 0; }
.account__card { width: 100%; padding: 22px; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 24px; }
@media (max-width: 991px) {
  .account { grid-template-columns: minmax(0, 1fr); gap: 24px; }
}
@media (max-width: 575px) { .account__card { padding: 18px 14px; } }
</style>
