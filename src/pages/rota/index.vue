<script setup>
import { computed, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import {
  TONIGHT_ID,
  WHO_NAME,
  acceptSwap,
  declineSwap,
  requestSwap,
  rota,
  swapBanner,
  takeOverTonight,
} from "@/data/rota.js";
import { ROUTES } from "@/shared/constants/routes";

defineOptions({ name: "rotaPage" });

const HOURS = ["6 PM", "9 PM", "12 AM", "3 AM", "6 AM"];
const NOW_LEFT = "30.6%";
const BALANCE = [
  { who: "M", nights: 8 },
  { who: "D", nights: 6 },
];

const byId = (id) => rota.find((n) => n.id === id);
const bannerText = computed(() => {
  const mine = byId(swapBanner.youTake)?.date;
  const hers = byId(swapBanner.sheTakes)?.date;
  return `You take ${mine} and she takes ${hers}. Sent ${swapBanner.sentAt}. If you do nothing, the rota stays as it is.`;
});

const myNights = computed(() => rota.filter((n) => n.who === "D"));
const meisNights = computed(() => rota.filter((n) => n.who === "M"));

const myNight = ref("sun");
const theirNight = ref("sat");
const message = ref("");
const requestSent = ref(false);
const tookOver = ref(false);

// Keep the selects valid after the rota changes.
watch(myNights, (list) => {
  if (!list.some((n) => n.id === myNight.value)) myNight.value = list[0]?.id ?? "";
});
watch(meisNights, (list) => {
  if (!list.some((n) => n.id === theirNight.value)) theirNight.value = list[0]?.id ?? "";
});

function sendRequest() {
  if (!myNight.value || !theirNight.value) return;
  requestSwap(myNight.value, theirNight.value);
  requestSent.value = true;
}

function takeOver() {
  takeOverTonight();
  tookOver.value = true;
}
</script>

<template>
  <div class="nt-stack">
    <PageHeader title="Sleep rotation" subtitle="Who is on call each night, 6 PM to 6 AM. Swap or override any time." />

    <AppCard v-if="swapBanner.open" variant="tint" class="swap-banner">
      <div class="swap-banner__text">
        <p class="swap-banner__title">Mei asked to swap two nights</p>
        <p class="swap-banner__body">{{ bannerText }}</p>
      </div>
      <div class="d-flex flex-wrap gap-3">
        <AppButton @click="acceptSwap">Accept swap</AppButton>
        <AppButton variant="outline" @click="declineSwap">Decline</AppButton>
      </div>
    </AppCard>

    <div class="nt-cols">
      <div class="nt-col">
        <AppCard title="This week">
          <p class="nt-muted mb-0" style="font-size: 0.9375rem">Mon 5 to Sun 11 October</p>
          <div class="rota-axis" aria-hidden="true">
            <span class="rota-axis__spacer"></span>
            <div class="rota-axis__hours">
              <span v-for="h in HOURS" :key="h">{{ h }}</span>
            </div>
          </div>
          <ul class="rota-list">
            <li v-for="n in rota" :key="n.id" class="rota-night">
              <div class="rota-night__label">
                <span>{{ n.day }}</span>
                <span v-if="n.id === TONIGHT_ID" class="rota-night__sub">Tonight</span>
              </div>
              <div
                class="rota-bar"
                :class="[`nt-who--${n.who}`, { 'rota-bar--pending': n.pending }]"
                role="img"
                :aria-label="`${n.day}, ${WHO_NAME[n.who]} on call${n.pending ? ', swap asked' : ''}`"
              >
                <span>{{ WHO_NAME[n.who] }}</span>
                <span v-if="n.pending" class="rota-bar__tag">Swap asked</span>
                <template v-if="n.id === TONIGHT_ID">
                  <span class="rota-bar__now" :style="{ left: NOW_LEFT }"></span>
                  <span class="rota-bar__now-label" :style="{ left: `calc(${NOW_LEFT} + 6px)` }">Now</span>
                </template>
              </div>
            </li>
          </ul>
          <p class="nt-muted nt-small mb-0">Each bar is one night. Apricot is Daniel, blue is Mei.</p>
        </AppCard>

        <AppCard title="How it is balanced">
          <p class="mb-0" style="font-size: 1rem; line-height: 24px">
            Over the last 14 nights Mei took 8 and you took 6. This week evens it out.
          </p>
          <div v-for="b in BALANCE" :key="b.who" class="balance-row">
            <span class="balance-row__name">{{ WHO_NAME[b.who] }}</span>
            <div class="balance-row__track">
              <div class="balance-row__bar" :class="`nt-who--${b.who}`" :style="{ width: `${(b.nights / 8) * 100}%` }">
                {{ b.nights }} nights
              </div>
            </div>
          </div>
        </AppCard>
      </div>

      <aside class="nt-col" aria-label="Swap and override">
        <AppCard title="Request a swap">
          <div>
            <label for="swap-mine" class="rota-field-label">Your night</label>
            <select id="swap-mine" v-model="myNight" class="form-select">
              <option v-for="n in myNights" :key="n.id" :value="n.id">{{ n.date }}</option>
            </select>
          </div>
          <div>
            <label for="swap-theirs" class="rota-field-label">Swap for Mei’s night</label>
            <select id="swap-theirs" v-model="theirNight" class="form-select">
              <option v-for="n in meisNights" :key="n.id" :value="n.id">{{ n.date }}</option>
            </select>
          </div>
          <div>
            <label for="swap-message" class="rota-field-label">Message (optional)</label>
            <textarea id="swap-message" v-model="message" class="form-control" rows="2" placeholder="Say why, if you like"></textarea>
          </div>
          <AppButton variant="outline" class="align-self-start" @click="sendRequest">Send request</AppButton>
          <p v-if="requestSent" class="rota-notice mb-0" role="status">Request sent. Mei can accept or decline.</p>
        </AppCard>

        <AppCard title="Override a night">
          <p class="nt-muted mb-0" style="font-size: 0.9375rem; line-height: 22px">
            Need to change tonight without waiting for an answer? Take over and Mei is told straight away.
          </p>
          <AppButton variant="outline" class="align-self-start" @click="takeOver">Take over tonight</AppButton>
          <p v-if="tookOver" class="rota-notice mb-0" role="status">You are on call tonight. Mei is told.</p>
        </AppCard>

        <p class="mb-0 nt-small">
          <span class="nt-muted">Tired? Check your sleep in </span>
          <AppLink :to="ROUTES.CHECK_IN">your private check-in</AppLink>
        </p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.swap-banner {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px 24px;
  padding: 20px 24px;
}
.swap-banner__text {
  flex: 1 1 320px;
  min-width: 0;
}
.swap-banner__title {
  margin: 0 0 4px;
  font-size: 1.125rem;
  font-weight: 500;
}
.swap-banner__body {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 22px;
}
.rota-axis {
  display: grid;
  grid-template-columns: 110px minmax(0, 520px);
}
.rota-axis__hours {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--nt-muted);
}
.rota-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rota-night {
  display: grid;
  grid-template-columns: 110px minmax(0, 520px);
  align-items: center;
}
.rota-night__label {
  display: flex;
  flex-direction: column;
  font-size: 0.9375rem;
  font-weight: 500;
}
.rota-night__sub {
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--nt-muted);
}
.rota-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 12px;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1.5px solid transparent;
  border-radius: 8px;
}
.rota-bar--pending {
  border-color: var(--nt-ink);
  border-style: dashed;
}
.rota-bar__tag {
  font-size: 0.8125rem;
}
.rota-bar__now {
  position: absolute;
  top: -5.5px;
  width: 2px;
  height: 44px;
  background: var(--nt-coral);
}
.rota-bar__now-label {
  position: absolute;
  top: -15.5px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--nt-coral);
}
.balance-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.balance-row__name {
  flex: none;
  width: 60px;
  font-size: 0.875rem;
  font-weight: 500;
}
.balance-row__track {
  flex: 1;
  max-width: 400px;
}
.balance-row__bar {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  border-radius: 6px;
}
.rota-field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
}
.rota-notice {
  font-size: 0.875rem;
  color: var(--nt-ink);
}
</style>
