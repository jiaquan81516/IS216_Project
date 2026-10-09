<script setup>
import "@/v3/v3.css";
import { computed, inject, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import V3Avatar from "@/v3/components/V3Avatar.vue";
import V3ChipGroup from "@/v3/components/V3ChipGroup.vue";
import V3Icon from "@/v3/components/V3Icon.vue";
import V3Tabs from "@/v3/components/V3Tabs.vue";
import {
  addDays,
  dateLabel,
  dayNumber,
  formatHandover,
  mondayOf,
  otherOf,
  restSummary,
  suggest,
  toIso,
  weekdayShort,
  weekLabel,
  weekNights,
} from "@/v3/api/rotaHelpers";
import { displayName, V3_HOME_KEY } from "@/v3/composables/useV3Home";
import { useRotaStore } from "@/v3/stores/rota";

defineOptions({ name: "V3RotaPage" });

// The layout provides the household. Only names are needed, so the page does not load it on
// its own and falls back to "Me" and "Your partner".
const home = inject(V3_HOME_KEY, null);
const store = useRotaStore();

const myName = computed(() => {
  const first = home?.me?.value?.firstName;
  return first ? displayName(first) : "Me";
});
const partnerName = computed(() => {
  const first = home?.partner?.value?.firstName;
  return first ? displayName(first) : "Your partner";
});
const names = computed(() => ({ me: myName.value, partner: partnerName.value }));
const nameOf = (who) => names.value[who] ?? "";

const TABS = [
  { id: "week", label: "This week" },
  { id: "swaps", label: "Swaps" },
  { id: "settings", label: "Plan settings" },
];
const tab = ref("week");

const todayIso = toIso(new Date());
const currentWeek = mondayOf(new Date());
const weekStart = ref(currentWeek);
const nights = computed(() => weekNights(store, weekStart.value));
const handover = computed(() => formatHandover(store.handoverTime));

function shiftWeek(n) {
  weekStart.value = addDays(weekStart.value, n * 7);
  closeSwap();
}
function goToThisWeek() {
  weekStart.value = currentWeek;
  closeSwap();
}

// Rest check
const summary = computed(() => restSummary(nights.value));
const suggestion = computed(() => suggest(nights.value, names.value));
const applied = ref(false);
function applySuggestion() {
  if (!suggestion.value.action) return;
  store.applyAction(suggestion.value.action);
  applied.value = true;
}
const people = computed(() => [
  { who: "me", name: myName.value, tone: "apricot", ...summary.value.me },
  { who: "partner", name: partnerName.value, tone: "powder", ...summary.value.partner },
]);

// Swap panel under a row
const openSwapDate = ref(null);
const swapChoice = ref(null);
const swapNote = ref("");
const swapError = ref("");
const sentMessage = ref("");

const NOTE_OPTIONS = [
  { value: "", label: "No note" },
  { value: "I have an early start", label: "I have an early start" },
  { value: "I am unwell", label: "I am unwell" },
  { value: "Family event", label: "Family event" },
];

function closeSwap() {
  openSwapDate.value = null;
  swapChoice.value = null;
  swapNote.value = "";
  swapError.value = "";
}
function toggleSwap(night) {
  sentMessage.value = "";
  if (openSwapDate.value === night.date) {
    closeSwap();
    return;
  }
  closeSwap();
  openSwapDate.value = night.date;
}
function swapOptions(night) {
  const options = nights.value
    .filter((n) => !n.shared && n.who === otherOf(night.who) && (n.who === "me" || n.who === "partner"))
    .map((n) => ({ value: n.date, label: dateLabel(n.date) }));
  if (night.who === "me") options.push({ value: "none", label: "Nothing in return" });
  return options;
}
function sendSwap(night) {
  if (!swapChoice.value) {
    swapError.value = "Choose a night to swap with.";
    return;
  }
  const mine = night.who === "me";
  store.requestSwap({
    date: mine ? night.date : swapChoice.value,
    withDate: mine ? (swapChoice.value === "none" ? null : swapChoice.value) : night.date,
    message: swapNote.value,
  });
  closeSwap();
  sentMessage.value = "Swap request saved on this device. Check the Swaps tab.";
}

const pendingDates = computed(() => {
  const set = new Set();
  for (const s of store.swaps) {
    if (s.status !== "pending") continue;
    set.add(s.date);
    if (s.withDate) set.add(s.withDate);
  }
  return set;
});
const canSwap = (night) => !night.shared && (night.who === "me" || night.who === "partner");

function describeNight(night) {
  if (night.who === "open") return { title: "Open", detail: "Nobody is on duty yet." };
  if (night.shared) {
    return {
      title: `${nameOf(night.who)} first half, then ${nameOf(night.second)}`,
      detail: `Shared night. Handover at ${handover.value}.`,
    };
  }
  return {
    title: `${nameOf(night.who)} on duty`,
    detail: `${nameOf(night.resting)} rests first. Handover at ${handover.value}.`,
  };
}

// Swaps tab
const pending = computed(() => store.swaps.filter((s) => s.status === "pending"));
const history = computed(() => store.swaps.filter((s) => s.status !== "pending"));
function describeSwap(s) {
  const give = `${nameOf(s.from)} gives ${dateLabel(s.date)}`;
  return s.withDate ? `${give} and takes ${dateLabel(s.withDate)}` : `${give} with nothing in return`;
}

// Plan settings
const PATTERN_OPTIONS = [
  { value: "alternate", label: "Alternate nights" },
  { value: "split", label: "Split each night" },
  { value: "manual", label: "Manual" },
];
const firstOptions = computed(() => [
  { value: "me", label: myName.value },
  { value: "partner", label: partnerName.value },
]);
const confirmReset = ref(false);
function doReset() {
  store.reset();
  confirmReset.value = false;
  closeSwap();
}
function onStart(event) {
  if (event.target.value) store.startDate = event.target.value;
}
function onHandover(event) {
  if (event.target.value) store.handoverTime = event.target.value;
}
</script>

<template>
  <div class="rt">
    <header class="rt__head">
      <h1 class="nt-title rt__title">Sleep rota</h1>
      <p class="rt__sub">Who is on duty at night, with room for swaps.</p>
    </header>

    <V3Tabs v-model="tab" :tabs="TABS" label="Sleep rota sections" id-base="rota" />

    <!-- This week -->
    <div
      v-if="tab === 'week'"
      id="rota-panel-week"
      class="rt__cols"
      role="tabpanel"
      aria-labelledby="rota-tab-week"
    >
      <section class="rt__main" aria-labelledby="rota-week-heading">
        <h2 id="rota-week-heading" class="visually-hidden">Nights this week</h2>
        <div class="rt__nav">
          <button type="button" class="rt__icon" aria-label="Previous week" @click="shiftWeek(-1)">
            <V3Icon name="chevron-left" :size="18" />
          </button>
          <p class="rt__week" aria-live="polite">{{ weekLabel(weekStart) }}</p>
          <button type="button" class="rt__icon" aria-label="Next week" @click="shiftWeek(1)">
            <V3Icon name="chevron" :size="18" />
          </button>
          <AppButton v-if="weekStart !== currentWeek" variant="outline" size="sm" @click="goToThisWeek">
            This week
          </AppButton>
        </div>

        <p v-if="sentMessage" class="rt__muted" role="status">{{ sentMessage }}</p>
        <div v-else class="visually-hidden" role="status"></div>

        <ol class="rt__rows" aria-label="Nights this week">
          <li v-for="night in nights" :key="night.date" class="rt__row" :data-date="night.date">
            <div class="rt__line">
              <div class="rt__date">
                <span class="rt__dow">{{ weekdayShort(night.date) }}</span>
                <span class="rt__day">{{ dayNumber(night.date) }}</span>
              </div>

              <div class="rt__who">
                <template v-if="night.who === 'open'">
                  <span class="v3-badge">Open</span>
                </template>
                <template v-else-if="night.shared">
                  <V3Avatar :name="nameOf(night.who)" :tone="night.who === 'me' ? 'apricot' : 'powder'" :size="32" />
                  <V3Avatar :name="nameOf(night.second)" :tone="night.second === 'me' ? 'apricot' : 'powder'" :size="32" />
                </template>
                <V3Avatar v-else :name="nameOf(night.who)" :tone="night.who === 'me' ? 'apricot' : 'powder'" :size="32" />

                <div class="rt__text">
                  <p class="rt__name">
                    <span>{{ describeNight(night).title }}</span>
                    <span v-if="night.date === todayIso" class="v3-badge v3-badge--coral">Tonight</span>
                    <span v-if="pendingDates.has(night.date)" class="v3-badge">Swap requested</span>
                  </p>
                  <p class="rt__muted">{{ describeNight(night).detail }}</p>
                </div>
              </div>

              <div class="rt__actions">
                <template v-if="night.who === 'open'">
                  <button type="button" class="v3-chip" @click="store.setOverride(night.date, 'me')">I take it</button>
                  <button type="button" class="v3-chip" @click="store.setOverride(night.date, 'partner')">
                    {{ partnerName }} takes it
                  </button>
                </template>
                <template v-else>
                  <button
                    v-if="night.source === 'override'"
                    type="button"
                    class="v3-textbtn"
                    @click="store.setOverride(night.date, null)"
                  >
                    {{ store.pattern === "manual" ? "Make open" : "Back to plan" }}
                  </button>
                  <AppButton
                    v-if="canSwap(night)"
                    variant="outline"
                    size="sm"
                    :aria-expanded="openSwapDate === night.date ? 'true' : 'false'"
                    :aria-controls="`rota-swap-${night.date}`"
                    @click="toggleSwap(night)"
                  >
                    Swap
                  </AppButton>
                </template>
              </div>
            </div>

            <div v-if="openSwapDate === night.date" :id="`rota-swap-${night.date}`" class="rt__swap">
              <p class="rt__label" :id="`rota-swap-with-${night.date}`">Swap with</p>
              <V3ChipGroup v-model="swapChoice" :options="swapOptions(night)" label="Swap with" />
              <p class="rt__label">Note (optional)</p>
              <V3ChipGroup v-model="swapNote" :options="NOTE_OPTIONS" label="Note" />
              <p v-if="swapError" class="v3-error-text" role="alert">{{ swapError }}</p>
              <div class="rt__swap-actions">
                <AppButton size="sm" @click="sendSwap(night)">Send swap request</AppButton>
                <button type="button" class="v3-textbtn" @click="closeSwap">Cancel</button>
              </div>
            </div>
          </li>
        </ol>
      </section>

      <aside class="rt__side" aria-label="Rest check and how this works">
        <section aria-labelledby="rota-rest">
          <h2 id="rota-rest" class="nt-heading nt-heading--sm">Rest check</h2>
          <ul class="rt__people">
            <li v-for="p in people" :key="p.who">
              <p class="rt__person">
                <strong>{{ p.name }}</strong>
                <span>{{ p.onDuty }} nights on duty, longest run {{ p.longestRun }}</span>
              </p>
              <div
                class="rt__bar"
                role="img"
                :aria-label="`${p.name}: ${p.onDuty} of 7 nights on duty, ${p.off} nights off`"
              >
                <span class="rt__bar-on" :class="`rt__bar-on--${p.tone}`" :style="{ width: `${(p.onDuty / 7) * 100}%` }"></span>
              </div>
            </li>
          </ul>
          <p v-if="summary.shared || summary.open" class="rt__muted">
            <span v-if="summary.shared">{{ summary.shared }} shared nights. </span>
            <span v-if="summary.open">{{ summary.open }} nights still open.</span>
          </p>
          <p class="rt__suggest">{{ suggestion.text }}</p>
          <AppButton v-if="suggestion.action" variant="outline" size="sm" @click="applySuggestion">
            Apply suggestion
          </AppButton>
          <p v-if="applied" class="rt__muted" role="status">Suggestion applied to the plan.</p>
        </section>

        <section aria-labelledby="rota-how">
          <h2 id="rota-how" class="nt-heading nt-heading--sm">How this works</h2>
          <p class="rt__muted">The plan repeats from your settings. Swaps change the plan, not the care log.</p>
        </section>
      </aside>
    </div>

    <!-- Swaps -->
    <div v-else-if="tab === 'swaps'" id="rota-panel-swaps" class="rt__single" role="tabpanel" aria-labelledby="rota-tab-swaps">
      <p v-if="!store.swaps.length" class="rt__muted">No swap requests.</p>

      <section v-if="pending.length" aria-labelledby="rota-pending">
        <h2 id="rota-pending" class="nt-heading nt-heading--sm">Pending</h2>
        <ul class="rt__list">
          <li v-for="s in pending" :key="s.id" class="rt__item">
            <div>
              <p class="rt__name">{{ describeSwap(s) }}</p>
              <p v-if="s.message" class="rt__muted">{{ s.message }}</p>
            </div>
            <div class="rt__actions">
              <template v-if="s.from === 'partner'">
                <AppButton variant="outline" size="sm" @click="store.respondSwap(s.id, true)">Accept</AppButton>
                <AppButton variant="outline" size="sm" @click="store.respondSwap(s.id, false)">Decline</AppButton>
              </template>
              <template v-else>
                <span class="rt__muted">Waiting for {{ partnerName }}</span>
                <AppButton variant="outline" size="sm" @click="store.cancelRequest(s.id)">Cancel</AppButton>
              </template>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="history.length" aria-labelledby="rota-history">
        <h2 id="rota-history" class="nt-heading nt-heading--sm">History</h2>
        <ul class="rt__list">
          <li v-for="s in history" :key="s.id" class="rt__item">
            <div>
              <p class="rt__name">{{ describeSwap(s) }}</p>
              <p v-if="s.message" class="rt__muted">{{ s.message }}</p>
            </div>
            <span class="v3-badge">{{ s.status === "accepted" ? "Accepted" : "Declined" }}</span>
          </li>
        </ul>
      </section>

      <p class="rt__muted">Requests will sync between you once the database is connected.</p>
    </div>

    <!-- Plan settings -->
    <div v-else id="rota-panel-settings" class="rt__single" role="tabpanel" aria-labelledby="rota-tab-settings">
      <section class="rt__setting">
        <h2 id="rota-pattern" class="rt__label">Pattern</h2>
        <V3ChipGroup :model-value="store.pattern" :options="PATTERN_OPTIONS" label="Pattern" @update:model-value="(v) => (store.pattern = v)" />
        <p v-if="store.pattern === 'manual'" class="rt__muted">
          Every night starts open. Set each night from This week.
        </p>
        <p v-else-if="store.pattern === 'split'" class="rt__muted">
          Each night is shared. One of you takes the first half and the other the second, taking turns.
        </p>
      </section>

      <section class="rt__setting">
        <h2 class="rt__label">Who is on duty first</h2>
        <V3ChipGroup :model-value="store.firstOnDuty" :options="firstOptions" label="Who is on duty first" @update:model-value="(v) => (store.firstOnDuty = v)" />
      </section>

      <div class="rt__fields">
        <label class="rt__field">
          <span class="rt__label">Start date</span>
          <input class="v3-control" type="date" :value="store.startDate" @change="onStart" />
        </label>
        <label class="rt__field">
          <span class="rt__label">Handover time</span>
          <input class="v3-control" type="time" :value="store.handoverTime" @change="onHandover" />
        </label>
      </div>

      <section class="rt__setting">
        <div v-if="!confirmReset">
          <AppButton variant="outline" size="sm" @click="confirmReset = true">Reset plan</AppButton>
        </div>
        <div v-else class="rt__confirm" role="group" aria-label="Confirm reset">
          <p class="rt__muted">Reset the plan, overrides and swaps on this device?</p>
          <AppButton variant="outline" size="sm" @click="doReset">Yes, reset plan</AppButton>
          <button type="button" class="v3-textbtn" @click="confirmReset = false">Keep plan</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.rt { display: flex; flex-direction: column; gap: 24px; max-width: 1120px; margin: 0 auto; font-size: 1rem; }
.rt__head { display: flex; flex-direction: column; gap: 8px; }
.rt__title { font-size: 2.5rem; line-height: 1.2; }
.rt__sub { margin: 0; font-size: 1rem; color: var(--nt-muted); }
.rt__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }

.rt__cols { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 40px; align-items: start; }
.rt__main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.rt__side { display: flex; flex-direction: column; gap: 32px; min-width: 0; }
.rt__side section { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.rt__side h2 { margin: 0; }

.rt__nav { display: flex; align-items: center; gap: 8px; }
.rt__week { margin: 0 8px; min-width: 150px; text-align: center; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }
.rt__icon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; background: #fff; border: 1px solid var(--nt-line); border-radius: 8px; color: var(--nt-ink); cursor: pointer; transition: background-color 0.15s; }
.rt__icon:hover { background: var(--nt-gray); }
.rt__icon:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.rt__rows { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.rt__row { border-bottom: 1px solid var(--nt-line); }
.rt__line { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 16px 0; }
.rt__date { display: flex; flex-direction: column; align-items: center; line-height: 1.2; }
.rt__dow { font-size: 0.875rem; color: var(--nt-muted); }
.rt__day { font-family: var(--nt-serif); font-size: 1.5rem; color: var(--nt-ink); }
.rt__who { display: flex; align-items: center; gap: 12px; min-width: 0; }
.rt__text { min-width: 0; }
.rt__name { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }
.rt__actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }

.rt__swap { display: flex; flex-direction: column; gap: 12px; margin: 0 0 16px 72px; padding: 16px; background: var(--nt-gray); border: 1px solid var(--nt-line); border-radius: 12px; }
.rt__swap-actions { display: flex; align-items: center; gap: 16px; }
.rt__label { margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }

.rt__people { display: flex; flex-direction: column; gap: 16px; width: 100%; margin: 0; padding: 0; list-style: none; }
.rt__person { display: flex; flex-direction: column; gap: 2px; margin: 0 0 6px; font-size: 0.875rem; color: var(--nt-ink); }
.rt__bar { height: 12px; overflow: hidden; background: var(--nt-gray); border: 1px solid var(--nt-line); border-radius: 6px; }
.rt__bar-on { display: block; height: 100%; }
.rt__bar-on--apricot { background: var(--nt-apricot-d); }
.rt__bar-on--powder { background: var(--nt-powder-d); }
.rt__suggest { margin: 0; font-size: 0.875rem; line-height: 1.45; font-weight: 500; color: var(--nt-ink); }

.rt__single { display: flex; flex-direction: column; gap: 24px; max-width: 720px; }
.rt__single section h2 { margin: 0 0 8px; }
.rt__list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.rt__item { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 16px 0; border-bottom: 1px solid var(--nt-line); }
.rt__setting { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.rt__setting h2 { margin: 0; font-family: inherit; }
.rt__fields { display: flex; flex-wrap: wrap; gap: 16px; }
.rt__field { display: flex; flex-direction: column; gap: 8px; width: 200px; }
.rt__confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }

@media (max-width: 991px) {
  .rt__cols { grid-template-columns: minmax(0, 1fr); }
  .rt__title { font-size: 2rem; }
}
@media (max-width: 575px) {
  .rt__line { grid-template-columns: 48px minmax(0, 1fr); }
  .rt__actions { grid-column: 2; justify-content: flex-start; }
  .rt__swap { margin-left: 0; }
}
</style>
