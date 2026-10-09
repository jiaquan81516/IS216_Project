<script setup>
import { useRouter } from "vue-router";
import V3Header from "@/v3/components/V3Header.vue";
import StepHeader from "@/v3/components/StepHeader.vue";
import OptionCard from "@/v3/components/OptionCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { V3_ROLES, V3_ROUTES } from "@/v3/routes";
import { useV3Onboarding } from "@/v3/stores/onboarding";
import "@/v3/v3.css";

defineOptions({ name: "V3RolePage" });

const router = useRouter();
const draft = useV3Onboarding();

const OPTIONS = [
  { value: V3_ROLES[0], title: "Parent", description: "I am one of the baby's parents." },
  { value: V3_ROLES[1], title: "Partner", description: "I am supporting the primary caregiver." },
  { value: V3_ROLES[2], title: "Family caregiver", description: "I help with the baby's everyday care." },
];

function choose(value) {
  draft.setRole(value);
  router.push(V3_ROUTES.ACCOUNT);
}
</script>

<template>
  <V3Header>
    <AppLink :to="V3_ROUTES.SIGN_IN" class="v3-text-link--sm">Sign in</AppLink>
  </V3Header>
  <main class="v3-container v3-body">
    <div class="v3-stack">
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
      <AppLink :to="V3_ROUTES.JOURNEY" class="v3-text-link">Back</AppLink>
    </div>
  </main>
</template>

<style scoped>
.options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; width: 100%; }
@media (max-width: 767px) {
  .options { grid-template-columns: minmax(0, 1fr); gap: 16px; }
}
</style>
