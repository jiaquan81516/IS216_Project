<script setup>
import { reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppLink from "@/components/ui/AppLink.vue";
import StepMarker from "@/components/ui/StepMarker.vue";
import { signUpWithEmail, describeAuthError } from "@/v3/api/emailAuth";
import { useAuth } from "@/composables/useAuth";
import { googleError, destinationFor, startGoogleSignIn } from "@/pages/google-handoff/googleFlow";
import { useHouseholdStore } from "@/stores/household";
import { ROUTES } from "@/shared/constants/routes";

defineOptions({ name: "SignUpPage" });

const router = useRouter();
const household = useHouseholdStore();

const STEPS = ["Create your account", "Tell us about you", "Add your baby", "Invite your partner", "Set the nights and alerts"];

const name = ref("");
const email = ref("");
const password = ref("");

const busy = ref(false);
const formError = ref("");
const errors = reactive({ name: "", email: "", password: "" });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// useAuth updates currentUser from onAuthStateChanged; wait for it so the router guard does not bounce us.
async function waitForUser() {
  const { currentUser } = useAuth();
  for (let i = 0; i < 40 && !currentUser.value; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function validate() {
  errors.name = name.value.trim() ? "" : "Enter your name.";
  errors.email = EMAIL.test(email.value.trim()) ? "" : "Enter a valid email address.";
  errors.password = password.value.length >= 8 ? "" : "Use at least 8 characters.";
  return !errors.name && !errors.email && !errors.password;
}

async function submit() {
  if (busy.value) return;
  formError.value = "";
  googleError.value = "";
  if (!validate()) return;
  busy.value = true;
  try {
    await signUpWithEmail({ name: name.value.trim(), email: email.value.trim(), password: password.value });
    household.displayName = name.value.trim();
    await waitForUser();
    await router.push(destinationFor(household)());
  } catch (error) {
    formError.value = describeAuthError(error);
  } finally {
    busy.value = false;
  }
}

function continueWithGoogle() {
  formError.value = "";
  startGoogleSignIn({ router, origin: ROUTES.SIGN_UP, onSuccess: destinationFor(household) });
}
</script>

<template>
  <div class="nt-cols nt-cols--onboarding">
    <div class="nt-col su__main">
      <div class="su__title">
        <h1 class="nt-title nt-title--xl">Create your household.</h1>
        <p class="nt-lead mb-0">One account each, linked together. You will invite your partner in a few steps.</p>
      </div>

      <form class="au__form" novalidate :aria-busy="busy" @submit.prevent="submit">
        <div class="au__field">
          <label class="form-label" for="su-name">Your name</label>
          <input
            id="su-name"
            v-model="name"
            class="form-control"
            :class="{ 'is-invalid': errors.name }"
            type="text"
            autocomplete="name"
            :disabled="busy"
            :aria-invalid="errors.name ? 'true' : undefined"
            :aria-describedby="errors.name ? 'su-name-error' : undefined"
          />
          <p v-if="errors.name" id="su-name-error" class="au__err" role="alert">{{ errors.name }}</p>
        </div>
        <div class="au__field">
          <label class="form-label" for="su-email">Email address</label>
          <input
            id="su-email"
            v-model="email"
            class="form-control"
            :class="{ 'is-invalid': errors.email }"
            type="email"
            autocomplete="email"
            :disabled="busy"
            :aria-invalid="errors.email ? 'true' : undefined"
            :aria-describedby="errors.email ? 'su-email-error' : undefined"
          />
          <p v-if="errors.email" id="su-email-error" class="au__err" role="alert">{{ errors.email }}</p>
        </div>
        <div class="au__field">
          <label class="form-label" for="su-password">Create a password</label>
          <input
            id="su-password"
            v-model="password"
            class="form-control"
            :class="{ 'is-invalid': errors.password }"
            type="password"
            autocomplete="new-password"
            :disabled="busy"
            :aria-invalid="errors.password ? 'true' : undefined"
            :aria-describedby="errors.password ? 'su-password-error' : 'su-password-hint'"
          />
          <p v-if="!errors.password" id="su-password-hint" class="au__hint">At least 8 characters</p>
          <p v-if="errors.password" id="su-password-error" class="au__err" role="alert">{{ errors.password }}</p>
        </div>
        <div v-if="formError" class="alert alert-danger mb-0" role="alert">{{ formError }}</div>
        <AppButton type="submit" size="lg" :disabled="busy">{{ busy ? "Creating account..." : "Create account" }}</AppButton>
      </form>

      <p class="au__or" aria-hidden="true">or</p>

      <div class="au__google">
        <div v-if="googleError" class="alert alert-danger mb-0 w-100" role="alert">{{ googleError }}</div>
        <AppButton variant="outline" size="lg" :disabled="busy" @click="continueWithGoogle">Continue with Google</AppButton>
        <p class="nt-small nt-muted mb-0">With Google we only read your name and email. We never post anything.</p>
      </div>

      <div class="su__links">
        <p class="mb-0 su__row">
          <span class="nt-muted">Already have an account?</span>
          <RouterLink class="nt-link" :to="ROUTES.SIGN_IN">Sign in</RouterLink>
        </p>
        <AppLink :to="ROUTES.LANDING" muted>Back to the home page</AppLink>
      </div>
    </div>

    <aside class="nt-card su__next" aria-labelledby="next-title">
      <h2 id="next-title" class="nt-heading nt-heading--sm">What happens next</h2>
      <ol class="su__steps">
        <li v-for="(label, i) in STEPS" :key="label" class="su__step">
          <StepMarker :n="i + 1" :state="i === 0 ? 'now' : 'todo'" />
          <div>
            <p class="su__step-label" :class="{ 'su__step-label--now': i === 0 }">{{ label }}</p>
            <p v-if="i === 0" class="nt-small nt-muted mb-0">You are here</p>
          </div>
        </li>
      </ol>
    </aside>
  </div>
</template>

<style scoped>
.su__main { gap: 28px; }
.su__title { display: flex; flex-direction: column; gap: 14px; }
.su__links { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; font-size: 0.9375rem; }
.su__row { display: flex; flex-wrap: wrap; gap: 6px; }
.su__next { gap: 14px; }
.su__steps { display: flex; flex-direction: column; gap: 14px; margin: 0; padding: 0; list-style: none; }
.su__step { display: flex; align-items: center; gap: 12px; }
.su__step-label { margin: 0; font-size: 1rem; font-weight: 500; color: var(--nt-muted); }
.su__step-label--now { font-weight: 600; color: var(--nt-ink); }
.au__form { display: flex; flex-direction: column; gap: 18px; width: 100%; max-width: 460px; }
.au__field { display: flex; flex-direction: column; }
.au__field .form-label { margin-bottom: 0.5rem; }
.au__hint { margin: 6px 0 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.au__err { margin: 6px 0 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-red-t); }
.au__or { display: flex; align-items: center; gap: 12px; width: 100%; max-width: 460px; color: var(--nt-muted); font-size: 0.875rem; }
.au__or::before, .au__or::after { content: ""; flex: 1; height: 1px; background: var(--nt-line); }
.au__google { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; width: 100%; max-width: 460px; }
</style>
