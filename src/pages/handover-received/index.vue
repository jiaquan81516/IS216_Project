<script setup>
import { useRouter } from "vue-router";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import HandoverShiftRows from "@/components/ui/HandoverShiftRows.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import YoursAlone from "@/components/ui/YoursAlone.vue";
import { SHIFT_ROWS, acceptHandover, handover } from "@/data/handover.js";
import { ROUTES } from "@/shared/constants/routes";

defineOptions({ name: "handoverReceivedPage" });

const router = useRouter();

function accept() {
  acceptHandover();
  router.push(ROUTES.HOME);
}
</script>

<template>
  <div class="nt-stack">
    <div class="d-flex flex-wrap gap-2 align-items-center">
      <AppBadge color="blue">Viewing as Mei</AppBadge>
      <AppBadge v-if="handover.needsAttention" color="yellow">Needs attention</AppBadge>
    </div>
    <PageHeader
      title="Handover from Daniel"
      :subtitle="`Sent ${handover.sentAt ?? '5:50 PM'}. You are on call from 6 PM tonight.`"
    />

    <div class="nt-cols">
      <div class="nt-col">
        <AppCard title="Daniel’s note">
          <p class="received__note mb-0">{{ handover.note }}</p>
        </AppCard>

        <AppCard title="What happened this shift">
          <HandoverShiftRows :rows="SHIFT_ROWS" received />
        </AppCard>

        <AppCard title="Next up">
          <ul class="received__list">
            <li v-for="(item, i) in handover.nextUp" :key="`${i}-${item}`">
              <span class="nt-muted" aria-hidden="true">–</span>
              <span>{{ item }}</span>
            </li>
          </ul>
        </AppCard>

        <div class="d-flex flex-wrap gap-3">
          <AppButton @click="accept">Got it, I am on call</AppButton>
          <AppButton variant="outline" :to="ROUTES.CARE_LOG">Ask Daniel a question</AppButton>
        </div>
      </div>

      <aside class="nt-col" aria-label="Privacy and what Daniel sees">
        <AppCard title="What Daniel sees">
          <p class="nt-muted mb-0 received__side">
            When you tap Got it, he is told the time you read it. On call switches to you at 6 PM and feed alerts
            move to your phone.
          </p>
        </AppCard>
        <YoursAlone>
          <p class="mb-0 received__side">Daniel never sees your check-ins. A handover only ever contains the care log.</p>
        </YoursAlone>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.received__note {
  font-size: 1.125rem;
  line-height: 28px;
}
.received__list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9375rem;
}
.received__list li {
  display: flex;
  gap: 10px;
  line-height: 22px;
}
.received__side {
  font-size: 0.9375rem;
  line-height: 22px;
}
</style>
