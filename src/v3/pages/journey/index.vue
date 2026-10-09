<script setup>
import { useRouter } from "vue-router";
import V3Header from "@/v3/components/V3Header.vue";
import StepHeader from "@/v3/components/StepHeader.vue";
import OptionCard from "@/v3/components/OptionCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { V3_JOURNEYS, V3_ROUTES } from "@/v3/routes";
import { useV3Onboarding } from "@/v3/stores/onboarding";
import "@/v3/v3.css";

defineOptions({ name: "V3JourneyPage" });

const router = useRouter();
const draft = useV3Onboarding();

const OPTIONS = [
  { value: V3_JOURNEYS[0], title: "Preparing for baby", description: "I am expecting and want to feel more prepared." },
  { value: V3_JOURNEYS[1], title: "Caring for a newborn", description: "My baby has arrived and I need help coordinating care." },
  { value: V3_JOURNEYS[2], title: "Preparing to return to work", description: "I am planning my transition back to work." },
];

function choose(value) {
  draft.setJourney(value);
  router.push(V3_ROUTES.ROLE);
}
</script>

<template>
  <V3Header>
    <AppLink :to="V3_ROUTES.SIGN_IN" class="v3-text-link--sm">Sign in</AppLink>
  </V3Header>
  <main class="v3-container v3-body">
    <div class="v3-stack">
      <StepHeader
        :step="1"
        title="Where are you in the journey?"
        lead="We will use this to make your first screen more useful. You can change it later."
      />
      <div class="options" role="group" aria-label="Where are you in the journey?">
        <OptionCard
          v-for="o in OPTIONS"
          :key="o.value"
          :title="o.title"
          :description="o.description"
          :selected="draft.journey === o.value"
          :radio="false"
          @select="choose(o.value)"
        />
      </div>
      <AppLink :to="V3_ROUTES.LANDING" class="v3-text-link">Back</AppLink>
    </div>
  </main>
</template>

<style scoped>
.options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; width: 100%; }
@media (max-width: 767px) {
  .options { grid-template-columns: minmax(0, 1fr); gap: 16px; }
}
</style>
