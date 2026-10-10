<script setup>
import { useRouter } from "vue-router";
import Header from "@/app/components/Header.vue";
import StepHeader from "@/app/components/StepHeader.vue";
import OptionCard from "@/app/components/OptionCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { ROLES, ROUTES } from "@/app/routes";
import { useOnboarding } from "@/app/stores/onboarding";
import "@/app/app.css";

defineOptions({ name: "RolePage" });

const router = useRouter();
const draft = useOnboarding();

const OPTIONS = [
  { value: ROLES[0], title: "Parent", description: "I am one of the baby's parents." },
  { value: ROLES[1], title: "Partner", description: "I am supporting the primary caregiver." },
  { value: ROLES[2], title: "Family caregiver", description: "I help with the baby's everyday care." },
];

function choose(value) {
  draft.setRole(value);
  router.push(ROUTES.ACCOUNT);
}
</script>

<template>
  <Header>
    <AppLink :to="ROUTES.SIGN_IN" class="app-text-link--sm">Sign in</AppLink>
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
      <AppLink :to="ROUTES.JOURNEY" class="app-text-link">Back</AppLink>
    </div>
  </main>
</template>

<style scoped>
.options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; width: 100%; }
@media (max-width: 767px) {
  .options { grid-template-columns: minmax(0, 1fr); gap: 16px; }
}
</style>
