<script setup>
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import StepMarker from "@/components/ui/StepMarker.vue";
import { cancelGoogleSignIn, retryGoogleSignIn } from "./googleFlow";
import { useHouseholdStore } from "@/stores/household";
import { ROUTES } from "@/shared/constants/routes";

defineOptions({ name: "GoogleHandoffPage" });

const router = useRouter();
const household = useHouseholdStore();
const showPrototype = import.meta.env.DEV;

const STEPS = [
  { state: "done", title: "Google window opened", text: "It opens in a separate window or tab." },
  { state: "now", title: "Choose your Google account", text: "Pick the account you want to use for NurtureTrack." },
  { state: "todo", title: "Back here", text: "We bring you straight back and set things up." },
];

function openGoogleAgain() {
  retryGoogleSignIn({ router, household });
}
function cancel() {
  cancelGoogleSignIn(router);
}
// Prototype shortcuts, development builds only.
function returningParent() {
  household.completeOnboarding();
  router.push(ROUTES.HOME);
}
function newAccount() {
  router.push(ROUTES.SETUP_ABOUT);
}
</script>

<template>
  <div class="nt-cols nt-cols--onboarding">
    <div class="nt-col gh__main">
      <div class="gh__title">
        <h1 class="nt-title nt-title--xl">Finish signing in with Google.</h1>
        <p class="nt-lead mb-0">A Google window should have opened. Choose your account there, then come back to this page.</p>
      </div>

      <ol class="nt-card gh__steps" aria-label="Sign in progress" aria-live="polite">
        <li v-for="(s, i) in STEPS" :key="s.title" class="gh__step" :aria-current="s.state === 'now' ? 'step' : undefined">
          <StepMarker :n="i + 1" :state="s.state" />
          <div class="gh__step-text">
            <p class="gh__step-title">{{ s.title }}</p>
            <p class="nt-small nt-muted mb-0">{{ s.text }}</p>
          </div>
        </li>
      </ol>

      <div class="gh__actions">
        <AppLink @click="openGoogleAgain">Window not showing? Open Google again</AppLink>
        <AppButton variant="outline" size="md" @click="cancel">Cancel</AppButton>
      </div>

      <p class="nt-small nt-muted mb-0">
        If nothing opens, your browser may have blocked the pop-up. Allow pop-ups for this site and try again.
      </p>
    </div>

    <aside v-if="showPrototype">
      <AppCard variant="dashed">
        <p class="gh__proto-label">Prototype only</p>
        <p class="gh__proto-text">In the real app this screen moves on by itself once Google confirms. Pick what happens next:</p>
        <div class="gh__proto-actions">
          <AppButton size="lg" @click="returningParent">Returning parent: go to Home</AppButton>
          <AppButton variant="outline" size="lg" @click="newAccount">New account: start setting up</AppButton>
        </div>
      </AppCard>
    </aside>
  </div>
</template>

<style scoped>
.gh__main { gap: 28px; }
.gh__title { display: flex; flex-direction: column; gap: 14px; }
.gh__steps { gap: 20px; margin: 0; list-style: none; }
.gh__step { display: flex; align-items: flex-start; gap: 14px; }
.gh__step-text { display: flex; flex-direction: column; gap: 2px; }
.gh__step-title { margin: 0; font-size: 1rem; font-weight: 500; }
.gh__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 20px; font-size: 0.9375rem; }
.gh__proto-label { margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--nt-muted); }
.gh__proto-text { margin: 0; font-size: 0.9375rem; line-height: 1.45; }
.gh__proto-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
</style>
