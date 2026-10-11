<script setup>
import "@/app/app.css";
import { computed, inject, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import Icon from "@/app/components/Icon.vue";
import Tabs from "@/app/components/Tabs.vue";
import {
  addDays,
  dateLabel,
  dayNumber,
  formatHandover,
  isIsoDate,
  mondayOf,
  otherOf,
  restSummary,
  suggest,
  toIso,
  weekdayShort,
  weekLabel,
  weekNights,
} from "@/app/api/rotaHelpers";
import { describeSharedError, ownerKey, updatedLine } from "@/app/api/sharedHelpers";
import { displayName, HOME_KEY } from "@/app/composables/useHome";
import { SHARED_KEY } from "@/app/composables/useShared";
import { useRotaStore } from "@/app/stores/rota";

defineOptions({ name: "RotaPage" });

// The layout provides the household and the bound stores. Names use the full display name,
// then the first name, then a plain fallback when the page is used on its own.
const home = inject(HOME_KEY, null);
const shared = inject(SHARED_KEY, null);
const store = useRotaStore();

function fullName(person, fallback) {
  const full = String(person?.displayName ?? "").trim();
  if (full) return full;
  const first = person?.firstName;
  return first ? displayName(first) : fallback;
}
const myName = computed(() => fullName(home?.me?.value, "Me"));
const partnerName = computed(() => fullName(home?.partner?.value, "Partner"));
const names = computed(() => ({ me: myName.value, partner: partnerName.value }));
const nameOf = (who) => names.value[who] ?? "";
const initialOf = (who) => nameOf(who).trim().charAt(0).toUpperCase();
const myUid = computed(() => home?.me?.value?.uid || store.meUid);
const isMine = (owner) => ownerKey(owner, myUid.value) === "me";

// Shared data state. The page waits for the household id, so it never shows an error first.
const householdId = computed(() => home?.householdId?.value ?? store.householdId);
const loading = computed(() => !householdId.value || store.loading);
const errorInfo = computed(() => (store.error ? describeSharedError(store.error.code, "sleep rota") : null));
function retry() {
  shared?.retry();
}
const savedLine = computed(() =>
  updatedLine(store.plan, myUid.value, "you", partnerName.value, new Date()),
);

const TABS = [
  { id: "week", label: "This week" },
  { id: "swaps", label: "Swaps" },
  { id: "settings", label: "Plan settings" },
];
const tab = ref("week");

const todayIso = toIso(new Date());
const currentWeek = mondayOf(new Date());
const weekStart = ref(currentWeek);
const nights = computed(() => weekNights(store.view, weekStart.value));
const handover = computed(() => formatHandover(store.view.handoverTime));

function shiftWeek(n) {
  weekStart.value = addDays(weekStart.value, n * 7);
  selectedDate.value = null;
  closeSwap();
}
function goToThisWeek() {
  weekStart.value = currentWeek;
  selectedDate.value = null;
  closeSwap();
}

// Rest check
const summary = computed(() => restSummary(nights.value));
const suggestion = computed(() => suggest(nights.value, names.value));
const sentMessage = ref("");
async function applySuggestion() {
  const action = suggestion.value.action;
  if (!action) return;
  const result = await store.applyAction(action);
  if (result === "taken") sentMessage.value = `You are on duty on ${dateLabel(action.date)} now.`;
  else if (result === "requested") sentMessage.value = `Swap request sent to ${partnerName.value}. Check the Swaps tab.`;
}
const nightsText = (n) => `${n} ${n === 1 ? "night" : "nights"}`;
const restLine = computed(
  () =>
    `${myName.value} ${nightsText(summary.value.me.onDuty)}, ${partnerName.value} ${nightsText(summary.value.partner.onDuty)}, ` +
    `longest run ${Math.max(summary.value.me.longestRun, summary.value.partner.longestRun)}.`,
);

// Night strip and the detail row under it
const selectedDate = ref(null);
const selectedNight = computed(() => nights.value.find((n) => n.date === selectedDate.value) ?? null);
function selectNight(night) {
  sentMessage.value = "";
  closeSwap();
  selectedDate.value = selectedDate.value === night.date ? null : night.date;
}

// Swap panel under the detail row
const swapOpen = ref(false);
const swapChoice = ref(null);
const swapNote = ref("");
const swapError = ref("");

const NOTE_OPTIONS = [
  { value: "", label: "No note" },
  { value: "I have an early start", label: "I have an early start" },
  { value: "I am unwell", label: "I am unwell" },
  { value: "Family event", label: "Family event" },
];

function closeSwap() {
  swapOpen.value = false;
  swapChoice.value = null;
  swapNote.value = "";
  swapError.value = "";
}
function toggleSwap() {
  if (swapOpen.value) closeSwap();
  else swapOpen.value = true;
}
function swapOptions(night) {
  const options = nights.value
    .filter((n) => !n.shared && n.who === otherOf(night.who) && (n.who === "me" || n.who === "partner"))
    .map((n) => ({ value: n.date, label: dateLabel(n.date) }));
  if (night.who === "me") options.push({ value: "none", label: "Nothing in return" });
  return options;
}
async function sendSwap(night) {
  if (!swapChoice.value) {
    swapError.value = "Choose a night to swap with.";
    return;
  }
  const mine = night.who === "me";
  const ok = await store.requestSwap({
    date: mine ? night.date : swapChoice.value,
    withDate: mine ? (swapChoice.value === "none" ? null : swapChoice.value) : night.date,
    message: swapNote.value,
  });
  if (!ok) return;
  closeSwap();
  sentMessage.value = `Swap request sent to ${partnerName.value}. Check the Swaps tab.`;
}

const pendingDates = computed(() => {
  const set = new Set();
  for (const s of store.pending) {
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
function cellLabel(night) {
  const d = describeNight(night);
  const today = night.date === todayIso ? ", tonight" : "";
  const pendingText = pendingDates.value.has(night.date) ? ", swap requested" : "";
  return `${dateLabel(night.date)}${today}. ${d.title}${pendingText}`;
}

// History: earlier weeks, newest first, from the same shared plan.
const PAGE_WEEKS = 4;
const historyCount = ref(PAGE_WEEKS);
const planStart = computed(() => (isIsoDate(store.view.startDate) ? store.view.startDate : null));
const weekInPlan = (ws) => !planStart.value || addDays(ws, 6) >= planStart.value;
const historyWeeks = computed(() => {
  const out = [];
  for (let i = 1; i <= historyCount.value; i += 1) {
    const ws = addDays(currentWeek, -7 * i);
    if (!weekInPlan(ws)) break;
    const sum = restSummary(weekNights(store.view, ws));
    const parts = [`${myName.value} ${nightsText(sum.me.onDuty)}`, `${partnerName.value} ${nightsText(sum.partner.onDuty)}`];
    if (sum.shared) parts.push(`${sum.shared} shared`);
    if (sum.open) parts.push(`${sum.open} open`);
    parts.push(`longest run ${Math.max(sum.me.longestRun, sum.partner.longestRun)}`);
    out.push({
      weekStart: ws,
      label: weekLabel(ws),
      text: parts.join(", "),
      me: sum.me.onDuty,
      partner: sum.partner.onDuty,
      shared: sum.shared,
    });
  }
  return out;
});
const canShowEarlier = computed(
  () => historyCount.value < 52 && weekInPlan(addDays(currentWeek, -7 * (historyCount.value + 1))),
);
function showEarlier() {
  historyCount.value += PAGE_WEEKS;
}

// Swaps tab
const pending = computed(() => store.pending);
const history = computed(() => store.history);
function describeSwap(s) {
  const who = isMine(s.from) ? myName.value : partnerName.value;
  const give = `${who} gives ${dateLabel(s.date)}`;
  return s.withDate ? `${give} and takes ${dateLabel(s.withDate)}` : `${give} with nothing in return`;
}
const canAnswer = (s) => !isMine(s.from);

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
async function doReset() {
  await store.reset();
  confirmReset.value = false;
  selectedDate.value = null;
  closeSwap();
}
function onStart(event) {
  if (event.target.value) store.setStartDate(event.target.value);
}
function onHandover(event) {
  if (event.target.value) store.setHandoverTime(event.target.value);
}
</script>

<template>
  <div class="rt">
    <header class="rt__head">
      <h1 class="nt-title rt__title">Sleep rotation</h1>
      <p class="rt__sub">Who is on duty at night. You both see the same plan.</p>
    </header>

    <Tabs v-model="tab" :tabs="TABS" label="Sleep rotation sections" id-base="rota" />

    <div aria-live="polite">
      <p v-if="loading" class="rt__muted">Loading the rota...</p>
    </div>

    <div v-if="!loading && errorInfo" class="rt__error alert alert-danger" role="alert">
      <p class="mb-0">{{ errorInfo.text }}</p>
      <p v-if="errorInfo.detail" class="rt__muted">{{ errorInfo.detail }}</p>
      <button type="button" class="app-textbtn" @click="retry">Try again</button>
    </div>

    <template v-if="!loading && !errorInfo">
      <p v-if="store.writeError" class="app-error-text" role="alert">{{ store.writeError }}</p>

      <!-- This week -->
      <div v-if="tab === 'week'" id="rota-panel-week" class="rt__week-panel" role="tabpanel" aria-labelledby="rota-tab-week">
        <div class="rt__main">
        <section class="rt__block rt__card" aria-labelledby="rota-week-heading">
          <h2 id="rota-week-heading" class="visually-hidden">Nights this week</h2>
          <div class="rt__nav">
            <button type="button" class="rt__icon" aria-label="Previous week" @click="shiftWeek(-1)">
              <Icon name="chevron-left" :size="18" />
            </button>
            <p class="rt__week" aria-live="polite">{{ weekLabel(weekStart) }}</p>
            <button type="button" class="rt__icon" aria-label="Next week" @click="shiftWeek(1)">
              <Icon name="chevron" :size="18" />
            </button>
            <button v-if="weekStart !== currentWeek" type="button" class="app-textbtn" @click="goToThisWeek">This week</button>
          </div>

          <ol class="rt__strip" aria-label="Nights this week">
            <li v-for="night in nights" :key="night.date" class="rt__night" :data-date="night.date">
              <button
                type="button"
                class="rt__cell"
                :class="{ 'rt__cell--today': night.date === todayIso, 'rt__cell--on': selectedDate === night.date }"
                :aria-pressed="selectedDate === night.date ? 'true' : 'false'"
                :aria-label="cellLabel(night)"
                @click="selectNight(night)"
              >
                <span class="rt__dow">{{ weekdayShort(night.date) }}</span>
                <span class="rt__num">{{ dayNumber(night.date) }}</span>
                <span class="rt__mark" :class="`rt__mark--${night.shared ? 'split' : night.who}`" aria-hidden="true">
                  <svg v-if="night.shared" viewBox="0 0 28 28" width="28" height="28" class="rt__moon">
                    <circle cx="14" cy="14" r="13" fill="none" stroke="currentColor" stroke-width="1" />
                    <path d="M14 1 A13 13 0 0 0 14 27 Z" fill="currentColor" />
                  </svg>
                  <template v-else-if="night.who === 'open'"></template>
                  <template v-else>{{ initialOf(night.who) }}</template>
                </span>
                <span class="rt__tonight">{{ night.date === todayIso ? "Tonight" : "" }}</span>
              </button>
            </li>
          </ol>

          <p v-if="sentMessage" class="rt__muted" role="status">{{ sentMessage }}</p>
          <div v-else class="visually-hidden" role="status"></div>

          <div v-if="selectedNight" class="rt__detail" :data-detail="selectedNight.date">
            <p class="rt__detail-title">
              {{ dateLabel(selectedNight.date) }}. {{ describeNight(selectedNight).title }}
            </p>
            <p class="rt__muted">
              {{ describeNight(selectedNight).detail }}
              <span v-if="pendingDates.has(selectedNight.date)"> Swap requested.</span>
            </p>
            <p class="rt__detail-actions">
              <template v-if="selectedNight.who === 'open'">
                <button type="button" class="app-textbtn" @click="store.setOverride(selectedNight.date, 'me')">I take it</button>
                <button type="button" class="app-textbtn" @click="store.setOverride(selectedNight.date, 'partner')">
                  {{ partnerName }} takes it
                </button>
              </template>
              <template v-else>
                <button
                  v-if="canSwap(selectedNight)"
                  type="button"
                  class="app-textbtn"
                  :aria-expanded="swapOpen ? 'true' : 'false'"
                  :aria-controls="`rota-swap-${selectedNight.date}`"
                  @click="toggleSwap"
                >
                  Swap this night
                </button>
                <button
                  v-if="selectedNight.source === 'override'"
                  type="button"
                  class="app-textbtn"
                  @click="store.setOverride(selectedNight.date, null)"
                >
                  {{ store.view.pattern === "manual" ? "Make open" : "Back to plan" }}
                </button>
              </template>
            </p>

            <div v-if="swapOpen" :id="`rota-swap-${selectedNight.date}`" class="rt__swap">
              <fieldset class="rt__fieldset">
                <legend class="rt__label">Swap with</legend>
                <label v-for="o in swapOptions(selectedNight)" :key="o.value" class="rt__radio">
                  <input v-model="swapChoice" type="radio" :name="`swap-with-${selectedNight.date}`" :value="o.value" />
                  <span>{{ o.label }}</span>
                </label>
              </fieldset>
              <label class="rt__field">
                <span class="rt__label">Note (optional)</span>
                <select v-model="swapNote" class="app-control rt__select">
                  <option v-for="o in NOTE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
              </label>
              <p v-if="swapError" class="app-error-text" role="alert">{{ swapError }}</p>
              <div class="rt__swap-actions">
                <AppButton size="sm" @click="sendSwap(selectedNight)">Send swap request</AppButton>
                <button type="button" class="app-textbtn" @click="closeSwap">Cancel</button>
              </div>
            </div>
          </div>
        </section>
        </div>

        <div class="rt__rail">
        <section class="rt__block rt__card" aria-labelledby="rota-rest">
          <div class="rt__card-head">
            <span class="rt__icon-sq" aria-hidden="true"><Icon name="moon" :size="18" /></span>
            <h2 id="rota-rest" class="rt__h2">Rest check</h2>
          </div>
          <p class="rt__text">{{ restLine }}</p>
          <div
            class="rt__bar"
            role="img"
            :aria-label="`${myName}: ${summary.me.onDuty} of 7 nights on duty. ${partnerName}: ${summary.partner.onDuty} of 7 nights on duty.`"
          >
            <span class="rt__seg rt__seg--me" :style="{ flexGrow: summary.me.onDuty }"></span>
            <span class="rt__seg rt__seg--shared" :style="{ flexGrow: summary.shared }"></span>
            <span class="rt__seg rt__seg--partner" :style="{ flexGrow: summary.partner.onDuty }"></span>
          </div>
          <p v-if="summary.shared || summary.open" class="rt__muted">
            <span v-if="summary.shared">{{ summary.shared }} shared nights. </span>
            <span v-if="summary.open">{{ summary.open }} nights still open.</span>
          </p>
          <p class="rt__text">{{ suggestion.text }}</p>
          <p v-if="suggestion.action" class="rt__detail-actions">
            <button type="button" class="app-textbtn" @click="applySuggestion">Apply suggestion</button>
          </p>
          <p class="rt__muted">Swaps change the plan, not the care log.</p>
        </section>

        <section class="rt__block rt__card" aria-labelledby="rota-past">
          <h2 id="rota-past" class="rt__h2">History</h2>
          <p v-if="!historyWeeks.length" class="rt__muted">No earlier weeks yet.</p>
          <ul v-else class="rt__weeks">
            <li v-for="w in historyWeeks" :key="w.weekStart" class="rt__past" :data-week="w.weekStart">
              <p class="rt__text"><strong>{{ w.label }}</strong>: {{ w.text }}.</p>
              <div class="rt__bar rt__bar--thin" aria-hidden="true">
                <span class="rt__seg rt__seg--me" :style="{ flexGrow: w.me }"></span>
                <span class="rt__seg rt__seg--shared" :style="{ flexGrow: w.shared }"></span>
                <span class="rt__seg rt__seg--partner" :style="{ flexGrow: w.partner }"></span>
              </div>
            </li>
          </ul>
          <p v-if="canShowEarlier" class="rt__detail-actions">
            <button type="button" class="app-textbtn" @click="showEarlier">Show earlier weeks</button>
          </p>
        </section>
        </div>
      </div>

      <!-- Swaps -->
      <div v-else-if="tab === 'swaps'" id="rota-panel-swaps" class="rt__single rt__card" role="tabpanel" aria-labelledby="rota-tab-swaps">
        <p v-if="!store.swaps.length" class="rt__muted">No swap requests.</p>

        <section v-if="pending.length" aria-labelledby="rota-pending">
          <h2 id="rota-pending" class="rt__h2">Pending</h2>
          <ul class="rt__list">
            <li v-for="s in pending" :key="s.id" class="rt__item" :data-swap="s.id">
              <div>
                <p class="rt__name">{{ describeSwap(s) }}</p>
                <p v-if="s.message" class="rt__muted">{{ s.message }}</p>
              </div>
              <div class="rt__actions">
                <template v-if="canAnswer(s)">
                  <button type="button" class="app-textbtn" @click="store.respondSwap(s.id, true)">Accept</button>
                  <button type="button" class="app-textbtn" @click="store.respondSwap(s.id, false)">Decline</button>
                </template>
                <template v-else>
                  <span class="rt__muted">Waiting for {{ partnerName }}</span>
                  <button type="button" class="app-textbtn" @click="store.cancelRequest(s.id)">Cancel</button>
                </template>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="history.length" aria-labelledby="rota-answered">
          <h2 id="rota-answered" class="rt__h2">Answered</h2>
          <ul class="rt__list">
            <li v-for="s in history" :key="s.id" class="rt__item" :data-swap="s.id">
              <div>
                <p class="rt__name">{{ describeSwap(s) }}</p>
                <p v-if="s.message" class="rt__muted">{{ s.message }}</p>
              </div>
              <span class="rt__muted">{{ s.status === "accepted" ? "Accepted" : "Declined" }}</span>
            </li>
          </ul>
        </section>
      </div>

      <!-- Plan settings -->
      <div v-else id="rota-panel-settings" class="rt__single rt__card rt__settings" role="tabpanel" aria-labelledby="rota-tab-settings">
        <div class="rt__cols">
        <div class="rt__col">
        <fieldset class="rt__fieldset">
          <legend class="rt__label">Pattern</legend>
          <label v-for="o in PATTERN_OPTIONS" :key="o.value" class="rt__radio">
            <input
              type="radio"
              name="rota-pattern"
              :value="o.value"
              :checked="store.view.pattern === o.value"
              @change="store.setPattern(o.value)"
            />
            <span>{{ o.label }}</span>
          </label>
          <p v-if="store.view.pattern === 'manual'" class="rt__muted">
            Every night starts open. Set each night from This week.
          </p>
          <p v-else-if="store.view.pattern === 'split'" class="rt__muted">
            Each night is shared. One of you takes the first half and the other the second, taking turns.
          </p>
        </fieldset>

        <fieldset class="rt__fieldset">
          <legend class="rt__label">Who is on duty first</legend>
          <label v-for="o in firstOptions" :key="o.value" class="rt__radio">
            <input
              type="radio"
              name="rota-first"
              :value="o.value"
              :checked="store.view.firstOnDuty === o.value"
              @change="store.setFirstOnDuty(o.value)"
            />
            <span>{{ o.label }}</span>
          </label>
        </fieldset>

        </div>
        <div class="rt__col">
        <div class="rt__fields">
          <label class="rt__field">
            <span class="rt__label">Start date</span>
            <input class="app-control" type="date" :value="store.view.startDate" @change="onStart" />
          </label>
          <label class="rt__field">
            <span class="rt__label">Handover time</span>
            <input class="app-control" type="time" :value="store.view.handoverTime" @change="onHandover" />
          </label>
        </div>

        <p v-if="savedLine" class="rt__muted">{{ savedLine }}</p>
        </div>
        </div>

        <div v-if="!confirmReset" class="rt__foot">
          <button type="button" class="rt__danger" @click="confirmReset = true">Reset plan</button>
        </div>
        <div v-else class="rt__confirm rt__foot" role="group" aria-label="Confirm reset">
          <p class="rt__muted">Reset the plan and clear every set night for both of you?</p>
          <button type="button" class="rt__danger" @click="doReset">Yes, reset plan</button>
          <button type="button" class="app-textbtn" @click="confirmReset = false">Keep plan</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rt { display: flex; flex-direction: column; gap: 24px; margin: 0; font-size: 1rem; }
.rt__head { display: flex; flex-direction: column; gap: 8px; }
.rt__title { font-size: 2.5rem; line-height: 1.2; }
.rt__sub { margin: 0; font-size: 1rem; color: var(--nt-muted); }
.rt__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.rt__text { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: var(--nt-ink); }
.rt__h2 { margin: 0; font-family: inherit; font-size: 1.125rem; font-weight: 600; color: var(--nt-ink); }

.rt__card { background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; padding: 24px; }
.rt__card-head { display: flex; align-items: center; gap: 12px; }
.rt__icon-sq { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; border-radius: 8px; background: var(--nt-powder); color: var(--nt-plum); }

.rt__week-panel { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; align-items: start; }
.rt__main, .rt__rail { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.rt__block { display: flex; flex-direction: column; gap: 14px; align-items: flex-start; min-width: 0; }
.rt__block > * { max-width: 100%; }

.rt__nav { display: flex; align-items: center; gap: 8px; }
.rt__week { margin: 0 8px; min-width: 150px; text-align: center; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }
.rt__icon { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; background: transparent; border: 0; border-radius: 8px; color: var(--nt-muted); cursor: pointer; }
.rt__icon:hover { color: var(--nt-ink); }
.rt__icon:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.rt__strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; width: 100%; margin: 0; padding: 0; list-style: none; }
.rt__cell { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; min-height: 168px; padding: 14px 2px 12px; background: #fff; border: 1px solid var(--nt-line); border-radius: 10px; font: inherit; color: var(--nt-ink); cursor: pointer; }
.rt__cell:hover { background: rgb(59 47 63 / 4%); }
.rt__cell:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.rt__cell--on { background: rgb(59 47 63 / 6%); border-color: var(--nt-muted); }
.rt__cell--today { border-color: var(--nt-plum); }
.rt__dow { font-size: 0.875rem; color: var(--nt-muted); }
.rt__num { font-size: 1.75rem; font-weight: 600; line-height: 1.15; }
.rt__mark { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 1px solid var(--nt-muted); border-radius: 50%; font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.rt__mark--me { border-color: var(--nt-apricot-d); background: var(--nt-apricot); }
.rt__mark--partner { border-color: var(--nt-powder-d); background: var(--nt-powder); }
.rt__mark--open { border-style: dashed; border-color: var(--nt-muted); }
.rt__mark--split { border: 0; color: var(--nt-plum); }
.rt__moon { display: block; }
.rt__tonight { min-height: 18px; white-space: nowrap; font-size: 0.875rem; font-weight: 600; line-height: 18px; color: var(--nt-plum); }

.rt__detail { display: flex; flex-direction: column; gap: 6px; width: 100%; padding: 16px 0 0; border-top: 1px solid var(--nt-line); }
.rt__detail-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }
.rt__detail-actions { display: flex; flex-wrap: wrap; gap: 4px 20px; margin: 0; }
.rt__swap { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; padding-top: 16px; border-top: 1px solid var(--nt-line); }
.rt__swap-actions { display: flex; align-items: center; gap: 20px; }
.rt__label { margin: 0; padding: 0; font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.rt__fieldset { display: flex; flex-direction: column; gap: 4px; min-width: 0; margin: 0; padding: 0; border: 0; }
.rt__fieldset legend { float: none; width: auto; margin-bottom: 4px; }
.rt__radio { display: flex; align-items: center; gap: 10px; min-height: 32px; font-size: 0.9375rem; color: var(--nt-ink); cursor: pointer; }
.rt__radio input { width: 18px; height: 18px; margin: 0; accent-color: var(--nt-plum); cursor: pointer; }
.rt__radio input:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.rt__select { max-width: 280px; }

.rt__bar { display: flex; width: 100%; height: 6px; overflow: hidden; background: var(--nt-line); border-radius: 3px; }
.rt__bar--thin { height: 4px; }
.rt__seg { display: block; flex-basis: 0; flex-shrink: 0; min-width: 0; }
.rt__seg--me { background: var(--nt-apricot-d); }
.rt__seg--partner { background: var(--nt-powder-d); }
.rt__seg--shared { background: #b9b0bc; }

.rt__weeks { display: flex; flex-direction: column; width: 100%; margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.rt__past { display: flex; flex-direction: column; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--nt-line); }

.rt__error { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: 720px; }
.rt__single { display: flex; flex-direction: column; gap: 28px; }
.rt__single section .rt__h2 { margin-bottom: 8px; }
.rt__list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.rt__item { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 14px 0; border-bottom: 1px solid var(--nt-line); }
.rt__name { margin: 0; font-size: 1rem; font-weight: 500; color: var(--nt-ink); }
.rt__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; }
.rt__cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 28px; }
.rt__col { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.rt__fields { display: flex; flex-direction: column; gap: 16px; }
.rt__field { display: flex; flex-direction: column; gap: 8px; max-width: 280px; }
.rt__foot { padding-top: 20px; border-top: 1px solid var(--nt-line); }
.rt__confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; }
.rt__danger { padding: 0; background: none; border: 0; font: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-coral); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.rt__danger:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }

@media (min-width: 900px) {
  .rt__cols { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 48px; }
}
@media (min-width: 1100px) {
  .rt__week-panel { grid-template-columns: minmax(0, 1fr) 360px; }
}
@media (max-width: 575px) {
  .rt__title { font-size: 2rem; }
  .rt__card { padding: 20px 16px; }
  .rt__strip { gap: 4px; }
  .rt__cell { min-height: 128px; }
  .rt__num { font-size: 1.25rem; }
  .rt__mark { width: 24px; height: 24px; }
}
</style>
