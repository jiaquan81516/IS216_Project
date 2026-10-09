<script setup>
import { reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { signInWithEmail, describeAuthError } from "@/v3/api/emailAuth";
import { useAuth } from "@/composables/useAuth";
import { googleError, destinationFor, startGoogleSignIn } from "@/pages/google-handoff/googleFlow";
import { useHouseholdStore } from "@/stores/household";
import { ROUTES } from "@/shared/constants/routes";

defineOptions({ name: "SignInPage" });

const router = useRouter();
const household = useHouseholdStore();

const WAITING = [
  { title: "Tonight", text: "Mei is on call. Next feed around 12 AM." },
  { title: "Care log", text: "Three new entries since you last looked." },
  { title: "Coming up", text: "Baby’s 3-week check on Thursday at 10:30 AM." },
];

const email = ref("");
const password = ref("");

const busy = ref(false);
const formError = ref("");
const errors = reactive({ email: "", password: "" });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// useAuth updates currentUser from onAuthStateChanged; wait for it so the router guard does not bounce us.
async function waitForUser() {
  const { currentUser } = useAuth();
  for (let i = 0; i < 40 && !currentUser.value; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function validate() {
  errors.email = EMAIL.test(email.value.trim()) ? "" : "Enter a valid email address.";
  errors.password = password.value ? "" : "Enter your password.";
  return !errors.email && !errors.password;
}

async function submit() {
  if (busy.value) return;
  formError.value = "";
  googleError.value = "";
  if (!validate()) return;
  busy.value = true;
  try {
    await signInWithEmail({ email: email.value.trim(), password: password.value });
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
  startGoogleSignIn({ router, origin: ROUTES.SIGN_IN, onSuccess: destinationFor(household) });
}
</script>

<template>
  <div class="nt-cols nt-cols--onboarding">
    <div class="nt-col si__main">
      <div class="si__title">
        <h1 class="nt-title nt-title--xl">Welcome back.</h1>
        <p class="nt-lead mb-0">Sign in with your email and password, or with the Google account you used to set up your household.</p>
      </div>

      <form class="au__form" novalidate :aria-busy="busy" @submit.prevent="submit">
        <div class="au__field">
          <label class="form-label" for="si-email">Email address</label>
          <input
            id="si-email"
            v-model="email"
            class="form-control"
            :class="{ 'is-invalid': errors.email }"
            type="email"
            autocomplete="email"
            :disabled="busy"
            :aria-invalid="errors.email ? 'true' : undefined"
            :aria-describedby="errors.email ? 'si-email-error' : undefined"
          />
          <p v-if="errors.email" id="si-email-error" class="au__err" role="alert">{{ errors.email }}</p>
        </div>
        <div class="au__field">
          <label class="form-label" for="si-password">Password</label>
          <input
            id="si-password"
            v-model="password"
            class="form-control"
            :class="{ 'is-invalid': errors.password }"
            type="password"
            autocomplete="current-password"
            :disabled="busy"
            :aria-invalid="errors.password ? 'true' : undefined"
            :aria-describedby="errors.password ? 'si-password-error' : undefined"
          />
          <p v-if="errors.password" id="si-password-error" class="au__err" role="alert">{{ errors.password }}</p>
        </div>
        <div v-if="formError" class="alert alert-danger mb-0" role="alert">{{ formError }}</div>
        <AppButton type="submit" size="lg" :disabled="busy">{{ busy ? "Signing in..." : "Sign in" }}</AppButton>
      </form>

      <p class="au__or" aria-hidden="true">or</p>

      <div class="au__google">
        <div v-if="googleError" class="alert alert-danger mb-0 w-100" role="alert">{{ googleError }}</div>
        <AppButton variant="outline" size="lg" :disabled="busy" @click="continueWithGoogle">Continue with Google</AppButton>
      </div>

      <p class="mb-0 si__row">
        <span class="nt-muted">New here?</span>
        <RouterLink class="nt-link" :to="ROUTES.SIGN_UP">Create your household</RouterLink>
      </p>

      <div class="si__wrong">
        <p class="si__wrong-title">Signed in with the wrong Google account?</p>
        <p class="nt-small nt-muted mb-0">
          Pick a different Google account on the next screen. Your partner joins with their own account, not yours.
        </p>
      </div>

      <AppLink :to="ROUTES.LANDING">Back to the home page</AppLink>
    </div>

    <aside class="nt-card si__waiting" aria-labelledby="waiting-title">
      <h2 id="waiting-title" class="nt-heading nt-heading--sm">Waiting for you</h2>
      <p class="nt-small nt-muted mb-0">What you will see as soon as you are in.</p>
      <template v-for="item in WAITING" :key="item.title">
        <hr class="nt-rule m-0" />
        <div class="si__item">
          <p class="si__item-title">{{ item.title }}</p>
          <p class="nt-small nt-muted mb-0">{{ item.text }}</p>
        </div>
      </template>
    </aside>
  </div>
</template>

<style scoped>
.si__main { gap: 28px; align-items: flex-start; }
.si__title { display: flex; flex-direction: column; gap: 14px; }
.si__row { display: flex; flex-wrap: wrap; gap: 6px; font-size: 0.9375rem; }
.si__wrong { display: flex; flex-direction: column; gap: 6px; }
.si__wrong-title { margin: 0; font-size: 0.9375rem; font-weight: 500; }
.si__waiting { gap: 16px; }
.si__item { display: flex; flex-direction: column; gap: 2px; }
.si__item-title { margin: 0; font-size: 0.9375rem; font-weight: 500; }
.au__form { display: flex; flex-direction: column; gap: 18px; width: 100%; max-width: 460px; }
.au__field { display: flex; flex-direction: column; }
.au__field .form-label { margin-bottom: 0.5rem; }
.au__hint { margin: 6px 0 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.au__err { margin: 6px 0 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-red-t); }
.au__or { display: flex; align-items: center; gap: 12px; width: 100%; max-width: 460px; color: var(--nt-muted); font-size: 0.875rem; }
.au__or::before, .au__or::after { content: ""; flex: 1; height: 1px; background: var(--nt-line); }
.au__google { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; width: 100%; max-width: 460px; }
</style>
