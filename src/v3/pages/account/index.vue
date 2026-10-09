<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import V3Header from "@/v3/components/V3Header.vue";
import StepHeader from "@/v3/components/StepHeader.vue";
import V3Field from "@/v3/components/V3Field.vue";
import GoogleButton from "@/v3/components/GoogleButton.vue";
import OrDivider from "@/v3/components/OrDivider.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { V3_ROUTES } from "@/v3/routes";
import { useV3Auth } from "@/v3/composables/useV3Auth";
import { useV3Onboarding } from "@/v3/stores/onboarding";
import "@/v3/v3.css";

defineOptions({ name: "V3AccountPage" });

const router = useRouter();
const draft = useV3Onboarding();
const { busy, error, signUp, continueWithGoogle } = useV3Auth();

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
  <V3Header>
    <AppLink :to="V3_ROUTES.SIGN_IN" class="v3-text-link--sm">Sign in</AppLink>
  </V3Header>
  <main class="v3-container v3-body">
    <div class="v3-stack v3-stack--24 account">
      <StepHeader :step="3" title="Create your account" lead="Use an email you can access on your phone." />
      <form class="v3-stack v3-stack--24 w-100" novalidate :aria-busy="busy" @submit.prevent="submit">
        <V3Field
          id="v3-name"
          v-model="name"
          label="Your name"
          placeholder="Jocelyn"
          autocomplete="name"
          :error="errors.name"
          :disabled="busy"
        />
        <V3Field
          id="v3-email"
          v-model="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          autocomplete="email"
          :error="errors.email"
          :disabled="busy"
        />
        <V3Field
          id="v3-password"
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
        <div v-if="error" class="alert alert-danger v3-alert" role="alert">{{ error }}</div>
        <button type="submit" class="v3-btn v3-btn--primary v3-btn--block" :disabled="busy">
          {{ busy ? "Creating account..." : "Create account" }}
        </button>
      </form>
      <OrDivider />
      <GoogleButton :disabled="busy" @click="google" />
      <p class="v3-note">Your wellness responses are private by default. You decide what to share with your partner.</p>
      <div class="account__foot">
        <AppLink :to="V3_ROUTES.ROLE" class="v3-text-link">Back</AppLink>
        <p class="account__signin">
          <span>Already have an account?</span>
          <AppLink :to="V3_ROUTES.SIGN_IN" class="v3-text-link--sm">Sign in</AppLink>
        </p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.account { width: 480px; max-width: 100%; }
.account__foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; }
.account__signin { display: flex; gap: 6px; margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
</style>
