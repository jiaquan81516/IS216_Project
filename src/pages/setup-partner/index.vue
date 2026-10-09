<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import StepperBar from "@/components/ui/StepperBar.vue";
import YoursAlone from "@/components/ui/YoursAlone.vue";
import { inviteMessage, PARTNER_SEES, STAYS_WITH_YOU } from "@/data/setupPartner";
import { SAMPLE } from "@/shared/constants/appConstants";
import { ROUTES } from "@/shared/constants/routes";
import { useHouseholdStore } from "@/stores/household";

defineOptions({ name: "setup-partnerPage" });

const household = useHouseholdStore();
const router = useRouter();

const link = computed(() => `${location.origin}/join/${SAMPLE.inviteCode}`);
const text = computed(() => encodeURIComponent(inviteMessage(link.value)));
const whatsapp = computed(() => `https://wa.me/?text=${text.value}`);
const sms = computed(() => `sms:?&body=${text.value}`);
const email = computed(
  () => `mailto:?subject=${encodeURIComponent("Join me on NurtureTrack")}&body=${text.value}`,
);

const copied = ref(false);
let timer;
async function copyLink() {
  try {
    await navigator.clipboard.writeText(link.value);
  } catch {
    // Clipboard may be blocked; still give feedback only when it worked.
    return;
  }
  copied.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => (copied.value = false), 2000);
}
onBeforeUnmount(() => clearTimeout(timer));

function next() {
  household.partnerInvited = true;
  router.push(ROUTES.SETUP_NIGHTS);
}
</script>

<template>
  <div class="nt-cols nt-cols--onboarding">
    <div class="nt-col partner">
      <StepperBar :current="3" />
      <div class="partner__title">
        <h1 class="nt-title nt-title--xl">Invite your partner.</h1>
        <p class="nt-lead mb-0">They join with their own Google account and see the shared side of the app.</p>
      </div>

      <div class="partner__group">
        <label class="partner__label" for="partner-link">Send them this link</label>
        <div class="partner__copy">
          <input id="partner-link" class="form-control partner__input" type="text" readonly :value="link" />
          <AppButton variant="outline" size="lg" @click="copyLink">
            <span aria-live="polite">{{ copied ? "Copied" : "Copy link" }}</span>
          </AppButton>
        </div>
        <div class="partner__share">
          <a class="btn btn-outline" :href="whatsapp" target="_blank" rel="noopener">Share on WhatsApp</a>
          <a class="btn btn-outline" :href="sms">Send by text</a>
          <a class="btn btn-outline" :href="email">Send by email</a>
        </div>
        <p class="partner__code mb-0">
          <span class="nt-muted">Or give them this code</span>
          <strong>{{ SAMPLE.inviteCode }}</strong>
        </p>
      </div>

      <p class="partner__wait mb-0">Waiting for your partner. You can carry on without them.</p>

      <div class="partner__actions">
        <AppButton @click="next">Continue</AppButton>
        <AppLink :to="ROUTES.SETUP_BABY">Back</AppLink>
        <AppLink :to="ROUTES.SETUP_NIGHTS">I will do this later</AppLink>
      </div>
    </div>

    <aside class="nt-col">
      <AppCard :title="`${SAMPLE.partner} will see`">
        <ul class="partner__list">
          <li v-for="item in PARTNER_SEES" :key="item">{{ item }}</li>
        </ul>
      </AppCard>
      <YoursAlone>
        <h2 class="nt-heading nt-heading--sm">Stays with you</h2>
        <ul class="partner__list">
          <li v-for="item in STAYS_WITH_YOU" :key="item">{{ item }}</li>
        </ul>
      </YoursAlone>
    </aside>
  </div>
</template>

<style scoped>
.partner {
  gap: 28px;
}
.partner__title {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.partner__group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.partner__label {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--nt-ink);
}
.partner__copy {
  display: flex;
  gap: 12px;
  align-items: stretch;
}
.partner__input {
  flex: 1;
  min-width: 0;
  padding: 20px;
  font-weight: 500;
}
.partner__share {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.partner__code {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9375rem;
}
.partner__code strong {
  font-size: 1rem;
  font-weight: 600;
}
.partner__wait {
  font-size: 0.9375rem;
  color: var(--nt-muted);
}
.partner__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
}
.partner__list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9375rem;
  line-height: 1.45;
}
.partner__list li {
  display: flex;
  gap: 10px;
}
.partner__list li::before {
  content: "–";
  color: var(--nt-muted);
}
.nt-yours-alone .partner__list {
  gap: 10px;
}
</style>
