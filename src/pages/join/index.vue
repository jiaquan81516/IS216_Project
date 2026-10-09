<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import YoursAlone from "@/components/ui/YoursAlone.vue";
import { signUpWithEmail, describeAuthError } from "@/v3/api/emailAuth";
import { useAuth } from "@/composables/useAuth";
import { googleError, startGoogleSignIn } from "@/pages/google-handoff/googleFlow";
import { useHouseholdStore } from "@/stores/household";
import { ROUTES } from "@/shared/constants/routes";

defineOptions({ name: "JoinPage" });

const router = useRouter();
const household = useHouseholdStore();

// Placeholder invite details until Firestore is connected.
const DETAILS = [
  ["Household", "Aria"],
  ["Born", "15 Sep 2026"],
  ["Invited by", "Daniel"],
  ["Link expires", "13 Oct"],
];
const SHARED = ["The care log and handover notes", "The night rota, swaps and overrides", "The shared calendar"];

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
    household.completeOnboarding();
    await waitForUser();
    await router.push(ROUTES.HOME);
  } catch (error) {
    formError.value = describeAuthError(error);
  } finally {
    busy.value = false;
  }
}

function continueWithGoogle() {
  formError.value = "";
  startGoogleSignIn({
    router,
    origin: router.currentRoute.value.fullPath,
    onSuccess: () => {
      household.completeOnboarding();
      return ROUTES.HOME;
    },
  });
}
</script>

<template>
  <div class="nt-cols nt-cols--onboarding">
    <div class="nt-col jn__main">
      <div class="jn__title">
        <h1 class="nt-title nt-title--xl">Daniel invited you to look after Aria together.</h1>
        <p class="nt-lead mb-0">
          Create your account to join the same household. You will both see the same care log, night rota and calendar.
        </p>
      </div>

      <form class="au__form" novalidate :aria-busy="busy" @submit.prevent="submit">
        <div class="au__field">
          <label class="form-label" for="jn-name">Your name</label>
          <input
            id="jn-name"
            v-model="name"
            class="form-control"
            :class="{ 'is-invalid': errors.name }"
            type="text"
            autocomplete="name"
            :disabled="busy"
            :aria-invalid="errors.name ? 'true' : undefined"
            :aria-describedby="errors.name ? 'jn-name-error' : undefined"
          />
          <p v-if="errors.name" id="jn-name-error" class="au__err" role="alert">{{ errors.name }}</p>
        </div>
        <div class="au__field">
          <label class="form-label" for="jn-email">Email address</label>
          <input
            id="jn-email"
            v-model="email"
            class="form-control"
            :class="{ 'is-invalid': errors.email }"
            type="email"
            autocomplete="email"
            :disabled="busy"
            :aria-invalid="errors.email ? 'true' : undefined"
            :aria-describedby="errors.email ? 'jn-email-error' : undefined"
          />
          <p v-if="errors.email" id="jn-email-error" class="au__err" role="alert">{{ errors.email }}</p>
        </div>
        <div class="au__field">
          <label class="form-label" for="jn-password">Create a password</label>
          <input
            id="jn-password"
            v-model="password"
            class="form-control"
            :class="{ 'is-invalid': errors.password }"
            type="password"
            autocomplete="new-password"
            :disabled="busy"
            :aria-invalid="errors.password ? 'true' : undefined"
            :aria-describedby="errors.password ? 'jn-password-error' : 'jn-password-hint'"
          />
          <p v-if="!errors.password" id="jn-password-hint" class="au__hint">At least 8 characters</p>
          <p v-if="errors.password" id="jn-password-error" class="au__err" role="alert">{{ errors.password }}</p>
        </div>
        <div v-if="formError" class="alert alert-danger mb-0" role="alert">{{ formError }}</div>
        <AppButton type="submit" size="lg" :disabled="busy">{{ busy ? "Joining..." : "Join the household" }}</AppButton>
      </form>

      <p class="au__or" aria-hidden="true">or</p>

      <div class="au__google">
        <div v-if="googleError" class="alert alert-danger mb-0 w-100" role="alert">{{ googleError }}</div>
        <AppButton variant="outline" size="lg" :disabled="busy" @click="continueWithGoogle">Continue with Google</AppButton>
        <p class="nt-small nt-muted mb-0 jn__fine">
          We only receive your name, email address and profile photo. After you join, setup takes about a minute.
        </p>
      </div>

      <AppLink :to="ROUTES.LANDING">This is not for me</AppLink>
    </div>

    <aside class="nt-col">
      <AppCard title="Household">
        <dl class="jn__details">
          <div v-for="[label, value] in DETAILS" :key="label" class="jn__detail">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </div>
        </dl>
      </AppCard>

      <AppCard title="What you will share">
        <ul class="jn__shared">
          <li v-for="item in SHARED" :key="item"><span class="nt-muted" aria-hidden="true">–</span>{{ item }}</li>
        </ul>
      </AppCard>

      <YoursAlone>
        <p class="jn__private">Your check-ins stay private. Daniel can never open them, and you cannot open his.</p>
      </YoursAlone>
    </aside>
  </div>
</template>

<style scoped>
.jn__main { gap: 28px; align-items: flex-start; }
.jn__title { display: flex; flex-direction: column; gap: 14px; }
.jn__fine { max-width: 460px; }
.jn__details { display: flex; flex-direction: column; gap: 12px; margin: 0; font-size: 0.9375rem; }
.jn__detail { display: flex; justify-content: space-between; gap: 16px; }
.jn__detail dt { font-weight: 400; color: var(--nt-muted); }
.jn__detail dd { margin: 0; font-weight: 500; color: var(--nt-ink); }
.jn__shared { display: flex; flex-direction: column; gap: 16px; margin: 0; padding: 0; list-style: none; font-size: 0.9375rem; line-height: 1.45; }
.jn__shared li { display: flex; gap: 10px; }
.jn__private { margin: 0; font-size: 0.9375rem; line-height: 1.45; }
.au__form { display: flex; flex-direction: column; gap: 18px; width: 100%; max-width: 460px; }
.au__field { display: flex; flex-direction: column; }
.au__field .form-label { margin-bottom: 0.5rem; }
.au__hint { margin: 6px 0 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.au__err { margin: 6px 0 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-red-t); }
.au__or { display: flex; align-items: center; gap: 12px; width: 100%; max-width: 460px; color: var(--nt-muted); font-size: 0.875rem; }
.au__or::before, .au__or::after { content: ""; flex: 1; height: 1px; background: var(--nt-line); }
.au__google { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; width: 100%; max-width: 460px; }
</style>
