<script setup>
import { useRoute, useRouter } from "vue-router";
import AuthShell from "@/app/components/AuthShell.vue";
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
  { value: ROLES[0], title: "Parent", icon: "heart", description: "I am one of the baby's parents." },
  { value: ROLES[1], title: "Caregiver", icon: "users", description: "I help care for the baby and have been invited by a parent." },
];

function choose(value) {
  draft.setRole(value);
  router.push(route.query.code ? { path: ROUTES.ACCOUNT, query: { code: route.query.code } } : ROUTES.ACCOUNT);
}
</script>

<template>
  <AuthShell>
    <template #nav>
      <AppLink :to="route.query.code ? { path: ROUTES.SIGN_IN, query: { code: route.query.code } } : ROUTES.SIGN_IN" class="app-text-link--sm">Sign in</AppLink>
    </template>
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
        :icon="o.icon"
        :selected="draft.role === o.value"
        :radio="false"
        @select="choose(o.value)"
      />
    </div>
    <AppLink :to="route.query.code ? { path: ROUTES.JOURNEY, query: { code: route.query.code } } : ROUTES.JOURNEY" class="app-text-link">Back</AppLink>
  </AuthShell>
</template>

<style scoped>
.options { display: flex; flex-direction: column; gap: 12px; width: 100%; }
</style>
