<script setup>
import { useRoute, useRouter } from "vue-router";
import Header from "@/app/components/Header.vue";
import StepHeader from "@/app/components/StepHeader.vue";
import OptionCard from "@/app/components/OptionCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { JOURNEYS, ROUTES } from "@/app/routes";
import { useOnboarding } from "@/app/stores/onboarding";
import "@/app/app.css";

defineOptions({ name: "JourneyPage" });

const router = useRouter();
const route = useRoute();
const draft = useOnboarding();

const OPTIONS = [
  { value: JOURNEYS[0], title: "Preparing for baby", description: "I am expecting and want to feel more prepared." },
  { value: JOURNEYS[1], title: "Caring for a newborn", description: "My baby has arrived and I need help coordinating care." },
  { value: JOURNEYS[2], title: "Preparing to return to work", description: "I am planning my transition back to work." },
];

function choose(value) {
  draft.setJourney(value);
  router.push(route.query.code ? { path: ROUTES.ROLE, query: { code: route.query.code } } : ROUTES.ROLE);
}
</script>

<template>
  <Header>
    <AppLink :to="route.query.code ? { path: ROUTES.SIGN_IN, query: { code: route.query.code } } : ROUTES.SIGN_IN" class="app-text-link--sm">Sign in</AppLink>
  </Header>
  <main class="app-container app-body">
    <div class="app-stack">
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
      <AppLink :to="ROUTES.LANDING" class="app-text-link">Back</AppLink>
    </div>
  </main>
</template>

<style scoped>
.options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; width: 100%; }
.options :deep(.option) { min-height: 168px; padding: 28px; }
.options :deep(.option__title) { font-size: 1.125rem; }
.options :deep(.option__desc) { font-size: 0.9375rem; }
@media (max-width: 767px) {
  .options { grid-template-columns: minmax(0, 1fr); gap: 16px; }
}
</style>
