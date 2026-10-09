<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import ChoiceChips from "@/components/ui/ChoiceChips.vue";
import ChoiceRow from "@/components/ui/ChoiceRow.vue";
import StepperBar from "@/components/ui/StepperBar.vue";
import YoursAlone from "@/components/ui/YoursAlone.vue";
import { useAuth } from "@/composables/useAuth";
import { CONFIDENCE_OPTIONS, ROLE_OPTIONS } from "@/data/setupAbout";
import { SAMPLE } from "@/shared/constants/appConstants";
import { ROUTES } from "@/shared/constants/routes";
import { useHouseholdStore } from "@/stores/household";

defineOptions({ name: "setup-aboutPage" });

const household = useHouseholdStore();
const router = useRouter();
const { currentUser } = useAuth();

// Start from the Google account name unless the parent already changed it.
onMounted(() => {
  const google = currentUser.value?.displayName;
  if (google && !household.onboarded && household.displayName === SAMPLE.me) {
    household.displayName = google;
  }
});

function next() {
  router.push(ROUTES.SETUP_BABY);
}
</script>

<template>
  <div class="nt-cols nt-cols--onboarding">
    <form class="nt-col about" novalidate @submit.prevent="next">
      <StepperBar :current="1" />
      <div class="about__title">
        <h1 class="nt-title nt-title--xl">Tell us about you.</h1>
        <p class="nt-lead mb-0">So the app talks to you properly, and tells you what to do next.</p>
      </div>

      <div class="about__field">
        <label class="about__label" for="about-name">What should we call you?</label>
        <input
          id="about-name"
          v-model="household.displayName"
          class="form-control about__input"
          type="text"
          autocomplete="given-name"
        />
        <p class="nt-muted mb-0">Taken from your Google account. Change it if you like.</p>
      </div>

      <div class="about__field" role="radiogroup" aria-labelledby="about-role">
        <p id="about-role" class="about__label mb-0">Which describes you?</p>
        <ChoiceRow
          v-for="r in ROLE_OPTIONS"
          :key="r.value"
          v-model="household.role"
          name="role"
          :value="r.value"
          :title="r.title"
          :description="r.description"
        />
      </div>

      <YoursAlone>
        <p class="about__q mb-0" id="about-confidence">How confident do you feel looking after a newborn?</p>
        <p class="mb-0">Your partner never sees this. It only shapes the guidance you get.</p>
        <ChoiceChips
          v-model="household.confidence"
          variant="tinted"
          :options="CONFIDENCE_OPTIONS"
          aria-label="How confident do you feel looking after a newborn?"
        />
      </YoursAlone>

      <div>
        <AppButton type="submit">Continue</AppButton>
      </div>
    </form>

    <aside class="nt-col">
      <AppCard title="Why we ask for your role">
        <p class="about__aside mb-0">
          Your role sets which side of the night rota you start on and how the guidance is worded. You can change it
          later in Profile.
        </p>
      </AppCard>
    </aside>
  </div>
</template>

<style scoped>
.about {
  gap: 28px;
}
.about__title {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.about__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.about__field[role="radiogroup"] {
  gap: 12px;
}
.about__label {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--nt-ink);
}
.about__input {
  padding: 20px;
  font-weight: 500;
}
.about__q {
  font-size: 1.125rem;
  font-weight: 500;
  line-height: 1.45;
}
.about__aside {
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--nt-muted);
}
</style>
