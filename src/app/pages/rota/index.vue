<script setup>
import "@/app/app.css";
import { computed, inject, ref } from "vue";
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
} from "@/app/utils/rotaHelpers";
import {
  describeSharedError,
  ownerKey,
  updatedLine,
} from "@/app/utils/sharedHelpers";
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
const names = computed(() => ({
  me: myName.value,
  partner: partnerName.value,
}));
const nameOf = (who) => names.value[who] ?? "";
const initialOf = (who) => nameOf(who).trim().charAt(0).toUpperCase();
const myUid = computed(() => home?.me?.value?.uid || store.meUid);
const isMine = (owner) => ownerKey(owner, myUid.value) === "me";

// Shared data state. The page waits for the household id, so it never shows an error first.
const householdId = computed(
  () => home?.householdId?.value ?? store.householdId,
);
const loading = computed(() => !householdId.value || store.loading);
const errorInfo = computed(() =>
  store.error ? describeSharedError(store.error.code, "sleep rota") : null,
);
function retry() {
  shared?.retry();
}
const savedLine = computed(() =>
  updatedLine(store.plan, myUid.value, "you", partnerName.value, new Date()),
);

const TABS = [
  { id: "week", label: "This week" },
  { id: "settings", label: "Plan settings" },
];
const tab = ref("settings");

const todayIso = toIso(new Date());
const currentWeek = mondayOf(new Date());
const weekStart = ref(currentWeek);
const nights = computed(() => {
  if (
    selectedPattern.value === "smart" &&
    localPlan.value.length &&
    localPlanStart.value &&
    mondayOf(new Date(`${localPlanStart.value}T00:00:00`)) === weekStart.value
  ) {
    return localPlan.value.map(addOptionalHandover);
  }

  try {
    const sharedNights = weekNights(store.view, weekStart.value) || [];
    const source = sharedNights.length ? sharedNights : localPlan.value;
    return source.map(addOptionalHandover);
  } catch (error) {
    console.warn(
      "Could not read the shared rota; using the local plan.",
      error,
    );
    return localPlan.value.map(addOptionalHandover);
  }
});
const visibleWeekLabel = computed(() => {
  const firstDate = nights.value[0]?.date;
  return weekLabel(firstDate || weekStart.value);
});
const handover = computed(() => formatHandover(store.view.handoverTime));

function shiftWeek(n) {
  weekStart.value = addDays(weekStart.value, n * 7);
  selectedDate.value = null;
}
function goToThisWeek() {
  weekStart.value = currentWeek;
  selectedDate.value = null;
}

// Rest check
const summary = computed(() => restSummary(nights.value));
const suggestion = computed(() => suggest(nights.value, names.value));
const sentMessage = ref("");
async function applySuggestion() {
  const action = suggestion.value.action;
  if (!action) return;
  const result = await store.applyAction(action);
  if (result === "taken")
    sentMessage.value = `You are on duty on ${dateLabel(action.date)} now.`;
}
const nightsText = (n) => `${n} ${n === 1 ? "night" : "nights"}`;
const restLine = computed(
  () =>
    `${myName.value} ${nightsText(summary.value.me.onDuty)}, ${partnerName.value} ${nightsText(summary.value.partner.onDuty)}, ` +
    `longest run ${Math.max(summary.value.me.longestRun, summary.value.partner.longestRun)}.`,
);

// Night strip and the detail row under it
const selectedDate = ref(null);
const selectedNight = computed(
  () => nights.value.find((n) => n.date === selectedDate.value) ?? null,
);
function selectNight(night) {
  sentMessage.value = "";
  selectedDate.value = selectedDate.value === night.date ? null : night.date;
}

function describeNight(night) {
  if (night.who === "open")
    return { title: "Open", detail: "Nobody is on duty yet." };
  if (night.shared) {
    return {
      title: `${nameOf(night.who)} first half, then ${nameOf(night.second)}`,
      detail: `Shared night. Handover at ${formatHandover(night.handoverTime || store.view.handoverTime)}${night.resting ? `, protecting ${nameOf(night.resting)} for an early start.` : "."}`,
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
  return `${dateLabel(night.date)}${today}. ${d.title}`;
}

// History: earlier weeks, newest first, from the same shared plan.
const PAGE_WEEKS = 4;
const historyCount = ref(PAGE_WEEKS);
const planStart = computed(() =>
  isIsoDate(store.view.startDate) ? store.view.startDate : null,
);
const weekInPlan = (ws) =>
  !planStart.value || addDays(ws, 6) >= planStart.value;
const historyWeeks = computed(() => {
  const out = [];
  for (let i = 1; i <= historyCount.value; i += 1) {
    const ws = addDays(currentWeek, -7 * i);
    if (!weekInPlan(ws)) break;
    const sum = restSummary(weekNights(store.view, ws));
    const parts = [
      `${myName.value} ${nightsText(sum.me.onDuty)}`,
      `${partnerName.value} ${nightsText(sum.partner.onDuty)}`,
    ];
    if (sum.shared) parts.push(`${sum.shared} shared`);
    if (sum.open) parts.push(`${sum.open} open`);
    parts.push(
      `longest run ${Math.max(sum.me.longestRun, sum.partner.longestRun)}`,
    );
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
  () =>
    historyCount.value < 52 &&
    weekInPlan(addDays(currentWeek, -7 * (historyCount.value + 1))),
);
function showEarlier() {
  historyCount.value += PAGE_WEEKS;
}

// Plan settings
const PATTERN_OPTIONS = [
  { value: "manual", label: "Set rotation schedule yourself" },
  { value: "alternate", label: "Alternate nights" },
  { value: "smart", label: "Use NurtureTrack smart rotation system" },
];
const selectedPattern = ref("alternate");

const setupStartDate = ref(store.view.startDate || todayIso);
const earlyStarts = ref({ me: [], partner: [] });
const localPlan = ref([]);
const localPlanStart = ref("");
const handoverEnabled = ref(false);
const handoverClock = ref("02:00");
const handoverParent = ref("partner");

function removeHandover(night) {
  if (!night.handoverTime) return night;
  return {
    ...night,
    shared: false,
    second: null,
    handoverTime: null,
    source: night.source === "handover" ? "smart" : night.source,
  };
}

function addOptionalHandover(night) {
  // Handover is an additional layer. It must never replace the Smart
  // Rotation owner, because that owner was selected using early starts.
  const baseNight = removeHandover(night);
  if (
    selectedPattern.value !== "manual" ||
    !handoverEnabled.value ||
    baseNight.who === "open"
  ) {
    return baseNight;
  }

  // Never let the same parent be both the first and second parent.
  const takeOverParent =
    handoverParent.value === baseNight.who
      ? otherOf(baseNight.who)
      : handoverParent.value;

  return {
    ...baseNight,
    shared: true,
    second: takeOverParent,
    handoverTime: handoverClock.value,
    source: baseNight.source || "handover",
  };
}

function readLocalPlan() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("nurturetrack-smart-rota-plan") || "null",
    );
    if (saved?.startDate && Array.isArray(saved.plan)) {
      localPlanStart.value = saved.startDate;
      localPlan.value = saved.plan;
      setupStartDate.value = saved.startDate;
      earlyStarts.value = saved.earlyStarts || { me: [], partner: [] };
      selectedPattern.value = "smart";
      handoverEnabled.value = Boolean(saved.handoverEnabled);
      handoverClock.value = saved.handoverClock || "02:00";
      handoverParent.value = saved.handoverParent || "partner";
    }
  } catch (error) {
    console.warn("Saved sleep rota data could not be read.", error);
  }
}

function buildLocalPlan() {
  return setupDays.value.map((day, index) => {
    const followingMorning = addDateOnly(day.date, 1);
    let who = index % 2 === 0 ? "me" : "partner";
    let resting = null;

    if (earlyStarts.value.me.includes(followingMorning)) {
      who = "partner";
      resting = "me";
    }
    if (earlyStarts.value.partner.includes(followingMorning)) {
      who = "me";
      resting = "partner";
    }

    return { date: day.date, who, resting, shared: false, source: "smart" };
  });
}

readLocalPlan();

function addDateOnly(value, amount) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}
const setupDays = computed(() => {
  if (!isIsoDate(setupStartDate.value)) return [];
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDateOnly(setupStartDate.value, index);
    return { date, label: weekdayShort(date), number: dayNumber(date) };
  });
});
const confirmReset = ref(false);
const setupStatus = ref("");
async function doReset() {
  try {
    await store.reset();

    // Reset means no parent is assigned to any night.
    // Manual mode keeps the This week calendar open but empty.
    store.setPattern("manual");
    selectedPattern.value = "manual";
    earlyStarts.value = { me: [], partner: [] };
    setupStartDate.value = todayIso;

    confirmReset.value = false;
    selectedDate.value = null;
    weekStart.value = currentWeek;
    tab.value = "week";
  } catch (error) {
    console.error("Could not reset rota", error);
  }
}
function onStart(event) {
  if (!event.target.value) return;
  setupStartDate.value = event.target.value;
  store.setStartDate(event.target.value);
}
function onHandover(event) {
  if (event.target.value) store.setHandoverTime(event.target.value);
}

function toggleEarlyStart(who, date) {
  const current = earlyStarts.value[who];
  earlyStarts.value = {
    ...earlyStarts.value,
    [who]: current.includes(date)
      ? current.filter((item) => item !== date)
      : [...current, date],
  };
}

function hasEarlyStart(who, date) {
  return earlyStarts.value[who].includes(date);
}

function onPatternChange(pattern) {
  selectedPattern.value = pattern;
  if (pattern !== "manual") {
    handoverEnabled.value = false;
  }
  store.setPattern(pattern === "smart" ? "alternate" : pattern);
}

async function assignSelectedNight(owner) {
  if (!selectedNight.value) return;
  try {
    await store.setOverride(selectedNight.value.date, owner);
    sentMessage.value = `${nameOf(owner)} is now assigned to ${dateLabel(selectedNight.value.date)}.`;
  } catch (error) {
    console.error("Could not assign rota night", error);
  }
}

async function finishSetup() {
  if (!isIsoDate(setupStartDate.value)) {
    setupStatus.value = "Choose a valid start date first.";
    return;
  }

  tab.value = "week";
  weekStart.value = mondayOf(new Date(`${setupStartDate.value}T00:00:00`));
  setupStatus.value = "Your plan is being prepared…";

  if (selectedPattern.value === "smart") {
    localPlanStart.value = setupStartDate.value;
    localPlan.value = setupDays.value.map((day, index) => {
      const nextMorning = addDateOnly(day.date, 1);
      let who = index % 2 === 0 ? "me" : "partner";
      let resting = null;
      if (earlyStarts.value.me.includes(nextMorning)) {
        who = "partner";
        resting = "me";
      }
      if (earlyStarts.value.partner.includes(nextMorning)) {
        who = "me";
        resting = "partner";
      }
      const night = {
        date: day.date,
        who,
        resting,
        shared: false,
        source: "smart",
      };
      return addOptionalHandover(night);
    });

    localStorage.setItem(
      "nurturetrack-smart-rota-plan",
      JSON.stringify({
        startDate: setupStartDate.value,
        earlyStarts: earlyStarts.value,
        plan: localPlan.value.map(removeHandover),
        handoverEnabled: handoverEnabled.value,
        handoverClock: handoverClock.value,
        handoverParent: handoverParent.value,
        savedAt: new Date().toISOString(),
      }),
    );
  }

  try {
    store.setPattern(
      selectedPattern.value === "manual" ? "manual" : "alternate",
    );
    store.setStartDate(setupStartDate.value);
    if (selectedPattern.value === "smart") {
      for (const night of localPlan.value) {
        await store.setOverride(night.date, night.who);
      }
    }
    setupStatus.value = "This week plan is ready.";
  } catch (error) {
    console.warn(
      "Shared rota sync failed; local plan is still available.",
      error,
    );
    setupStatus.value = "This week plan is ready on this device.";
  }
}
</script>

<template>
  <div class="rt">
    <header class="rt__head">
      <h1 class="nt-title rt__title">Sleep rotation</h1>
      <p class="rt__sub">
        Set up the week around both parents’ early starts, then review the
        shared calendar.
      </p>
    </header>

    <Tabs
      v-model="tab"
      :tabs="TABS"
      label="Sleep rotation sections"
      id-base="rota"
    />

    <div aria-live="polite">
      <p v-if="loading" class="rt__muted">Loading the rota...</p>
    </div>

    <div
      v-if="!loading && errorInfo"
      class="rt__error alert alert-danger"
      role="alert"
    >
      <p class="mb-0">{{ errorInfo.text }}</p>
      <p v-if="errorInfo.detail" class="rt__muted">{{ errorInfo.detail }}</p>
      <button type="button" class="app-textbtn" @click="retry">
        Try again
      </button>
    </div>

    <template v-if="!loading && !errorInfo">
      <p v-if="store.writeError" class="app-error-text" role="alert">
        {{ store.writeError }}
      </p>

      <!-- This week -->
      <div
        v-if="tab === 'week'"
        id="rota-panel-week"
        class="rt__week-panel"
        role="tabpanel"
        aria-labelledby="rota-tab-week"
      >
        <div class="rt__main">
          <section
            class="rt__block rt__card"
            aria-labelledby="rota-week-heading"
          >
            <h2 id="rota-week-heading" class="visually-hidden">
              Nights this week
            </h2>
            <div class="rt__nav">
              <button
                type="button"
                class="rt__icon"
                aria-label="Previous week"
                @click="shiftWeek(-1)"
              >
                <Icon name="chevron-left" :size="18" />
              </button>
              <p class="rt__week" aria-live="polite">
                {{ visibleWeekLabel }}
              </p>
              <button
                type="button"
                class="rt__icon"
                aria-label="Next week"
                @click="shiftWeek(1)"
              >
                <Icon name="chevron" :size="18" />
              </button>
              <button
                v-if="weekStart !== currentWeek"
                type="button"
                class="app-textbtn"
                @click="goToThisWeek"
              >
                This week
              </button>
            </div>

            <ol class="rt__strip" aria-label="Nights this week">
              <li
                v-for="night in nights"
                :key="night.date"
                class="rt__night"
                :data-date="night.date"
              >
                <button
                  type="button"
                  class="rt__cell"
                  :class="{
                    'rt__cell--today': night.date === todayIso,
                    'rt__cell--on': selectedDate === night.date,
                  }"
                  :aria-pressed="selectedDate === night.date ? 'true' : 'false'"
                  :aria-label="cellLabel(night)"
                  @click="selectNight(night)"
                >
                  <span class="rt__dow">{{ weekdayShort(night.date) }}</span>
                  <span class="rt__num">{{ dayNumber(night.date) }}</span>
                  <span
                    class="rt__mark"
                    :class="`rt__mark--${night.shared ? 'split' : night.who}`"
                    aria-hidden="true"
                  >
                    <svg
                      v-if="night.shared"
                      viewBox="0 0 28 28"
                      width="28"
                      height="28"
                      class="rt__moon"
                    >
                      <circle
                        cx="14"
                        cy="14"
                        r="13"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1"
                      />
                      <path
                        d="M14 1 A13 13 0 0 0 14 27 Z"
                        fill="currentColor"
                      />
                    </svg>
                    <template v-else-if="night.who === 'open'"></template>
                    <template v-else>{{ initialOf(night.who) }}</template>
                  </span>
                  <span class="rt__tonight">{{
                    night.date === todayIso ? "Tonight" : ""
                  }}</span>
                </button>
              </li>
            </ol>

            <p v-if="sentMessage" class="rt__muted" role="status">
              {{ sentMessage }}
            </p>
            <div v-else class="visually-hidden" role="status"></div>

            <div
              v-if="selectedNight"
              class="rt__detail"
              :data-detail="selectedNight.date"
            >
              <p class="rt__detail-title">
                {{ dateLabel(selectedNight.date) }}.
                {{ describeNight(selectedNight).title }}
              </p>
              <p class="rt__muted">
                {{ describeNight(selectedNight).detail }}
              </p>
              <p class="rt__detail-actions">
                <template v-if="selectedNight.who === 'open'">
                  <button
                    type="button"
                    class="app-textbtn"
                    @click="assignSelectedNight('me')"
                  >
                    I take it
                  </button>
                  <button
                    type="button"
                    class="app-textbtn"
                    @click="assignSelectedNight('partner')"
                  >
                    {{ partnerName }} takes it
                  </button>
                </template>
                <template v-else>
                  <button
                    v-if="selectedNight.source === 'override'"
                    type="button"
                    class="app-textbtn"
                    @click="store.setOverride(selectedNight.date, null)"
                  >
                    {{
                      store.view.pattern === "manual"
                        ? "Make open"
                        : "Back to plan"
                    }}
                  </button>
                </template>
              </p>
            </div>
          </section>
        </div>

        <div class="rt__rail">
          <section class="rt__block rt__card" aria-labelledby="rota-rest">
            <div class="rt__card-head">
              <span class="rt__icon-sq" aria-hidden="true"
                ><Icon name="moon" :size="18"
              /></span>
              <h2 id="rota-rest" class="rt__h2">Rest check</h2>
            </div>
            <p class="rt__text">{{ restLine }}</p>
            <div
              class="rt__bar"
              role="img"
              :aria-label="`${myName}: ${summary.me.onDuty} of 7 nights on duty. ${partnerName}: ${summary.partner.onDuty} of 7 nights on duty.`"
            >
              <span
                class="rt__seg rt__seg--me"
                :style="{ flexGrow: summary.me.onDuty }"
              ></span>
              <span
                class="rt__seg rt__seg--shared"
                :style="{ flexGrow: summary.shared }"
              ></span>
              <span
                class="rt__seg rt__seg--partner"
                :style="{ flexGrow: summary.partner.onDuty }"
              ></span>
            </div>
            <p v-if="summary.shared || summary.open" class="rt__muted">
              <span v-if="summary.shared"
                >{{ summary.shared }} shared nights.
              </span>
              <span v-if="summary.open"
                >{{ summary.open }} nights still open.</span
              >
            </p>
            <p class="rt__text">{{ suggestion.text }}</p>
            <p v-if="suggestion.action" class="rt__detail-actions">
              <button
                type="button"
                class="app-textbtn"
                @click="applySuggestion"
              >
                Apply suggestion
              </button>
            </p>
            <p class="rt__muted">
              Discuss any changes together, then adjust the night card directly.
            </p>
          </section>

          <section class="rt__block rt__card" aria-labelledby="rota-past">
            <h2 id="rota-past" class="rt__h2">History</h2>
            <p v-if="!historyWeeks.length" class="rt__muted">
              No earlier weeks yet.
            </p>
            <ul v-else class="rt__weeks">
              <li
                v-for="w in historyWeeks"
                :key="w.weekStart"
                class="rt__past"
                :data-week="w.weekStart"
              >
                <p class="rt__text">
                  <strong>{{ w.label }}</strong
                  >: {{ w.text }}.
                </p>
                <div class="rt__bar rt__bar--thin" aria-hidden="true">
                  <span
                    class="rt__seg rt__seg--me"
                    :style="{ flexGrow: w.me }"
                  ></span>
                  <span
                    class="rt__seg rt__seg--shared"
                    :style="{ flexGrow: w.shared }"
                  ></span>
                  <span
                    class="rt__seg rt__seg--partner"
                    :style="{ flexGrow: w.partner }"
                  ></span>
                </div>
              </li>
            </ul>
            <p v-if="canShowEarlier" class="rt__detail-actions">
              <button type="button" class="app-textbtn" @click="showEarlier">
                Show earlier weeks
              </button>
            </p>
          </section>
        </div>
      </div>

      <!-- Plan settings -->
      <div
        v-else
        id="rota-panel-settings"
        class="rt__single rt__card rt__settings"
        role="tabpanel"
        aria-labelledby="rota-tab-settings"
      >
        <div class="rt__cols">
          <div class="rt__col">
            <fieldset class="rt__fieldset">
              <legend class="rt__label">Pattern</legend>
              <label
                v-for="o in PATTERN_OPTIONS"
                :key="o.value"
                class="rt__radio"
              >
                <input
                  type="radio"
                  name="rota-pattern"
                  :value="o.value"
                  :checked="selectedPattern === o.value"
                  @change="onPatternChange(o.value)"
                />
                <span>{{ o.label }}</span>
              </label>
              <p v-if="selectedPattern === 'manual'" class="rt__muted">
                Every night starts open. You can assign each night yourself from
                This week.
              </p>
              <p v-else-if="selectedPattern === 'alternate'" class="rt__muted">
                Mum and Dad take turns owning the whole night.
              </p>
              <p v-else class="rt__muted">
                NurtureTrack uses early starts and whole-night balance to
                suggest the plan for you.
              </p>
            </fieldset>

            <fieldset
              v-if="selectedPattern === 'smart'"
              class="rt__fieldset rt__early-fieldset"
            >
              <legend class="rt__label">Early start planning</legend>
              <p class="rt__muted">
                Select the mornings when each parent needs extra protected
                sleep. The other parent will handle the night before.
              </p>

              <div class="rt__early-section">
                <h3 class="rt__early-heading">
                  Select early start days for {{ myName }}
                </h3>
                <div class="rt__early-days">
                  <button
                    v-for="day in setupDays"
                    :key="`mum-${day.date}`"
                    type="button"
                    class="rt__early-day"
                    :class="{
                      'rt__early-day--selected': hasEarlyStart('me', day.date),
                    }"
                    :aria-pressed="
                      hasEarlyStart('me', day.date) ? 'true' : 'false'
                    "
                    @click="toggleEarlyStart('me', day.date)"
                  >
                    <span>{{ day.label }}</span>
                    <strong>{{ day.number }}</strong>
                    <small>{{
                      hasEarlyStart("me", day.date) ? "Selected" : "Select"
                    }}</small>
                  </button>
                </div>
              </div>

              <div class="rt__early-section">
                <h3 class="rt__early-heading">
                  Select early start days for {{ partnerName }}
                </h3>
                <div class="rt__early-days">
                  <button
                    v-for="day in setupDays"
                    :key="`dad-${day.date}`"
                    type="button"
                    class="rt__early-day rt__early-day--dad"
                    :class="{
                      'rt__early-day--selected-dad': hasEarlyStart(
                        'partner',
                        day.date,
                      ),
                    }"
                    :aria-pressed="
                      hasEarlyStart('partner', day.date) ? 'true' : 'false'
                    "
                    @click="toggleEarlyStart('partner', day.date)"
                  >
                    <span>{{ day.label }}</span>
                    <strong>{{ day.number }}</strong>
                    <small>{{
                      hasEarlyStart("partner", day.date) ? "Selected" : "Select"
                    }}</small>
                  </button>
                </div>
              </div>
            </fieldset>
          </div>
          <div class="rt__col">
            <div class="rt__fields">
              <label class="rt__field">
                <span class="rt__label">Start date</span>
                <input
                  class="app-control"
                  type="date"
                  :value="setupStartDate"
                  @change="onStart"
                />
              </label>
              <fieldset
                v-if="selectedPattern === 'manual'"
                class="rt__fieldset rt__handover-fieldset"
              >
                <legend class="rt__label">Optional mid-night handover</legend>
                <label class="rt__radio">
                  <input v-model="handoverEnabled" type="checkbox" />
                  <span>Use a handover in the middle of the night</span>
                </label>
                <template v-if="handoverEnabled">
                  <label class="rt__field">
                    <span class="rt__label">Handover at</span>
                    <input
                      v-model="handoverClock"
                      class="app-control"
                      type="time"
                    />
                  </label>
                  <label class="rt__field">
                    <span class="rt__label">Who takes over?</span>
                    <select v-model="handoverParent" class="app-control">
                      <option value="me">{{ myName }}</option>
                      <option value="partner">{{ partnerName }}</option>
                    </select>
                  </label>
                  <p class="rt__muted">
                    The primary parent starts the night. The selected parent
                    takes over at this time.
                  </p>
                </template>
              </fieldset>
            </div>

            <p v-if="savedLine" class="rt__muted">{{ savedLine }}</p>
          </div>
        </div>

        <div class="rt__setup-next">
          <p class="rt__muted">
            Your settings and early starts will be used to fill the This week
            calendar.
          </p>
          <button
            type="button"
            class="app-button rt__save-button"
            @click.stop.prevent="finishSetup"
          >
            {{
              selectedPattern === "smart"
                ? "Generate suggested plan →"
                : "Save settings and view This week →"
            }}
          </button>
          <p v-if="setupStatus" class="rt__setup-status" role="status">
            {{ setupStatus }}
          </p>
        </div>

        <div v-if="!confirmReset" class="rt__foot">
          <button type="button" class="rt__danger" @click="confirmReset = true">
            Reset plan
          </button>
        </div>
        <div
          v-else
          class="rt__confirm rt__foot"
          role="group"
          aria-label="Confirm reset"
        >
          <p class="rt__muted">
            Reset the plan and clear every set night for both of you?
          </p>
          <button type="button" class="rt__danger" @click="doReset">
            Yes, reset plan
          </button>
          <button
            type="button"
            class="app-textbtn"
            @click="confirmReset = false"
          >
            Keep plan
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rt {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin: 0;
  font-size: 1rem;
}
.rt__head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rt__title {
  font-size: 2.5rem;
  line-height: 1.2;
}
.rt__sub {
  margin: 0;
  font-size: 1rem;
  color: var(--nt-muted);
}
.rt__muted {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--nt-muted);
}
.rt__text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--nt-ink);
}
.rt__h2 {
  margin: 0;
  font-family: inherit;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--nt-ink);
}

.rt__card {
  background: var(--nt-surface, #fff);
  border: 1px solid var(--nt-line);
  border-radius: 12px;
  padding: 24px;
}
.rt__card-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rt__icon-sq {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--nt-powder);
  color: var(--nt-plum);
}

.rt__week-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.rt__main,
.rt__rail {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}
.rt__block {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: flex-start;
  min-width: 0;
}
.rt__block > * {
  max-width: 100%;
}

.rt__nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rt__week {
  margin: 0 8px;
  min-width: 150px;
  text-align: center;
  font-size: 1rem;
  font-weight: 600;
  color: var(--nt-ink);
}
.rt__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: var(--nt-muted);
  cursor: pointer;
}
.rt__icon:hover {
  color: var(--nt-ink);
}
.rt__icon:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 2px;
}

.rt__strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rt__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 168px;
  padding: 14px 2px 12px;
  background: var(--nt-surface, #fff);
  border: 1px solid var(--nt-line);
  border-radius: 10px;
  font: inherit;
  color: var(--nt-ink);
  cursor: pointer;
}
.rt__cell:hover {
  background: rgb(59 47 63 / 4%);
}
.rt__cell:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 2px;
}
.rt__cell--on {
  background: rgb(59 47 63 / 6%);
  border-color: var(--nt-muted);
}
.rt__cell--today {
  border-color: var(--nt-plum);
}
.rt__dow {
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.rt__num {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.15;
}
.rt__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--nt-muted);
  border-radius: 50%;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--nt-ink);
}
.rt__mark--me {
  border-color: var(--nt-apricot-d);
  background: var(--nt-apricot);
}
.rt__mark--partner {
  border-color: var(--nt-powder-d);
  background: var(--nt-powder);
}
.rt__mark--open {
  border-style: dashed;
  border-color: var(--nt-muted);
}
.rt__mark--split {
  border: 0;
  color: var(--nt-plum);
}
.rt__moon {
  display: block;
}
.rt__tonight {
  min-height: 18px;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 18px;
  color: var(--nt-plum);
}

.rt__detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 16px 0 0;
  border-top: 1px solid var(--nt-line);
}
.rt__detail-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--nt-ink);
}
.rt__detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin: 0;
}
.rt__label {
  margin: 0;
  padding: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--nt-ink);
}
.rt__fieldset {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.rt__fieldset legend {
  float: none;
  width: auto;
  margin-bottom: 4px;
}
.rt__radio {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
  font-size: 0.9375rem;
  color: var(--nt-ink);
  cursor: pointer;
}
.rt__radio input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--nt-plum);
  cursor: pointer;
}
.rt__radio input:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 2px;
}
.rt__select {
  max-width: 280px;
}

.rt__bar {
  display: flex;
  width: 100%;
  height: 6px;
  overflow: hidden;
  background: var(--nt-line);
  border-radius: 3px;
}
.rt__bar--thin {
  height: 4px;
}
.rt__seg {
  display: block;
  flex-basis: 0;
  flex-shrink: 0;
  min-width: 0;
}
.rt__seg--me {
  background: var(--nt-apricot-d);
}
.rt__seg--partner {
  background: var(--nt-powder-d);
}
.rt__seg--shared {
  background: #b9b0bc;
}

.rt__weeks {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--nt-line);
}
.rt__past {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--nt-line);
}

.rt__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  max-width: 720px;
}
.rt__single {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.rt__single section .rt__h2 {
  margin-bottom: 8px;
}
.rt__list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--nt-line);
}
.rt__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--nt-line);
}
.rt__name {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  color: var(--nt-ink);
}
.rt__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
}
.rt__cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 28px;
}
.rt__col {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}
.rt__fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rt__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 280px;
}
.rt__foot {
  padding-top: 20px;
  border-top: 1px solid var(--nt-line);
}
.rt__confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
}
.rt__danger {
  padding: 0;
  background: none;
  border: 0;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--nt-coral);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.rt__danger:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 2px;
  border-radius: 4px;
}

@media (min-width: 900px) {
  .rt__cols {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 48px;
  }
}
@media (min-width: 1100px) {
  .rt__week-panel {
    grid-template-columns: minmax(0, 1fr) 360px;
  }
}
@media (max-width: 575px) {
  .rt__title {
    font-size: 2rem;
  }
  .rt__card {
    padding: 20px 16px;
  }
  .rt__strip {
    gap: 4px;
  }
  .rt__cell {
    min-height: 128px;
  }
  .rt__num {
    font-size: 1.25rem;
  }
  .rt__mark {
    width: 24px;
    height: 24px;
  }
}
.rt__setup-next {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--nt-line);
}
.rt__setup-next .rt__muted {
  max-width: 460px;
}
@media (max-width: 640px) {
  .rt__setup-next {
    align-items: stretch;
    flex-direction: column;
  }
}
.rt__early-fieldset {
  width: 100%;
}
.rt__early-section {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--nt-line);
}
.rt__early-heading {
  margin: 0 0 11px;
  color: var(--nt-ink);
  font-size: 0.875rem;
  font-weight: 600;
}
.rt__early-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}
.rt__early-day {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 9px 4px;
  border: 1px solid var(--nt-line);
  border-radius: 9px;
  background: var(--nt-paper, #fff);
  color: var(--nt-muted);
  cursor: pointer;
}
.rt__early-day:hover {
  border-color: var(--nt-plum);
}
.rt__early-day span {
  font-size: 0.625rem;
}
.rt__early-day strong {
  color: var(--nt-ink);
  font-size: 0.875rem;
}
.rt__early-day small {
  font-size: 0.5625rem;
}
.rt__early-day--selected {
  border-color: #d88868;
  background: #f8e2d8;
  color: #8b4e3b;
}
.rt__early-day--selected-dad {
  border-color: #7eafa1;
  background: #e1f0eb;
  color: #416c5b;
}
.rt__early-day--selected strong,
.rt__early-day--selected-dad strong {
  color: currentColor;
}
.rt__early-example {
  margin: 18px 0 0;
  padding: 11px 13px;
  border-radius: 8px;
  background: var(--nt-powder);
  color: var(--nt-muted);
  font-size: 0.75rem;
}
.rt__save-button {
  border: 0;
  cursor: pointer;
}
.rt__setup-status {
  margin: 8px 0 0;
  color: var(--nt-muted);
  font-size: 0.8125rem;
}
</style>
