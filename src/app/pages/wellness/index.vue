<script setup>
import "@/app/app.css";
import { computed, h, inject, nextTick, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import ChipGroup from "@/app/components/ChipGroup.vue";
import WeekTogether from "@/app/components/WeekTogether.vue";
import { NUDGES_KEY } from "@/app/composables/useNudges";
import { dateKey, useCheckinsStore } from "@/app/stores/checkins";
import { HOME_KEY, displayName } from "@/app/composables/useHome";
import {
  BODY_AREAS,
  BODY_PROMPT,
  CLOSENESS,
  CONCERNS,
  ENERGY,
  LIFTS,
  MAX_CONCERNS,
  MOODS,
  REFLECT,
  STRESS,
  kindWords,
  readingFor,
} from "@/app/data/wellness";
import { useTeamStore } from "@/app/stores/team";
import { HOME_KEY } from "@/app/composables/useHome";
import { FEELING_LABELS, feelingLevel, needsSupport } from "@/app/utils/loadHelpers";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "WellnessPage" });

/* Pictures. Small render functions, all decorative (aria-hidden): every choice is also named in
   text beside it. Their styles are at the bottom of this file under :deep(). */
const svg = (cls, viewBox, children) => h("svg", { class: cls, viewBox, "aria-hidden": "true", focusable: "false" }, children);

// Mood as a simple drawn face, from very low (1) to great (5).
const FACE_FILL = ["#dfe3ea", "#e9e5ec", "#f3efe6", "#f6e3d3", "#f6d8c6"];
const FACE_EYES = [
  ["M18 21 L27 18", "M46 21 L37 18", "dots"],
  ["M19 29 h8", "M37 29 h8"],
  ["dots"],
  ["dots"],
  ["M19 30 q4 -5 8 0", "M37 30 q4 -5 8 0"],
];
const FACE_MOUTH = ["M22 47 Q32 38 42 47", "M24 46 Q32 42 40 46", "M24 44 h16", "M22 41 Q32 50 42 41", "M20 39 Q32 55 44 39 Z"];
function Face({ level }) {
  const i = (level || 3) - 1;
  const line = { fill: "none", stroke: "#3b2f3f", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" };
  const eyes = FACE_EYES[i].flatMap((d) =>
    d === "dots"
      ? [h("circle", { cx: 23, cy: 29, r: 2.4, fill: "#3b2f3f" }), h("circle", { cx: 41, cy: 29, r: 2.4, fill: "#3b2f3f" })]
      : [h("path", { ...line, d })],
  );
  return svg(["pic-face", { "is-faded": !level }], "0 0 64 64", [
    h("circle", { cx: 32, cy: 32, r: 28, fill: FACE_FILL[i], stroke: "#3b2f3f", "stroke-width": 1.5 }),
    ...eyes,
    i === 0 ? h("path", { d: "M20 34 q-2.5 4 0 5.5 q2.5 -1.5 0 -5.5 z", fill: "#5c7a9e" }) : null,
    i === 4 ? h("circle", { cx: 16, cy: 38, r: 4, fill: "#e3a584", opacity: 0.5 }) : null,
    i === 4 ? h("circle", { cx: 48, cy: 38, r: 4, fill: "#e3a584", opacity: 0.5 }) : null,
    h("path", { ...line, d: FACE_MOUTH[i], fill: i === 4 ? "#3b2f3f" : "none" }),
  ]);
}
Face.props = ["level"];

// Energy as a jar that fills from 1 (empty) to 5 (full). `clip` keeps clip path ids unique.
const JAR = "M38 14 h44 v14 c0 6 14 10 14 26 v92 c0 10 -8 16 -18 16 h-36 c-10 0 -18 -6 -18 -16 v-92 c0 -16 14 -20 14 -26 z";
const JAR_FILL = [0.06, 0.28, 0.5, 0.72, 0.94];
function TankJar({ level, clip }) {
  const shift = level ? (1 - JAR_FILL[level - 1]) * 122 : 122;
  const id = `jar-${clip}`;
  return svg("pic-jar", "0 0 120 170", [
    h("defs", [h("clipPath", { id }, [h("path", { d: JAR })])]),
    h("path", { d: JAR, fill: "#fff" }),
    h("g", { "clip-path": `url(#${id})` }, [
      h("g", { class: "pic-move", style: { transform: `translateY(${shift}px)` } }, [
        h("rect", { x: 0, y: 40, width: 120, height: 140, fill: "#3b2f3f", opacity: 0.16 }),
        h("path", { d: "M0 40 q15 -5 30 0 t30 0 t30 0 t30 0", fill: "none", stroke: "#3b2f3f", "stroke-width": 1.5, opacity: 0.45 }),
      ]),
    ]),
    h("path", { d: JAR, fill: "none", stroke: "#3b2f3f", "stroke-width": 2, "stroke-linejoin": "round" }),
    h("rect", { x: 34, y: 6, width: 52, height: 10, rx: 3, fill: "#3b2f3f" }),
  ]);
}
TankJar.props = ["level", "clip"];

// Stress as stones, one per level; at five the top of the stack starts to tip.
const STONES = [
  { w: 128, fill: "#b9b1a8" },
  { w: 108, fill: "#a39a92" },
  { w: 92, fill: "#c7bfb6" },
  { w: 74, fill: "#8f877f" },
  { w: 58, fill: "#aea59c" },
];
function StoneStack({ count }) {
  const n = count ?? 0;
  return svg("pic-stones", "0 0 200 160", [
    h("line", { x1: 20, y1: 151, x2: 180, y2: 151, stroke: "#e5e7eb", "stroke-width": 2, "stroke-linecap": "round" }),
    ...STONES.map((s, i) => {
      const on = i < n;
      const tip = n === 5 && i >= 3 ? (i === 4 ? "rotate(7deg)" : "rotate(-4deg)") : "none";
      return h("rect", {
        class: ["pic-stone", { "is-on": on }],
        style: { transform: on ? tip : "translateY(-14px)" },
        x: 100 - s.w / 2,
        y: 150 - (i + 1) * 22,
        width: s.w,
        height: 24,
        rx: 12,
        fill: s.fill,
      });
    }),
  ]);
}
StoneStack.props = ["count"];

// A front-on outline with tappable areas. A mouse convenience only: the chip list beside it is
// the accessible control for the same choices.
function BodyMap({ selected, interactive }, { emit }) {
  const chosen = selected ?? [];
  const live = interactive !== false;
  const area = (key, shapes) =>
    h("g", { class: ["pic-area", { "is-on": chosen.includes(key) }], onClick: () => live && emit("toggle", key) }, shapes);
  return svg(["pic-body", { "is-static": !live }], "0 0 160 260", [
    h("g", { fill: "#fff", stroke: "#c9c2bb", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }, [
      h("path", { d: "M48 82 Q30 120 30 172", fill: "none", "stroke-width": 15, stroke: "#efeae5" }),
      h("path", { d: "M112 82 Q130 120 130 172", fill: "none", "stroke-width": 15, stroke: "#efeae5" }),
      h("path", { d: "M66 156 L62 246", fill: "none", "stroke-width": 17, stroke: "#efeae5" }),
      h("path", { d: "M94 156 L98 246", fill: "none", "stroke-width": 17, stroke: "#efeae5" }),
      h("rect", { x: 72, y: 60, width: 16, height: 16, rx: 4 }),
      h("path", { d: "M52 76 Q80 70 108 76 Q122 80 122 96 L116 150 Q80 162 44 150 L38 96 Q38 80 52 76 Z" }),
      h("ellipse", { cx: 80, cy: 38, rx: 23, ry: 27 }),
    ]),
    area("head", [h("ellipse", { cx: 80, cy: 27, rx: 17, ry: 11 })]),
    area("jaw", [h("ellipse", { cx: 80, cy: 54, rx: 14, ry: 7 })]),
    area("shoulders", [h("ellipse", { cx: 54, cy: 84, rx: 15, ry: 8 }), h("ellipse", { cx: 106, cy: 84, rx: 15, ry: 8 })]),
    area("chest", [h("ellipse", { cx: 80, cy: 104, rx: 26, ry: 14 })]),
    area("stomach", [h("ellipse", { cx: 80, cy: 136, rx: 24, ry: 12 })]),
    area("hands", [h("circle", { cx: 30, cy: 180, r: 9 }), h("circle", { cx: 130, cy: 180, r: 9 })]),
  ]);
}
BodyMap.props = ["selected", "interactive"];
BodyMap.emits = ["toggle"];

// You and your partner as two circles, from far apart (1) to almost one (5), after the
// "Inclusion of Other in the Self" scale (Aron, Aron and Smollan, 1992).
const GAP = [52, 40, 30, 18, 8];
function CloseCircles({ level }) {
  const d = GAP[(level || 3) - 1];
  return svg(["pic-pair", { "is-faded": !level }], "0 0 120 60", [
    h("circle", { cx: 60 - d / 2, cy: 30, r: 22, fill: "#dce6f2", stroke: "#5c7a9e", "stroke-width": 1.5 }),
    h("circle", { cx: 60 + d / 2, cy: 30, r: 22, fill: "#f6d8c6", stroke: "#e3a584", "stroke-width": 1.5 }),
  ]);
}
CloseCircles.props = ["level"];

/* Page */
const store = useCheckinsStore();

const MOODS = [
  { value: 1, label: "Very low" },
  { value: 2, label: "Low" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];
// Stress is stored 1 (none) to 5 (very high); chips run from most to least stress.
const STRESS = [
  { value: 5, label: "Very high" },
  { value: 4, label: "High" },
  { value: 3, label: "Some" },
  { value: 2, label: "Low" },
  { value: 1, label: "None" },
];

const existing = store.forDate(dateKey(new Date()));
const mood = ref(existing?.mood ?? null);
const energy = ref(existing?.energy ?? null);
const stress = ref(existing?.stress ?? null);
const body = ref([...(existing?.body ?? [])]);
const bodyNone = ref(false);
const closeness = ref(existing?.closeness ?? null);
const concerns = ref([...(existing?.concerns ?? [])]);
const lifts = ref([...(existing?.lifts ?? [])]);
const answers = () => ({
  mood: mood.value,
  energy: energy.value,
  stress: stress.value,
  closeness: closeness.value,
  body: [...body.value],
  concerns: [...concerns.value],
  lifts: [...lifts.value],
});

// "steps" is the check-in, "summary" the reading of the saved answers.
const view = ref("steps");
const STEPS = ["light", "tank", "stones", "body", "close", "weigh", "review"];
const REQUIRED = { light: () => mood.value, stones: () => stress.value };
const step = ref(0);
const current = computed(() => STEPS[step.value]);
const isOptional = computed(() => !REQUIRED[current.value] && current.value !== "review");
const titles = computed(() => ({
  light: "Which face is closest to yours right now?",
  tank: "How full is your tank?",
  stones: "How much are you carrying right now?",
  body: "Where are you holding it?",
  close: `How close do you feel to ${partnerName.value} today?`,
  weigh: "What took the most out of you, and what gave a little back?",
  review: "Here is today",
}));
const HINTS = {
  light: "Not how the day went. How you feel inside, right now.",
  tank: "Energy, not mood. How much do you have left to give?",
  stones: "Think of each worry or job on your mind as a stone.",
  body: "Close your eyes for a breath. Where do you feel tight, heavy or sore?",
  close: "Pick the pair that looks most like the two of you today.",
  weigh: "Pick what fits. It is fine if nothing gave back yet.",
  review: "Look it over. Tap any part to change it.",
};

const error = ref("");
const heading = ref(null);
async function go(index) {
  view.value = "steps";
  step.value = Math.max(0, Math.min(STEPS.length - 1, index));
  error.value = "";
  await nextTick();
  heading.value?.focus();
}
function next() {
  const need = REQUIRED[current.value];
  if (need && !need()) {
    error.value = "Choose one to carry on.";
    return;
  }
  go(step.value + 1);
}
const goTo = (id) => go(STEPS.indexOf(id));

// Previewing a picture on hover, without choosing it.
const preview = ref(null);
watch(step, () => {
  preview.value = null;
});

// Body
const toggleArea = (value) => {
  bodyNone.value = false;
  body.value = body.value.includes(value) ? body.value.filter((a) => a !== value) : [...body.value, value];
};
const chooseNowhere = () => {
  body.value = [];
  bodyNone.value = !bodyNone.value;
};

// Took and gave
const atLimit = computed(() => concerns.value.length >= MAX_CONCERNS);
const flip = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
const toggleConcern = (value) => {
  concerns.value = flip(concerns.value, value);
};
const toggleLift = (value) => {
  lifts.value = flip(lifts.value, value);
};

// What the current step says back.
const reflection = computed(() => {
  switch (current.value) {
    case "light":
      return mood.value ? REFLECT.mood[mood.value] : "";
    case "tank":
      return energy.value ? REFLECT.energy[energy.value] : "";
    case "stones":
      return stress.value ? REFLECT.stress[stress.value] : "";
    case "body":
      if (body.value.length) return BODY_PROMPT;
      return bodyNone.value ? "Good. Nothing in your body is sounding an alarm today." : "";
    case "close":
      return closeness.value ? REFLECT.closeness[closeness.value] : "";
    case "weigh":
      if (lifts.value.length) return "Hold on to that. Small things are the ones you can repeat tomorrow.";
      return concerns.value.length ? "Nothing gave back yet? Then plan one small thing on purpose for tomorrow." : "";
    default:
      return "";
  }
});

const labelOf = (list, value) => list.find((o) => o.value === value)?.label ?? "";
const labelsOf = (list, values) => values.map((v) => labelOf(list, v)).filter(Boolean).join(", ");
const kind = computed(() => kindWords(answers()));

// Saving, then the summary.
const savedEntry = ref(existing);
const savedDay = computed(() => {
  const at = savedEntry.value?.savedAt ? new Date(savedEntry.value.savedAt) : null;
  return at && !Number.isNaN(at.getTime()) ? at.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "Today";
});
const savedTime = computed(() => {
  const at = savedEntry.value?.savedAt ? new Date(savedEntry.value.savedAt) : null;
  return at && !Number.isNaN(at.getTime()) ? at.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" }) : "";
});
const done = ref([]);
const summaryHeading = ref(null);
async function showSummary() {
  view.value = "summary";
  done.value = [];
  await nextTick();
  summaryHeading.value?.focus();
}
const sharedNote = ref("");

async function save() {
  if (!mood.value || !stress.value) {
    goTo(!mood.value ? "light" : "stones").then(() => {
      error.value = "Choose one to carry on.";
    });
    return;
  }
  error.value = "";
  store.save({ mood: mood.value, stress: stress.value });
  saved.value = { mood: mood.value, stress: stress.value };
}

const hardStretch = computed(() => saved.value && (saved.value.mood === 1 || saved.value.stress === 5));

const days = computed(() => store.lastSeven(new Date()));
const logged = computed(() => days.value.filter((d) => d.entry));

const reading = computed(() => {
  if (!savedEntry.value) return null;
  const earlier = logged.value.filter((d) => d.date !== today).map((d) => d.entry);
  return readingFor(savedEntry.value, { partner: partnerName.value, earlier });
});
const toggleDone = (id) => {
  done.value = flip(done.value, id);
};

// Week chart
const moodLabel = (v) => labelOf(MOODS, v);
const stressLabel = (v) => labelOf(STRESS, v);
const dayLabel = (day) =>
  day.entry
    ? `${day.weekday}: mood ${moodLabel(day.entry.mood).toLowerCase()} (${day.entry.mood} of 5), carrying ${stressLabel(day.entry.stress).toLowerCase()}`
    : `${day.weekday}: no check-in`;

// Plot geometry, in percent of the plot height: Great at the top, Very low at the bottom.
const yOf = (moodValue) => ((5 - moodValue) / 4) * 100;
const xOf = (index) => ((index + 0.5) / 7) * 100;
const linePath = computed(() => {
  let path = "";
  let joined = false;
  days.value.forEach((day, i) => {
    if (!day.entry) {
      joined = false;
      return;
    }
    path += `${joined ? "L" : "M"}${xOf(i).toFixed(2)} ${yOf(day.entry.mood).toFixed(2)} `;
    joined = true;
  });
  return path.trim();
});

const weekSummary = computed(() => {
  const list = logged.value;
  if (!list.length) return "One dot a day will appear here once you check in.";
  const counts = {};
  for (const d of list) counts[d.entry.mood] = (counts[d.entry.mood] ?? 0) + 1;
  const common = Number(Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]);
  const count = list.length === 1 ? "1 check-in this week" : `${list.length} check-ins this week`;
  let line = `${count}, mostly ${moodLabel(common).toLowerCase()}.`;
  if (list.length > 1) {
    const first = list[0];
    const last = list[list.length - 1];
    if (last.entry.stress < first.entry.stress) line += ` You are carrying less than on ${first.weekday}.`;
    else if (last.entry.stress > first.entry.stress) line += ` You are carrying more than on ${first.weekday}.`;
  }
  return line;
});

const highFirst = (list) => [...list].reverse();
</script>

<template>
  <div class="wl">
    <header class="wl__head">
      <h1 class="nt-title wl__title">Wellness</h1>
      <p class="wl__sub">A few minutes to notice how you really are. {{ privacyLine }}</p>
    </header>

    <div v-if="supportNeeded" class="wl__banner" role="status">
      <p class="wl__banner-text">
        Your last few check-ins have been hard. You do not have to carry this alone, and this is not a diagnosis.
      </p>
      <AppButton variant="outline" size="md" :to="ROUTES.SUPPORT">See support options</AppButton>
    </div>

    <!-- The check-in -->
    <form
      v-if="view === 'steps'"
      class="nt-yours-alone wl__box"
      aria-labelledby="wl-step-title"
      novalidate
      @submit.prevent="current === 'review' ? save() : next()"
    >
      <div class="wl__top">
        <section v-if="partnerName && week" class="wl__together" aria-labelledby="wl-together">
          <h2 id="wl-together" class="wl__h">Together with {{ partnerName }}</h2>
          <WeekTogether :summary="week" my-name="You" :partner-name="partnerName" />
        </section>

        <p class="nt-yours-alone__label wl__label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          Yours alone
        </p>
        <p class="wl__count-step">{{ step + 1 }} of {{ STEPS.length }}</p>
      </div>
      <div class="wl__progress" aria-hidden="true"><span :style="{ width: `${((step + 1) / STEPS.length) * 100}%` }" /></div>

      <p v-if="savedEntry && step === 0" class="wl__earlier">
        You checked in today{{ savedTime ? ` at ${savedTime}` : "" }}. Going through it again replaces it.
        <button type="button" class="app-textbtn" @click="showSummary">Read today's summary</button>
      </p>

      <h2 id="wl-step-title" ref="heading" class="nt-heading wl__question" tabindex="-1">{{ titles[current] }}</h2>
      <p class="wl__hint">{{ HINTS[current] }}</p>

      <!-- 1. Mood as a face -->
      <div v-if="current === 'light'" class="wl__faces" role="radiogroup" aria-label="Mood">
        <button
          v-for="o in MOODS"
          :key="o.value"
          type="button"
          role="radio"
          class="wl__pair wl__face"
          :aria-checked="mood === o.value ? 'true' : 'false'"
          @click="mood = o.value"
        >
          <Face :level="o.value" />
          <span class="wl__option-label">{{ o.label }}</span>
        </button>
      </div>

      <!-- 2. Energy as a jar -->
      <div v-else-if="current === 'tank'" class="wl__stage">
        <div class="wl__picture wl__picture--narrow"><TankJar :level="preview ?? energy" clip="step" /></div>
        <div class="wl__options" role="radiogroup" aria-label="Energy">
          <button
            v-for="o in highFirst(ENERGY)"
            :key="o.value"
            type="button"
            role="radio"
            class="wl__option"
            :aria-checked="energy === o.value ? 'true' : 'false'"
            @click="energy = o.value"
            @mouseenter="preview = o.value"
            @mouseleave="preview = null"
          >
            <span class="wl__option-label">{{ o.label }}</span>
          </button>
        </div>
      </div>

      <!-- 3. Stress as stones -->
      <div v-else-if="current === 'stones'" class="wl__stage">
        <div class="wl__picture"><StoneStack :count="preview ?? stress" /></div>
        <div class="wl__options" role="radiogroup" aria-label="Stress">
          <button
            v-for="o in highFirst(STRESS)"
            :key="o.value"
            type="button"
            role="radio"
            class="wl__option"
            :aria-checked="stress === o.value ? 'true' : 'false'"
            @click="stress = o.value"
            @mouseenter="preview = o.value"
            @mouseleave="preview = null"
          >
            <span class="wl__option-label">{{ o.label }}</span>
            <span class="wl__option-sub">{{ o.value === 1 ? "1 stone" : `${o.value} stones` }}</span>
          </button>
        </div>
      </div>

      <!-- 4. Body -->
      <div v-else-if="current === 'body'" class="wl__stage">
        <div class="wl__picture wl__picture--narrow"><BodyMap :selected="body" @toggle="toggleArea" /></div>
        <div class="wl__chips" role="group" aria-label="Where you feel it">
          <button
            v-for="a in BODY_AREAS"
            :key="a.value"
            type="button"
            class="app-chip"
            :aria-pressed="body.includes(a.value) ? 'true' : 'false'"
            @click="toggleArea(a.value)"
          >
            {{ a.label }}
          </button>
          <button type="button" class="app-chip" :aria-pressed="bodyNone ? 'true' : 'false'" @click="chooseNowhere">Nowhere in particular</button>
        </div>
      </div>

          <fieldset class="wl__group">
            <legend class="wl__legend">Mood</legend>
            <ChipGroup v-model="mood" :options="MOODS" label="Mood" />
          </fieldset>

          <fieldset class="wl__group">
            <legend class="wl__legend">Stress</legend>
            <ChipGroup v-model="stress" :options="STRESS" label="Stress" />
          </fieldset>

          <p v-if="error" class="app-error-text" role="alert">{{ error }}</p>

          <div class="wl__actions">
            <AppButton size="md" @click="save">Save privately</AppButton>
            <AppButton variant="outline" size="md" :to="ROUTES.HOME">Not now</AppButton>
          </div>
        </fieldset>
        <fieldset class="wl__group">
          <legend class="wl__legend">Gave a little back</legend>
          <div class="wl__chips" role="group" aria-label="Gave a little back">
            <button
              v-for="l in LIFTS"
              :key="l.value"
              type="button"
              class="app-chip"
              :aria-pressed="lifts.includes(l.value) ? 'true' : 'false'"
              @click="toggleLift(l.value)"
            >
              {{ l.label }}
            </button>
          </div>
        </fieldset>
      </div>

      <!-- 7. Review -->
      <div v-else class="wl__review">
        <ul class="wl__ledger">
          <li>
            <button type="button" class="wl__tile" @click="goTo('light')">
              <span class="wl__tile-pic wl__tile-pic--face"><Face :level="mood" /></span>
              <span class="wl__tile-text">
                <span class="wl__tile-name">Mood</span>
                <span class="wl__tile-value">{{ moodLabel(mood) || "Not answered" }}</span>
              </span>
              <span class="wl__change">Change</span>
            </button>
          </li>
          <li>
            <button type="button" class="wl__tile" @click="goTo('tank')">
              <span class="wl__tile-pic"><TankJar :level="energy" clip="tile" /></span>
              <span class="wl__tile-text">
                <span class="wl__tile-name">Tank</span>
                <span class="wl__tile-value" :class="{ 'is-skipped': !energy }">{{ labelOf(ENERGY, energy) || "Skipped" }}</span>
              </span>
              <span class="wl__change">Change</span>
            </button>
          </li>
          <li>
            <button type="button" class="wl__tile" @click="goTo('stones')">
              <span class="wl__tile-pic"><StoneStack :count="stress" /></span>
              <span class="wl__tile-text">
                <span class="wl__tile-name">Carrying</span>
                <span class="wl__tile-value">{{ stressLabel(stress) || "Not answered" }}</span>
              </span>
              <span class="wl__change">Change</span>
            </button>
          </li>
          <li>
            <button type="button" class="wl__tile" @click="goTo('body')">
              <span class="wl__tile-pic"><BodyMap :selected="body" :interactive="false" /></span>
              <span class="wl__tile-text">
                <span class="wl__tile-name">Holding it in</span>
                <span class="wl__tile-value" :class="{ 'is-skipped': !body.length }">{{ labelsOf(BODY_AREAS, body) || "Nowhere in particular" }}</span>
              </span>
              <span class="wl__change">Change</span>
            </button>
          </li>
          <li>
            <button type="button" class="wl__tile" @click="goTo('close')">
              <span class="wl__tile-pic wl__tile-pic--pair"><CloseCircles :level="closeness" /></span>
              <span class="wl__tile-text">
                <span class="wl__tile-name">With {{ partnerFirst || "your partner" }}</span>
                <span class="wl__tile-value" :class="{ 'is-skipped': !closeness }">{{ labelOf(CLOSENESS, closeness) || "Skipped" }}</span>
              </span>
              <span class="wl__change">Change</span>
            </button>
          </li>
          <li>
            <button type="button" class="wl__tile" @click="goTo('weigh')">
              <span class="wl__tile-pic" />
              <span class="wl__tile-text">
                <span class="wl__tile-name">Took the most</span>
                <span class="wl__tile-value" :class="{ 'is-skipped': !concerns.length }">{{ labelsOf(CONCERNS, concerns) || "Nothing picked" }}</span>
                <span class="wl__tile-name wl__tile-name--gap">Gave back</span>
                <span class="wl__tile-value" :class="{ 'is-skipped': !lifts.length }">{{ labelsOf(LIFTS, lifts) || "Nothing yet" }}</span>
              </span>
              <span class="wl__change">Change</span>
            </button>
          </li>
        </ul>
        <p class="nt-heading wl__kind">{{ kind }}</p>
      </div>

      <p v-if="reflection" class="wl__reflect" aria-live="polite">{{ reflection }}</p>
      <p v-if="error" class="app-error-text" role="alert">{{ error }}</p>

      <div class="wl__nav">
        <button v-if="step > 0" type="button" class="app-textbtn wl__back" @click="go(step - 1)">Back</button>
        <span class="wl__spacer" />
        <template v-if="current === 'review'">
          <router-link class="app-link" :to="ROUTES.HOME">Not now</router-link>
          <AppButton size="md" type="submit">Save check-in</AppButton>
        </template>
        <template v-else>
          <button v-if="isOptional" type="button" class="app-textbtn" @click="go(step + 1)">Skip</button>
          <AppButton variant="outline" size="md" type="submit">Next</AppButton>
        </template>
      </div>
    </form>

    <!-- The summary, after saving -->
    <section v-else-if="reading" class="nt-yours-alone wl__box wl__summary" aria-labelledby="wl-summary-title">
      <header class="wl__sum-head">
        <span class="wl__sum-face" aria-hidden="true"><Face :level="savedEntry.mood" /></span>
        <div>
          <p role="status" class="wl__sum-meta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            {{ savedDay }}{{ savedTime ? `, ${savedTime}` : "" }}. Only you can see this.
          </p>
          <h2 id="wl-summary-title" ref="summaryHeading" class="nt-heading wl__sum-title" tabindex="-1">What today says</h2>
        </div>
      </header>

      <p class="wl__story">{{ reading.story }}</p>

      <dl class="wl__rows">
        <div class="wl__row">
          <dt>What it might mean</dt>
          <dd>
            <p v-for="i in reading.insights" :key="i.title" class="wl__insight"><strong>{{ i.title }}.</strong> {{ i.body }}</p>
          </dd>
        </div>

        <div class="wl__row">
          <dt>Next 24 hours</dt>
          <dd>
            <ul class="wl__plan">
              <li v-for="p in reading.plan" :key="p.id" class="wl__plan-item" :class="{ 'is-done': done.includes(p.id) }">
                <button
                  type="button"
                  class="wl__tick"
                  :aria-pressed="done.includes(p.id) ? 'true' : 'false'"
                  :aria-label="`Done: ${p.title}`"
                  @click="toggleDone(p.id)"
                >
                  <svg v-if="done.includes(p.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                </button>
                <p class="wl__plan-body">
                  <strong>{{ p.title }}.</strong> {{ p.body }}
                  <router-link v-if="p.to" class="app-link" :to="p.to">{{ p.action }}</router-link>
                </p>
              </li>
            </ul>
          </dd>
        </div>

        <div class="wl__row">
          <dt>This week</dt>
          <dd>
            <p>{{ reading.compare }}</p>
            <p v-if="reading.talk" class="wl__talk">
              {{ reading.talk }}
              <router-link class="app-link" :to="ROUTES.SUPPORT">Find support</router-link>
            </p>
          </dd>
        </div>

        <div class="wl__row">
          <dt>
            To {{ partnerFirst || "your partner" }}
            <span class="wl__dt-note">If you want to. Nothing is sent.</span>
          </dt>
          <dd><blockquote class="wl__share">“{{ reading.share }}”</blockquote></dd>
        </div>
      </dl>

      <div class="wl__nav">
        <button type="button" class="app-textbtn" @click="goTo('review')">Change answers</button>
        <span class="wl__spacer" />
        <router-link class="app-link" :to="ROUTES.HOME">Back to Home</router-link>
      </div>
    </section>

    <section class="wl__card" aria-labelledby="wl-week">
      <div class="wl__card-head">
        <h2 id="wl-week" class="nt-heading wl__h">Your week</h2>
        <span class="wl__only">Only you</span>
      </div>
      <p class="wl__body">{{ weekSummary }}</p>

      <div class="wl__chart">
        <div class="wl__axis" aria-hidden="true">
          <span v-for="v in [5, 3, 1]" :key="v" :style="{ top: `${yOf(v)}%` }">{{ moodLabel(v) }}</span>
        </div>
        <div class="wl__plot-wrap">
          <div class="wl__plot-area" aria-hidden="true">
            <span v-for="v in [5, 4, 3, 2, 1]" :key="v" class="wl__guide" :style="{ top: `${yOf(v)}%` }" />
            <svg v-if="linePath" class="wl__line" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path :d="linePath" vector-effect="non-scaling-stroke" />
            </svg>
          </div>
          <ul class="wl__days" aria-label="Mood over the last 7 days">
            <li v-for="day in days" :key="day.date" class="wl__day">
              <span class="wl__col" role="img" :aria-label="dayLabel(day)" :title="dayLabel(day)">
                <span v-if="day.entry" class="wl__dot" :style="{ top: `${10 + yOf(day.entry.mood) * 1.2}px` }" />
              </span>
              <span class="wl__weekday" :class="{ 'is-today': day.date === today }">{{ day.date === today ? "Today" : day.weekday }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <p class="wl__disclaimer">
      For reflection, not diagnosis. Saved on this device only. If you feel unsafe, contact emergency services or a
      healthcare professional.
    </p>
  </div>
</template>

<style scoped>
.wl { display: flex; flex-direction: column; gap: 24px; max-width: 760px; font-size: 1rem; color: var(--nt-ink); }
.wl__head { display: flex; flex-direction: column; gap: 8px; }
.wl__sub { margin: 0; color: var(--nt-muted); }

/* The butter "Yours alone" box, for the check-in and its summary. */
.wl__box { gap: 16px; padding: 24px; border-radius: 12px; }
.wl__top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px; }
.wl__label { display: inline-flex; align-items: center; gap: 6px; margin: 0; }
.wl__count-step { margin: 0; font-size: 0.875rem; color: var(--nt-butter-d); }
.wl__progress { height: 2px; background: rgb(111 95 58 / 18%); }
.wl__progress span { display: block; height: 100%; background: var(--nt-plum); transition: width 0.3s ease; }
.wl__earlier { margin: 4px 0 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-butter-d); }
.wl__earlier .app-textbtn { margin-left: 4px; }
.wl__question { margin-top: 8px; font-size: 1.75rem; line-height: 1.25; }
.wl__question:focus { outline: none; }
.wl__hint { margin: -8px 0 4px; font-size: 0.9375rem; line-height: 1.5; color: var(--nt-butter-d); }

.wl__stage { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: center; gap: 24px; }
.wl__picture { display: flex; justify-content: center; width: 100%; max-width: 280px; margin: 0 auto; }
.wl__picture--narrow { max-width: 170px; }
.wl__options { display: flex; flex-direction: column; gap: 8px; }
.wl__option { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; min-height: 48px; padding: 10px 16px; background: #fff; border: 1px solid var(--nt-line); border-radius: 8px; font-family: inherit; text-align: left; color: var(--nt-ink); cursor: pointer; transition: background-color 0.15s, border-color 0.15s; }
.wl__option:hover { background: var(--nt-gray); }
.wl__option[aria-checked="true"] { background: var(--nt-gray); border-color: var(--nt-plum); box-shadow: inset 0 0 0 0.5px var(--nt-plum); }
.wl__option[aria-checked="true"] .wl__option-label { color: var(--nt-plum); font-weight: 600; }
.wl__option-label { font-size: 0.9375rem; font-weight: 500; }
.wl__option-sub { font-size: 0.875rem; color: var(--nt-muted); }
.wl__option:focus-visible, .wl__pair:focus-visible, .wl__tile:focus-visible, .wl__tick:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.wl__chips { display: flex; flex-wrap: wrap; align-content: center; gap: 8px; }
.wl__chips .app-chip:disabled { opacity: 0.45; cursor: not-allowed; }

.wl__close { display: flex; flex-direction: column; gap: 12px; }
.wl__legend-row { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.875rem; color: var(--nt-butter-d); }
.wl__swatch { display: inline-block; width: 12px; height: 12px; border-radius: 50%; }
.wl__swatch--you { background: var(--nt-powder); border: 1.5px solid var(--nt-powder-d); }
.wl__swatch--them { margin-left: 12px; background: var(--nt-apricot); border: 1.5px solid var(--nt-apricot-d); }
.wl__pairs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.wl__pair { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 8px 12px; background: #fff; border: 1px solid var(--nt-line); border-radius: 8px; font-family: inherit; color: var(--nt-ink); cursor: pointer; }
.wl__pair:hover { background: var(--nt-gray); }
.wl__pair[aria-checked="true"] { background: var(--nt-gray); border-color: var(--nt-plum); }
.wl__pair[aria-checked="true"] .wl__option-label { color: var(--nt-plum); font-weight: 600; }
.wl__pair .wl__option-label { font-size: 0.875rem; text-align: center; }
.wl__faces { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.wl__face :deep(svg) { width: 100%; max-width: 72px; transition: transform 0.2s ease; }
.wl__face:hover :deep(svg), .wl__face[aria-checked="true"] :deep(svg) { transform: scale(1.08); }

.wl__weigh { display: flex; flex-direction: column; gap: 20px; }
.wl__group { display: flex; flex-direction: column; gap: 10px; min-width: 0; margin: 0; padding: 0; border: 0; }
.wl__legend { float: none; width: auto; margin: 0 0 10px; padding: 0; font-size: 0.9375rem; font-weight: 600; color: var(--nt-ink); }
.wl__muted-inline { margin-left: 6px; font-weight: 400; color: var(--nt-butter-d); }

.wl__reflect { margin: 4px 0 0; max-width: 56ch; font-size: 0.9375rem; line-height: 1.6; color: var(--nt-ink); }

.wl__review { display: flex; flex-direction: column; gap: 20px; }
/* The review reads like a receipt: one panel, a row per answer. */
.wl__ledger { margin: 0; padding: 0 16px; list-style: none; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.wl__ledger li + li { border-top: 1px solid var(--nt-line); }
.wl__tile { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; align-items: center; gap: 16px; width: 100%; padding: 12px 0; background: none; border: 0; font-family: inherit; text-align: left; color: var(--nt-ink); cursor: pointer; }
.wl__tile-pic { display: flex; align-items: center; justify-content: center; height: 48px; }
.wl__tile-pic :deep(svg) { width: auto; max-width: 100%; height: 100%; }
.wl__tile-pic--face :deep(svg) { height: 40px; }
.wl__tile-pic--pair :deep(svg) { height: 28px; }
.wl__tile-text { display: flex; flex-direction: column; min-width: 0; }
.wl__tile-name { font-size: 0.875rem; color: var(--nt-muted); }
.wl__tile-name--gap { margin-top: 6px; }
.wl__tile-value { font-size: 0.9375rem; font-weight: 600; }
.wl__tile-value.is-skipped { font-weight: 400; color: var(--nt-muted); }
.wl__change { font-size: 0.875rem; color: var(--nt-muted); text-decoration: underline; text-underline-offset: 3px; }
.wl__tile:hover .wl__change { color: var(--nt-plum); }
.wl__kind { margin: 4px 0 0; font-size: 1.25rem; line-height: 1.4; }

.wl__nav { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; padding-top: 8px; }
.wl__spacer { flex: 1; }
.wl__back::before { content: "\2190\00a0"; }

/* The summary: a journal page. Labels on the left, plain writing on the right. */
.wl__summary { gap: 24px; }
.wl__sum-head { display: flex; align-items: center; gap: 16px; }
.wl__sum-face { flex: none; width: 56px; }
.wl__sum-meta svg { flex: none; margin-top: 3px; }
.wl__sum-meta { display: flex; align-items: flex-start; gap: 6px; margin: 0 0 2px; font-size: 0.875rem; color: var(--nt-butter-d); }
.wl__sum-title { font-size: 1.75rem; line-height: 1.2; }
.wl__sum-title:focus { outline: none; }
.wl__story { margin: 0; font-size: 1.125rem; line-height: 1.65; }
.wl__rows { margin: 0; }
.wl__row { display: grid; grid-template-columns: 9.5rem minmax(0, 1fr); gap: 8px 24px; padding: 18px 0; border-top: 1px solid rgb(111 95 58 / 25%); }
.wl__row dt { font-size: 0.875rem; font-weight: 600; line-height: 1.6; color: var(--nt-butter-d); }
.wl__dt-note { display: block; font-weight: 400; }
.wl__row dd { display: flex; flex-direction: column; gap: 10px; margin: 0; font-size: 0.9375rem; line-height: 1.6; }
.wl__row dd p { margin: 0; }
.wl__plan { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.wl__plan-item { display: flex; align-items: flex-start; gap: 12px; }
.wl__plan-item.is-done .wl__plan-body { color: var(--nt-muted); }
.wl__plan-item.is-done .wl__plan-body strong { text-decoration: line-through; }
.wl__plan-body .app-link { margin-left: 4px; white-space: nowrap; }
.wl__tick { display: grid; flex: none; place-items: center; width: 20px; height: 20px; margin-top: 3px; padding: 0; background: #fff; border: 1.5px solid var(--nt-butter-d); border-radius: 50%; color: #fff; cursor: pointer; }
.wl__tick[aria-pressed="true"] { background: var(--nt-plum); border-color: var(--nt-plum); }
.wl__talk { font-weight: 500; }
.wl__share { margin: 0; font-size: 1rem; line-height: 1.6; }

/* Cards */
.wl__card { display: flex; flex-direction: column; gap: 12px; padding: 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.wl__card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.wl__h { font-size: 1.375rem; line-height: 1.3; }
.wl__body { margin: 0; font-size: 0.9375rem; line-height: 1.55; color: var(--nt-ink); }
.wl__only { font-size: 0.875rem; color: var(--nt-muted); white-space: nowrap; }

/* Week plot: mood as one dot a day, joined where days are consecutive. */
.wl__chart { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; margin-top: 8px; }
.wl__axis { position: relative; width: 4.5rem; height: 120px; margin-top: 10px; }
.wl__axis span { position: absolute; right: 0; transform: translateY(-50%); font-size: 0.875rem; color: var(--nt-muted); white-space: nowrap; }
.wl__plot-wrap { position: relative; min-width: 0; }
.wl__plot-area { position: absolute; top: 10px; left: 0; right: 0; height: 120px; }
.wl__guide { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--nt-line); }
.wl__line { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.wl__line path { fill: none; stroke: var(--nt-plum); stroke-width: 1.5; stroke-linejoin: round; opacity: 0.45; }
.wl__days { position: relative; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; }
.wl__day { display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 0; }
.wl__col { position: relative; display: block; width: 100%; height: 140px; }
.wl__dot { position: absolute; left: 50%; width: 12px; height: 12px; background: var(--nt-plum); border: 2px solid #fff; border-radius: 50%; transform: translate(-50%, -50%); }
.wl__weekday { padding-bottom: 2px; font-size: 0.875rem; color: var(--nt-muted); border-bottom: 2px solid transparent; }
.wl__weekday.is-today { font-weight: 600; color: var(--nt-ink); border-bottom-color: var(--nt-coral); }

.wl__disclaimer { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }

/* Pictures (the render functions at the top) */
/* :where() keeps this default weaker than the tile and strip sizes above. */
.wl :deep(:where(svg[class^="pic-"])) { display: block; width: 100%; height: auto; }
.wl :deep(.pic-t) { transition: fill 0.6s ease, opacity 0.6s ease; }
.wl :deep(.pic-move) { transition: transform 0.7s ease, opacity 0.6s ease; }
.wl :deep(.pic-stones) { overflow: visible; }
.wl :deep(.pic-stone) { opacity: 0; transform-box: fill-box; transform-origin: center; transition: opacity 0.35s ease, transform 0.45s ease; }
.wl :deep(.pic-stone.is-on) { opacity: 1; }
.wl :deep(.pic-area) { fill: #3b2f3f; fill-opacity: 0.06; stroke: #3b2f3f; stroke-opacity: 0.25; stroke-width: 1.5; stroke-dasharray: 3 3; cursor: pointer; transition: fill-opacity 0.2s ease, stroke-opacity 0.2s ease; }
.wl :deep(.pic-area:hover) { fill-opacity: 0.14; }
.wl :deep(.pic-area.is-on) { fill-opacity: 0.3; stroke-opacity: 0.9; stroke-dasharray: none; }
.wl :deep(.pic-body.is-static .pic-area) { cursor: default; }
.wl :deep(.pic-body.is-static .pic-area:not(.is-on)) { fill-opacity: 0; stroke-opacity: 0; }
.wl :deep(.pic-pair circle) { mix-blend-mode: multiply; }
.wl :deep(.pic-pair.is-faded), .wl :deep(.pic-face.is-faded) { opacity: 0.35; }

@media (max-width: 991px) { .wl__title { font-size: 2rem; } }
@media (max-width: 640px) {
  .wl__stage { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .wl__picture--narrow { max-width: 130px; }
  .wl__picture { max-width: 220px; }
  .wl__pairs { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .wl__faces { gap: 6px; }
  .wl__face { padding: 10px 4px; }
  .wl__row { grid-template-columns: minmax(0, 1fr); padding: 14px 0; }
  .wl__tile { grid-template-columns: 44px minmax(0, 1fr) auto; gap: 12px; }
}
@media (max-width: 575px) {
  .wl__box, .wl__card { padding: 20px 16px; }
  .wl__question { font-size: 1.5rem; }
  .wl__axis { display: none; }
  .wl__chart { grid-template-columns: minmax(0, 1fr); }
}
</style>
