<script setup>
import LoadingScreen from "@/app/components/LoadingScreen.vue";
import "@/app/app.css";
import { computed, inject, nextTick, onMounted, ref, watch } from "vue";
import Collapse from "@/app/components/Collapse.vue";
import DaySchedule from "@/app/components/DaySchedule.vue";
import DateWheel from "@/app/components/DateWheel.vue";
import PageHero from "@/app/components/PageHero.vue";
import StatusPill from "@/app/components/StatusPill.vue";
import Icon from "@/app/components/Icon.vue";
import PickField from "@/app/components/PickField.vue";
import SegToggle from "@/app/components/SegToggle.vue";
import TimeWheel from "@/app/components/TimeWheel.vue";
import { formatHhmm, formatIsoDate } from "@/app/utils/pickerHelpers";
import { usePrefs } from "@/app/composables/usePrefs";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";
import {
  addDays,
  buildFairPlan,
  dateLabel,
  dayNumber,
  formatHandover,
  isIsoDate,
  joinNames,
  mondayOf,
  otherOf,
  restSummary,
  suggest,
  toIso,
  weekdayShort,
  weekLabel,
  weekNights,
} from "@/app/utils/rotaHelpers";
import { describeSharedError } from "@/app/utils/sharedHelpers";
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
const hasPartner = computed(() => Boolean(home?.partner?.value));
const partnerName = computed(() => fullName(home?.partner?.value, "Partner"));
const names = computed(() => ({
  me: myName.value,
  partner: partnerName.value,
}));
const nameOf = (who) => names.value[who] ?? "";
const initialOf = (who) => nameOf(who).trim().charAt(0).toUpperCase();
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

const settingsOpen = ref(false);
// The home card sends you here with #day.
onMounted(async () => {
  if (window.location.hash !== "#day") return;
  await nextTick();
  document.getElementById("day")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

const { babies, selectedBaby } = useSelectedBaby();
// Carers who can see the duty page (the "View who is on duty" permission) can also take nights.
const firstWord = (full) => {
  const w = String(full ?? "").trim().split(/\s+/)[0] || "";
  return w.charAt(0).toUpperCase() + w.slice(1);
};
const carers = computed(() =>
  (home?.members?.value ?? [])
    .filter((m) => m?.uid && m.accessLevel === "caregiver" && m.permissions?.dutyView === true)
    .map((m) => ({ uid: m.uid, label: firstWord(m.displayName) || "Carer" })),
);
// When a carer with "Edit the day schedule" changed the shifts last, say so, so nothing moves unnoticed.
const lastEditedByCarer = computed(() => {
  const by = store.plan?.updatedBy;
  const m = (home?.members?.value ?? []).find((x) => x?.uid === by && x.accessLevel === "caregiver");
  if (!m) return "";
  const at = store.plan?.updatedAt?.toDate?.();
  const when = at ? `, ${at.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][at.getMonth()]}` : "";
  return `Shifts last changed by ${firstWord(m.displayName) || "a carer"}${when}.`;
});
watch(carers, (list) => store.setCarers(Object.fromEntries(list.map((c) => [c.uid, c.label]))), { immediate: true });
const carerNames = computed(() => [...new Set([...carers.value.map((c) => c.label), ...(store.view.carerNights ?? []).map((c) => c.label)])]);
const CARER_DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const CARER_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const carerDays = (c) => (store.view.carerNights ?? []).find((x) => x.uid === c.uid)?.days ?? [];
function toggleCarerDay(c, day) {
  const days = new Set(carerDays(c));
  if (days.has(day)) days.delete(day);
  else days.add(day);
  const rest = (store.view.carerNights ?? []).filter((x) => x.uid !== c.uid);
  store.setCarerNights([...rest, { uid: c.uid, label: c.label, days: [...days] }]);
}
const markText = (night) => (night.who === "other" ? String(night.label || "?").charAt(0).toUpperCase() : initialOf(night.who));
// The plan covers every baby, so the text names them all.
const babyLabel = computed(() => joinNames(babies.value.map((b, i) => b.babyName || `Baby ${i + 1}`)) || selectedBaby.value?.babyName || home?.baby?.value?.name || "the baby");
const todayIso = toIso(new Date());
const { timeFormat } = usePrefs();
// Who has the baby right now, for the pill in the header: a painted daytime hour first, then the night plan.
const carerNow = computed(() => {
  try {
    const d = new Date();
    const hour = d.getHours();
    const cell = store.view.coverFor?.((d.getDay() + 6) % 7)?.[hour];
    const label = (who, other) => (who === "me" ? "You" : who === "both" ? "You both" : who === "other" ? other || "Someone else" : nameOf(who));
    if (cell?.who) return { text: label(cell.who, cell.label), verb: cell.who === "me" || cell.who === "both" ? "are" : "is" };
    if (hour >= 18 || hour < 6) {
      const day = new Date(d);
      if (hour < 6) day.setDate(day.getDate() - 1);
      const iso = toIso(day);
      const night = (weekNights(store.view, mondayOf(iso)) || []).find((n) => n.date === iso);
      if (!night || night.who === "open") return null;
      const who = night.shared && hour >= 0 && hour < 6 ? night.second : night.who;
      return { text: who === "other" ? night.label : label(who), verb: who === "me" ? "are" : "is" };
    }
  } catch {
    return null;
  }
  return null;
});
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
  if (night.who === "other") {
    return {
      title: `${night.label} on duty`,
      detail: `${night.label} has this night every week. Handover at ${handover.value}.`,
    };
  }
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

// Plan settings. Alternating and the early-starts plan both hand nights to "partner", so
// solo households (nobody else has joined) only get to set nights themselves.
const PATTERN_OPTIONS = computed(() =>
  hasPartner.value
    ? [
        { value: "manual", label: "I will set each night", hint: "Every night starts open. Assign them yourselves from This week." },
        { value: "alternate", label: "Alternate nights", hint: "You take turns owning the whole night." },
        { value: "smart", label: "Plan around early starts", hint: "Tell us your early mornings and we protect them." },
      ]
    : [{ value: "manual", label: "I will set each night", hint: "Every night starts open. Assign them from This week." }],
);
// "manual" is always a safe starting value; the correct default (and any saved plan) is set
// once household data has actually loaded, below.
const selectedPattern = ref("manual");
// A partner who leaves mid-session should never leave the page on a pattern that only makes
// sense with someone to alternate with. Not `immediate`: the initial case (hasPartner still
// settling after mount) is handled by the one-shot initialiser below instead.
watch(hasPartner, (has) => {
  if (!has && selectedPattern.value !== "manual") selectedPattern.value = "manual";
  // The handover toggle only makes sense with a partner too: without this, a handover
  // left on from when a partner was still around could silently hand a "second" carer
  // slot to "partner" on a now-solo household's saved nights (see addOptionalHandover).
  if (!has && handoverEnabled.value) handoverEnabled.value = false;
});

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

// Restores a saved setup draft, and reports whether it found one to restore.
function readLocalPlan() {
  // A plan saved from an earlier, two-person household is meaningless once nobody is there
  // to take the "partner" half of it, so a solo household never restores it.
  if (!hasPartner.value) return false;
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
      return true;
    }
  } catch (error) {
    console.warn("Saved sleep rota data could not be read.", error);
  }
  return false;
}

// Household data, including whether a partner has joined, loads after this page mounts, so
// the starting pattern (a restored draft, or the right default) is only settled once that has
// loaded and hasPartner is accurate. Guarded to run only once, the first time loading clears.
let patternInitialised = false;
watch(loading, (isLoading) => {
  if (isLoading || patternInitialised) return;
  patternInitialised = true;
  const restored = readLocalPlan();
  if (!restored) selectedPattern.value = hasPartner.value ? "alternate" : "manual";
}, { immediate: true });

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
const startOpen = ref(false);
const handoverOpen = ref(false);
const startModel = computed({
  get: () => setupStartDate.value,
  set: (v) => {
    if (!isIsoDate(v)) return;
    setupStartDate.value = v;
    store.setStartDate(v);
  },
});
const handoverMode = computed({
  get: () => (handoverEnabled.value ? "on" : "off"),
  set: (v) => {
    handoverEnabled.value = v === "on";
    if (v !== "on") handoverOpen.value = false;
  },
});
const HANDOVER_MODES = [
  { value: "off", label: "Whole night" },
  { value: "on", label: "Hand over mid-night" },
];
const takeoverOptions = computed(() =>
  hasPartner.value
    ? [{ value: "me", label: myName.value }, { value: "partner", label: partnerName.value }]
    : [{ value: "me", label: myName.value }],
);
const confirmReset = ref(false);
const setupStatus = ref("");
// Anything the suggested plan could not honour, in plain words.
const planNotes = ref([]);
async function doReset() {
  try {
    await store.reset();

    // Reset means no parent is assigned to any night.
    // Manual mode keeps the This week calendar open but empty.
    store.setPattern("manual");
    selectedPattern.value = "manual";
    earlyStarts.value = { me: [], partner: [] };
    planNotes.value = [];
    setupStartDate.value = todayIso;

    confirmReset.value = false;
    selectedDate.value = null;
    weekStart.value = currentWeek;
    settingsOpen.value = false;
  } catch (error) {
    console.error("Could not reset rota", error);
  }
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

  settingsOpen.value = false;
  weekStart.value = mondayOf(new Date(`${setupStartDate.value}T00:00:00`));
  setupStatus.value = "Your plan is being prepared…";

  if (selectedPattern.value === "smart") {
    localPlanStart.value = setupStartDate.value;
    // A fair plan: the carers keep their nights, every early start is honoured where it can be, and the
    // parents' nights are split as evenly as they can be.
    const fair = buildFairPlan({
      nights: setupDays.value.map((day) => day.date),
      carers: store.view.carerNights ?? [],
      early: earlyStarts.value,
      firstOnDuty: "me",
    });
    localPlan.value = fair.nights.map(addOptionalHandover);
    planNotes.value = fair.notes.map((note) => note.text);

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
        // A carer's night is the carer's: clear any earlier choice so the weekly carer night shows.
        await store.setOverride(night.date, night.who === "other" ? null : night.who);
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
    <PageHero :eyebrow="hasPartner ? `Taking turns with ${partnerName}` : 'Duty'" title="Duty" :lead="`Who is looking after ${babyLabel}, day and night.`">
      <StatusPill v-if="carerNow" icon="moon" tone="ok">Now: {{ carerNow.text }} {{ carerNow.verb }} looking after {{ babyLabel }}</StatusPill>
    </PageHero>

    <div aria-live="polite">
      <LoadingScreen v-if="loading" variant="inline" label="Loading the rota" />
    </div>

    <div
      v-if="!loading && errorInfo"
      class="rt__error alert alert-danger"
      role="alert"
    >
      <p class="mb-0">{{ errorInfo.text }}</p>
      <p v-if="errorInfo.detail" class="rt__muted">{{ errorInfo.detail }}</p>
      <button type="button" class="rt__link" @click="retry">
        Try again
      </button>
    </div>

    <template v-if="!loading && !errorInfo">
      <p v-if="store.writeError" class="app-error-text" role="alert">
        {{ store.writeError }}
      </p>

      <!-- Day -->
      <section id="day" class="rt__card rt__daycard" aria-labelledby="rt-day">
        <h2 id="rt-day" class="rt__h2">Day</h2>
        <p class="rt__muted">Who looks after {{ babyLabel }} from 6 AM to 6 PM. Tap or drag on a day to add a shift.</p>
        <p v-if="lastEditedByCarer" class="rt__muted">{{ lastEditedByCarer }}</p>
        <DaySchedule :rota="store.view" :names="names" :has-partner="hasPartner" :allow-both="hasPartner" :baby-label="babyLabel" :carers="carerNames" @save="store.setSchedule" />
      </section>

      <!-- Night -->
      <section class="rt__card rt__nightcard" aria-labelledby="rt-night">
        <h2 id="rt-night" class="rt__h2">Night</h2>
        <div class="rt__block rt__weekblock">
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
                class="rt__link"
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
                    <template v-else>{{ markText(night) }}</template>
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

            <Collapse>
            <div
              v-if="selectedNight"
              :key="selectedNight.date"
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
                    class="rt__link"
                    @click="assignSelectedNight('me')"
                  >
                    I take it
                  </button>
                  <button
                    v-if="hasPartner"
                    type="button"
                    class="rt__link"
                    @click="assignSelectedNight('partner')"
                  >
                    {{ partnerName }} takes it
                  </button>
                </template>
                <template v-else>
                  <button
                    v-if="selectedNight.source === 'override'"
                    type="button"
                    class="rt__link"
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
            </Collapse>
                  </div>

        <div class="rt__rest">
            <div class="rt__card-head">
              <span class="rt__icon-sq" aria-hidden="true"
                ><Icon name="moon" :size="18"
              /></span>
              <h2 id="rota-rest" class="rt__h2">Rest check</h2>
            </div>
            <ul class="rt__counts" aria-label="Nights on duty this week">
              <li class="rt__count">
                <span class="rt__mark rt__mark--me" aria-hidden="true">{{ initialOf("me") }}</span>
                <span><strong>{{ summary.me.onDuty }}</strong> {{ summary.me.onDuty === 1 ? "night" : "nights" }}</span>
              </li>
              <li class="rt__count">
                <span class="rt__mark rt__mark--partner" aria-hidden="true">{{ initialOf("partner") }}</span>
                <span><strong>{{ summary.partner.onDuty }}</strong> {{ summary.partner.onDuty === 1 ? "night" : "nights" }}</span>
              </li>
              <li v-if="summary.carer" class="rt__count">
                <span class="rt__mark rt__mark--other" aria-hidden="true">+</span>
                <span><strong>{{ summary.carer }}</strong> {{ summary.carer === 1 ? "night" : "nights" }} with a carer</span>
              </li>
            </ul>
            <p class="rt__text">{{ suggestion.short || suggestion.text }}</p>
            <p v-if="suggestion.action" class="rt__detail-actions">
              <button type="button" class="rt__link" @click="applySuggestion">Apply</button>
            </p>
                  </div>

        <button type="button" class="rt__settingsbtn" :aria-expanded="settingsOpen ? 'true' : 'false'" aria-controls="rt-settings" @click="settingsOpen = !settingsOpen">
          <span>Night plan settings</span>
          <Icon name="chevron-down" :size="16" class="rt__settingschev" />
        </button>
        <Collapse>
          <div v-if="settingsOpen" id="rt-settings" class="rt__settings">
        <section class="rt__sec" aria-labelledby="rt-s-pattern">
          <h2 id="rt-s-pattern" class="rt__h2">How should nights be shared?</h2>
          <div class="rt__choices" role="radiogroup" aria-labelledby="rt-s-pattern">
            <label
              v-for="o in PATTERN_OPTIONS"
              :key="o.value"
              class="rt__choice"
              :class="{ 'rt__choice--on': selectedPattern === o.value }"
            >
              <input type="radio" name="rota-pattern" :value="o.value" :checked="selectedPattern === o.value" @change="onPatternChange(o.value)" />
              <span class="rt__choice-text">
                <span class="rt__choice-title">{{ o.label }}</span>
                <span class="rt__choice-hint">{{ o.hint }}</span>
              </span>
            </label>
          </div>
        </section>

        <section class="rt__sec" aria-labelledby="rt-s-carers">
          <h2 id="rt-s-carers" class="rt__h2">Night carers</h2>
          <p v-if="!carers.length" class="rt__muted">
            Helpers and family you invite can take fixed nights once "View who is on duty" is on for them in Caregiver access.
          </p>
          <template v-else>
            <p class="rt__muted">{{ hasPartner ? "Pick the nights each carer takes every week. You and your partner share the rest." : "Pick the nights each carer takes every week. You cover the rest." }}</p>
            <div v-for="c in carers" :key="c.uid" class="rt__carer">
              <span class="rt__carer-name">{{ c.label }}</span>
              <div class="rt__dchips" role="group" :aria-label="`Nights for ${c.label}`">
                <button
                  v-for="(d, i) in CARER_DAYS"
                  :key="i"
                  type="button"
                  class="rt__dchip"
                  :class="{ 'rt__dchip--on': carerDays(c).includes(i) }"
                  :aria-pressed="carerDays(c).includes(i) ? 'true' : 'false'"
                  :aria-label="CARER_DAY_NAMES[i]"
                  @click="toggleCarerDay(c, i)"
                >{{ d }}</button>
              </div>
            </div>
          </template>
        </section>

        <section class="rt__sec" aria-labelledby="rt-s-start">
          <h2 id="rt-s-start" class="rt__h2">When does it start?</h2>
          <div class="rt__field">
            <PickField label="Plan starts" :value="formatIsoDate(setupStartDate)" :open="startOpen" placeholder="Pick a day" @toggle="startOpen = !startOpen" />
            <Collapse>
              <div v-if="startOpen" class="rt__wheel"><DateWheel v-model="startModel" label="Plan start date" /></div>
            </Collapse>
          </div>
        </section>

        <Collapse>
          <section v-if="selectedPattern === 'smart'" class="rt__sec" aria-label="Early starts">
            <fieldset
              v-if="selectedPattern === 'smart'"
              class="rt__fieldset rt__early-fieldset"
            >
              <legend>Early starts</legend>
              <p class="rt__muted">
                Tap the mornings each of you needs extra sleep. The other parent covers the night before.
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
                      hasEarlyStart("me", day.date) ? "Picked" : "Select"
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
                    class="rt__early-day"
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
                      hasEarlyStart("partner", day.date) ? "Picked" : "Select"
                    }}</small>
                  </button>
                </div>
              </div>
            </fieldset>
          </section>
        </Collapse>

        <Collapse>
          <section v-if="selectedPattern === 'manual' && hasPartner" class="rt__sec" aria-labelledby="rt-s-hand">
            <h2 id="rt-s-hand" class="rt__h2">Hand over in the night?</h2>
            <p class="rt__muted">Split a night so one of you sleeps first and the other takes over.</p>
            <SegToggle v-model="handoverMode" :options="HANDOVER_MODES" label="Night style" class="rt__seg" />
            <Collapse>
              <div v-if="handoverEnabled" class="rt__stack">
                <div class="rt__field">
                  <PickField label="Handover at" icon="clock" :value="formatHhmm(handoverClock, timeFormat)" :open="handoverOpen" placeholder="Pick a time" @toggle="handoverOpen = !handoverOpen" />
                  <Collapse>
                    <div v-if="handoverOpen" class="rt__wheel"><TimeWheel v-model="handoverClock" label="Handover time" /></div>
                  </Collapse>
                </div>
                <div class="rt__field">
                  <span class="rt__label">Who takes over?</span>
                  <SegToggle v-model="handoverParent" :options="takeoverOptions" label="Who takes over" />
                </div>
              </div>
            </Collapse>
          </section>
        </Collapse>

        <button type="button" class="rt__btn rt__go" @click.stop.prevent="finishSetup">
          {{ selectedPattern === "smart" ? "Generate suggested plan" : "Save and view This week" }}
        </button>
        <ul v-if="selectedPattern === 'smart' && planNotes.length" class="rt__notes" role="status">
          <li v-for="note in planNotes" :key="note">{{ note }}</li>
        </ul>

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
            class="rt__link"
            @click="confirmReset = false"
          >
            Keep plan
          </button>
        </div>
                </div>
        </Collapse>
      </section>
    </template>
  </div>
</template>

<style scoped>
.rt {
  --navy: #243560;
  --navy-2: #2d3f70;
  --ink: #1f2a52;
  --cream: #fdf9f0;
  --sand: #e9d9b8;
  --apricot: #f2a477;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 63.75rem;
  margin: 0 auto;
  color: var(--ink);
}

/* Hero, the same as the Care log and Checklist */
.rt__daycard, .rt__nightcard { display: flex; flex-direction: column; gap: 14px; }
.rt__weekblock { display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
.rt__rest { display: flex; flex-direction: column; gap: 12px; padding-top: 18px; border-top: 1.5px dashed var(--sand); }
.rt__settingsbtn { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 14px 18px; background: #fffdf8; border: 1.5px solid var(--sand); border-radius: 16px; font-family: inherit; font-size: 1rem; font-weight: 600; color: var(--navy); cursor: pointer; transition: border-color 0.18s ease, background-color 0.18s ease; }
.rt__settingsbtn:hover { border-color: var(--navy); background: #fff; }
.rt__settingsbtn:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
.rt__settingschev { transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1); }
.rt__settingsbtn[aria-expanded="true"] .rt__settingschev { transform: rotate(180deg); }
.rt__settings { display: flex; flex-direction: column; gap: 24px; padding-top: 8px; }

.rt__counts { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 0; padding: 0; list-style: none; }
.rt__count { display: flex; align-items: center; gap: 8px; font-size: 0.9375rem; color: var(--ink); }
.rt__notes { display: grid; gap: 6px; margin: 0; padding: 12px 14px 12px 30px; background: #fdf0e3; border: 1.5px solid #f2c9a6; border-radius: 14px; font-size: 0.875rem; line-height: 1.45; color: var(--ink); }
.rt__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: #6b7392; }
.rt__text { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: var(--ink); }
.rt__h2 { margin: 0; font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 700; color: var(--ink); }
.rt__label { margin: 0; padding: 0; font-size: 0.875rem; font-weight: 600; color: var(--ink); }

/* Cards */
.rt__card { background: var(--cream); border: 1px solid var(--sand); border-bottom-width: 4px; border-radius: 24px; padding: 24px 28px 28px; }
.rt__card-head { display: flex; align-items: center; gap: 12px; }
.rt__icon-sq { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 36px; height: 36px; border-radius: 12px; background: var(--navy); color: #fff; }

.rt__block { display: flex; flex-direction: column; gap: 14px; align-items: flex-start; min-width: 0; }
.rt__block > * { max-width: 100%; }

/* Week navigation */
.rt__nav { display: flex; align-items: center; gap: 8px; }
.rt__week { margin: 0 6px; min-width: 150px; text-align: center; font-family: var(--nt-serif); font-size: 1.25rem; font-weight: 700; color: var(--ink); }
.rt__icon { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; background: #fffdf8; border: 1.5px solid var(--sand); border-radius: 50%; color: var(--navy); cursor: pointer; transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1); }
.rt__icon:hover { border-color: var(--navy); background: #fff; }
.rt__icon:active { transform: scale(0.92); }
.rt__icon:focus-visible, .rt__cell:focus-visible, .rt__link:focus-visible, .rt__btn:focus-visible, .rt__early-day:focus-visible, .rt__choice:focus-within { outline: 3px solid var(--navy); outline-offset: 2px; }

/* The seven nights */
.rt__strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; width: 100%; margin: 0; padding: 0; list-style: none; }
.rt__cell { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; min-height: 160px; padding: 14px 2px 12px; background: #fffdf8; border: 1.5px solid var(--sand); border-bottom-width: 3px; border-radius: 20px; font: inherit; color: var(--ink); cursor: pointer; transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.2s cubic-bezier(0.34, 1.4, 0.64, 1); }
.rt__cell:hover { background: #fff; transform: translateY(-2px); }
.rt__cell:active { transform: scale(0.97); }
.rt__cell--on { background: #fff; border-color: var(--navy); box-shadow: 0 0 0 3px rgb(36 53 96 / 12%); }
.rt__cell--today { border-color: var(--apricot); }
.rt__cell--today.rt__cell--on { border-color: var(--navy); }
.rt__dow { font-size: 0.875rem; font-weight: 500; color: #6b7392; }
.rt__num { font-family: var(--nt-serif); font-size: 1.75rem; font-weight: 700; line-height: 1.15; }
.rt__mark { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1.5px solid var(--navy); border-radius: 50%; font-size: 0.875rem; font-weight: 700; color: var(--navy); }
.rt__mark--me { background: var(--navy); color: #fff; }
.rt__mark--partner { background: var(--sand); }
.rt__mark--other { background: #cfe3d4; color: #2f5d43; border-color: #aecab7; }
.rt__carer { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; background: #fffdf8; border: 1.5px solid var(--sand); border-radius: 16px; }
.rt__carer-name { font-weight: 700; color: var(--ink); }
.rt__dchips { display: flex; gap: 6px; flex-wrap: wrap; }
.rt__dchip { width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid var(--sand); background: #fff; font-family: inherit; font-size: 0.8125rem; font-weight: 700; color: var(--navy); cursor: pointer; transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease; }
.rt__dchip:hover { border-color: var(--navy); }
.rt__dchip--on { background: #cfe3d4; border-color: #2f5d43; color: #2f5d43; }
.rt__dchip:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
.rt__mark--open { border-style: dashed; border-color: #9aa3c4; }
.rt__mark--split { border: 0; color: var(--navy); }
.rt__moon { display: block; }
.rt__tonight { min-height: 18px; white-space: nowrap; font-size: 0.8125rem; font-weight: 700; line-height: 18px; color: #c4642f; }

.rt__detail { display: flex; flex-direction: column; gap: 6px; width: 100%; padding: 16px 0 0; border-top: 1.5px dashed var(--sand); }
.rt__detail-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--ink); }
.rt__detail-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; }

/* Text buttons become small navy pills */
.rt__link { padding: 6px 16px; background: transparent; border: 1.5px solid var(--navy); border-radius: 999px; font-family: inherit; font-size: 0.875rem; font-weight: 600; color: var(--navy); cursor: pointer; transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1); }
.rt__link:hover { background: var(--navy); color: #fff; }
.rt__link:active { transform: scale(0.96); }

/* History */

/* Settings */
.rt__error { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: 720px; }
.rt__sec { display: flex; flex-direction: column; gap: 12px; padding-bottom: 24px; border-bottom: 1.5px dashed var(--sand); }
.rt__choices { display: flex; flex-direction: column; gap: 10px; }
.rt__choice-text { display: flex; flex-direction: column; gap: 2px; }
.rt__choice-title { font-size: 1rem; font-weight: 600; }
.rt__choice-hint { font-size: 0.875rem; font-weight: 400; color: #6b7392; }
.rt__stack { display: flex; flex-direction: column; gap: 16px; padding-top: 4px; }
.rt__seg { max-width: 420px; }
.rt__fields { display: flex; flex-direction: column; gap: 18px; }
.rt__field { display: flex; flex-direction: column; gap: 8px; max-width: 340px; }
.rt__wheel { padding-top: 2px; }
.rt__fieldset { display: flex; flex-direction: column; gap: 10px; min-width: 0; margin: 0; padding: 0; border: 0; }
.rt__fieldset legend { float: none; width: auto; margin-bottom: 4px; font-family: var(--nt-serif); font-size: 1.375rem; font-weight: 700; color: var(--ink); }

.rt__choice { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fffdf8; border: 1.5px solid var(--sand); border-radius: 16px; font-size: 0.9375rem; font-weight: 500; color: var(--ink); cursor: pointer; transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease; }
.rt__choice:hover { border-color: var(--navy); background: #fff; }
.rt__choice input { width: 18px; height: 18px; margin: 0; accent-color: var(--navy); cursor: pointer; }
.rt__choice--on { border-color: var(--navy); background: #fff; box-shadow: 0 0 0 3px rgb(36 53 96 / 12%); font-weight: 600; }

.rt__early-fieldset { width: 100%; }
.rt__early-section { margin-top: 10px; }
.rt__early-heading { margin: 0 0 12px; font-size: 0.9375rem; font-weight: 600; color: var(--ink); }
.rt__early-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.rt__early-day { display: grid; gap: 4px; min-width: 0; padding: 10px 4px; background: #fffdf8; border: 1.5px solid var(--sand); border-radius: 14px; color: #6b7392; font-family: inherit; cursor: pointer; transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1); }
.rt__early-day:hover { border-color: var(--navy); }
.rt__early-day:active { transform: scale(0.95); }
.rt__early-day span { font-size: 0.6875rem; white-space: nowrap; }
.rt__early-day strong { color: var(--ink); font-size: 1rem; }
.rt__early-day small { font-size: 0.625rem; line-height: 1.2; white-space: nowrap; }
@media (max-width: 359.98px) { .rt__early-day { padding: 10px 1px; } .rt__early-day small { font-size: 0.5625rem; } }
.rt__early-day--selected { background: var(--navy); border-color: var(--navy); color: #fff; }
.rt__early-day--selected-dad { background: var(--sand); border-color: var(--navy); color: var(--navy); }
.rt__early-day--selected strong { color: #fff; }
.rt__early-day--selected-dad strong { color: var(--navy); }

.rt__btn { flex: none; padding: 12px 28px; background: var(--navy); border: 0; border-bottom: 3px solid #182246; border-radius: 14px; font-family: inherit; font-size: 1rem; font-weight: 600; color: #fff; cursor: pointer; transition: background-color 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1); }
.rt__go { align-self: flex-start; }
.rt__btn:hover { background: var(--navy-2); }
.rt__btn:active { transform: translateY(1px) scale(0.98); }

.rt__foot { padding-top: 4px; }
.rt__confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.rt__danger { padding: 0; background: none; border: 0; font: inherit; font-size: 0.875rem; font-weight: 600; color: #a8473f; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.rt__danger:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; border-radius: 4px; }
@media (max-width: 575px) {
  .rt__card { padding: 20px 16px; }
  .rt__strip { gap: 4px; }
  .rt__cell { min-height: 124px; border-radius: 14px; }
  .rt__num { font-size: 1.25rem; }
  .rt__mark { width: 26px; height: 26px; }
}
@media (prefers-reduced-motion: reduce) {
  .rt__cell, .rt__icon, .rt__link, .rt__btn, .rt__early-day, .rt__choice { transition: none; }
  .rt__cell:hover { transform: none; }
}
</style>
