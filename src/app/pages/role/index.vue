<script setup>
import { useRoute, useRouter } from "vue-router";
import Header from "@/app/components/Header.vue";
import StepHeader from "@/app/components/StepHeader.vue";
import OptionCard from "@/app/components/OptionCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { ROLES, ROUTES } from "@/app/routes";
import { useOnboarding } from "@/app/stores/onboarding";
import "@/app/app.css";

defineOptions({ name: "RolePage" });

const router = useRouter();
const route = useRoute();
const draft = useOnboarding();

const OPTIONS = [
  { value: ROLES[0], title: "Parent", description: "I am one of the baby's parents." },
  { value: ROLES[1], title: "Caregiver", description: "I help care for the baby and have been invited by a parent." },
];

function choose(value) {
  draft.setRole(value);
  router.push(route.query.code ? { path: ROUTES.ACCOUNT, query: { code: route.query.code } } : ROUTES.ACCOUNT);
}
</script>

<template>
  <Header>
    <AppLink :to="route.query.code ? { path: ROUTES.SIGN_IN, query: { code: route.query.code } } : ROUTES.SIGN_IN" class="app-text-link--sm">Sign in</AppLink>
  </Header>
  <main class="app-container app-body">
    <div class="app-stack">
      <StepHeader
        :step="2"
        title="Who will use NurtureTrack?"
        lead="Choose the description that fits you best. You can edit it later."
      />
      <div class="options" role="group" aria-label="Who will use NurtureTrack?">
        <OptionCard
          v-for="o in OPTIONS"
          :key="o.value"
          :title="o.title"
          :description="o.description"
          :selected="draft.role === o.value"
          :radio="false"
          @select="choose(o.value)"
        />
      </div>
      <AppLink :to="route.query.code ? { path: ROUTES.JOURNEY, query: { code: route.query.code } } : ROUTES.JOURNEY" class="app-text-link">Back</AppLink>
    </div>
  </main>
</template>

<style scoped>
.options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; width: 100%; }
.options :deep(.option) { min-height: 168px; padding: 28px; }
.options :deep(.option__title) { font-size: 1.125rem; }
.options :deep(.option__desc) { font-size: 0.9375rem; }
@media (max-width: 767px) {
  .options { grid-template-columns: minmax(0, 1fr); gap: 16px; }
}
</style>
