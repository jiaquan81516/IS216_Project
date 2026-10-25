<script setup>
import "@/app/app.css";
import { computed, h, inject, nextTick, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import WeekTogether from "@/app/components/WeekTogether.vue";
import { NUDGES_KEY } from "@/app/composables/useNudges";
import { dateKey, useCheckinsStore } from "@/app/stores/checkins";
import { HOME_KEY } from "@/app/composables/useHome";
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
import { isHardCheckin, needsSupport } from "@/app/utils/loadHelpers";
import { ROUTES } from "@/app/routes";
import { setFeeling } from "@/api/team";
import { notifyPartner } from "@/api/push";

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
const home = inject(HOME_KEY, null);
const partnerName = computed(() => home?.partner?.value?.firstName || "");
const partnerFirst = computed(() => partnerName.value.split(" ")[0]);
const privacyLine = computed(() =>
  partnerName.value ? `You and ${partnerName.value} can both see your check-ins.` : "Your partner will see your check-ins once they join.",
);

// The weekly summary. Everything between you and your partner lives in the chat.
const nudgeState = inject(NUDGES_KEY, null);
const week = computed(() => nudgeState?.together.value ?? null);
const today = dateKey(new Date());

// A check-in from the last 24 hours stands in for today's quiz. It is shown first, and the quiz
// is only reopened when the parent chooses to change their answers.
const existing = store.recent() ?? store.forDate(today);
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
const view = ref(store.recent() ? "summary" : "steps");
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
const saveNote = computed(() => store.error);

async function save() {
  if (!mood.value || !stress.value) {
    goTo(!mood.value ? "light" : "stones").then(() => {
      error.value = "Choose one to carry on.";
    });
    return;
  }
  error.value = "";
  const entry = store.save(answers());
  savedEntry.value = entry;
  // Your partner sees the check-in itself, so a hard day also reaches their phone, once a day.
  if (partnerName.value && isHardCheckin(entry)) {
    shareHardDay(entry);
  }
  await showSummary();
}

// The server reads households/{hid}/feelings/{uid} to word the push, so write it first.
async function shareHardDay(entry) {
  const hid = home?.householdId?.value;
  const uid = home?.me?.value?.uid;
  if (!hid || !uid) return;
  try {
    await setFeeling(hid, uid, { level: "hard", date: entry.date });
    notifyPartner(hid, "feeling", uid);
  } catch (cause) {
    console.error("[app wellness]", cause?.code, cause);
  }
}

// Hydrate from the household once it has loaded: a check-in made on another device, or before a
// refresh, means this parent has already done today's quiz.
let pristine = true;
let adopted = Boolean(store.recent());
watch([mood, energy, stress, body, closeness, concerns, lifts], () => (pristine = false), { deep: true });
watch(
  () => store.loaded,
  (isLoaded) => {
    const entry = isLoaded ? store.recent() : null;
    if (!entry || adopted || !pristine || view.value !== "steps") return;
    adopted = true;
    mood.value = entry.mood;
    energy.value = entry.energy;
    stress.value = entry.stress;
    body.value = [...entry.body];
    closeness.value = entry.closeness;
    concerns.value = [...entry.concerns];
    lifts.value = [...entry.lifts];
    savedEntry.value = entry;
    showSummary();
  },
  { immediate: true },
);

const supportNeeded = computed(() => needsSupport(store.lastSeven(new Date()), new Date()));

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
const pathFor = (list) => {
  let path = "";
  let joined = false;
  list.forEach((day, i) => {
    if (!day.entry) {
      joined = false;
      return;
    }
    path += `${joined ? "L" : "M"}${xOf(i).toFixed(2)} ${yOf(day.entry.mood).toFixed(2)} `;
    joined = true;
  });
  return path.trim();
};
const linePath = computed(() => pathFor(days.value));
const partnerDays = computed(() => store.partnerLastSeven(new Date()));
const partnerLinePath = computed(() => pathFor(partnerDays.value));
const partnerLogged = computed(() => partnerDays.value.filter((d) => d.entry));

// One line for each of you, then what the two of you share.
function describe(list, who, verb) {
  if (!list.length) return `${who} ${verb === "are" ? "have" : "has"} not checked in this week.`;
  const counts = {};
  for (const d of list) counts[d.entry.mood] = (counts[d.entry.mood] ?? 0) + 1;
  const common = Number(Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]);
  let line = `${who} ${verb === "are" ? "have" : "has"} been mostly ${moodLabel(common).toLowerCase()} (${list.length} ${list.length === 1 ? "check-in" : "check-ins"}).`;
  if (list.length > 1) {
    const first = list[0];
    const last = list[list.length - 1];
    if (last.entry.stress < first.entry.stress) line += ` ${who === "You" ? "You are" : `${who} is`} carrying less than on ${first.weekday}.`;
    else if (last.entry.stress > first.entry.stress) line += ` ${who === "You" ? "You are" : `${who} is`} carrying more than on ${first.weekday}.`;
  }
  return line;
}
const weekSummary = computed(() => {
  if (!logged.value.length && !partnerLogged.value.length) return "One dot a day will appear here once you check in.";
  const lines = [describe(logged.value, "You", "are")];
  if (partnerName.value) lines.push(describe(partnerLogged.value, partnerFirst.value, "is"));
  const bothLow = days.value.filter((d, i) => d.entry && partnerDays.value[i].entry && d.entry.mood <= 2 && partnerDays.value[i].entry.mood <= 2);
  if (bothLow.length) {
    lines.push(`You were both low on ${bothLow.map((d) => d.weekday).join(" and ")}. That is a good day to ask for, or offer, a hand.`);
  }
  return lines.join(" ");
});
const bothLabel = (day, i) => {
  const theirs = partnerDays.value[i]?.entry;
  const mine = dayLabel(day);
  if (!partnerName.value) return mine;
  return `${mine}. ${partnerFirst.value}: ${theirs ? `mood ${moodLabel(theirs.mood).toLowerCase()} (${theirs.mood} of 5)` : "no check-in"}`;
};

// Reach out: shown in the summary when your partner's newest check-in this week was a hard one.
const partnerLatest = computed(() => [...partnerLogged.value].reverse()[0] ?? null);
const partnerHard = computed(() => {
  const entry = partnerLatest.value?.entry;
  if (!entry || !isHardCheckin(entry)) return false;
  return partnerLatest.value.date >= dateKey(new Date(Date.now() - 2 * 86400000));
});
// Against your other check-ins this week: lighter, heavier or about the same.
const trend = computed(() => {
  const earlier = logged.value.filter((d) => d.date !== today).map((d) => d.entry.mood);
  if (!earlier.length || !savedEntry.value) return null;
  const diff = savedEntry.value.mood - earlier.reduce((x, y) => x + y, 0) / earlier.length;
  return diff >= 1 ? "lighter" : diff <= -1 ? "heavier" : "same";
});
function reachOut() {
  nudgeState?.openChat();
}

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
      class="wl__box"
      aria-labelledby="wl-step-title"
      novalidate
      @submit.prevent="current === 'review' ? save() : next()"
    >
      <div class="wl__top">
        <section v-if="partnerName && week" class="wl__together" aria-labelledby="wl-together">
          <h2 id="wl-together" class="wl__h">Together with {{ partnerName }}</h2>
          <WeekTogether :summary="week" my-name="You" :partner-name="partnerName" />
        </section>

        <p class="wl__label">{{ partnerName ? `Shared with ${partnerName}` : "Daily check-in" }}</p>
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

      <!-- 5. Closeness -->
      <div v-else-if="current === 'close'" class="wl__close">
        <p class="wl__legend-row">
          <span class="wl__swatch wl__swatch--you" aria-hidden="true" /> You
          <span class="wl__swatch wl__swatch--them" aria-hidden="true" /> {{ partnerFirst || "Your partner" }}
        </p>
        <div class="wl__pairs" role="radiogroup" aria-label="How close you feel">
          <button
            v-for="o in CLOSENESS"
            :key="o.value"
            type="button"
            role="radio"
            class="wl__pair"
            :aria-checked="closeness === o.value ? 'true' : 'false'"
            @click="closeness = o.value"
          >
            <CloseCircles :level="o.value" />
            <span class="wl__option-label">{{ o.label }}</span>
          </button>
        </div>
      </div>

      <!-- 6. What took and what gave -->
      <div v-else-if="current === 'weigh'" class="wl__weigh">
        <fieldset class="wl__group">
          <legend class="wl__legend">
            Took the most out of me
            <span class="wl__muted-inline">Pick up to {{ MAX_CONCERNS }}</span>
          </legend>
          <div class="wl__chips" role="group" aria-label="Took the most out of me">
            <button
              v-for="c in CONCERNS"
              :key="c.value"
              type="button"
              class="app-chip"
              :aria-pressed="concerns.includes(c.value) ? 'true' : 'false'"
              :disabled="atLimit && !concerns.includes(c.value)"
              @click="toggleConcern(c.value)"
            >
              {{ c.label }}
            </button>
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

    <!-- The summary, after saving: one card per question the parent is likely to ask. -->
    <div v-else-if="reading" class="wl__summary">
      <!-- 1. The headline -->
      <section class="wl__card wl__hero" aria-labelledby="wl-summary-title">
        <span class="wl__hero-face" aria-hidden="true"><Face :level="savedEntry.mood" /></span>
        <div class="wl__hero-text">
          <p class="wl__chip wl__chip--done" role="status">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
            Checked in · {{ savedDay }}{{ savedTime ? `, ${savedTime}` : "" }}
          </p>
          <h2 id="wl-summary-title" ref="summaryHeading" class="nt-heading wl__sum-title" tabindex="-1">What today says</h2>
          <p class="wl__story">{{ reading.story }}</p>
          <p class="wl__hero-note">
            {{ partnerName ? `${partnerName} can see this.` : "Your partner will see this once they join." }}
            Next check-in tomorrow, or
            <button type="button" class="app-textbtn" @click="goTo('review')">change your answers</button>.
          </p>
          <p v-if="saveNote" class="app-error-text" role="alert">{{ saveNote }}</p>
        </div>
      </section>

      <!-- 2. Today at a glance -->
      <section class="wl__card wl__tone wl__tone--glance" aria-labelledby="wl-glance">
        <h3 id="wl-glance" class="nt-heading wl__sec">
          <span class="wl__sec-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9 10h.01M15 10h.01M8.5 15c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" /></svg></span>
          Today at a glance
        </h3>
        <ul class="wl__glance">
          <li class="wl__stat">
            <span class="wl__stat-pic wl__stat-pic--face"><Face :level="savedEntry.mood" /></span>
            <span class="wl__stat-name">Mood</span>
            <span class="wl__stat-value">{{ moodLabel(savedEntry.mood) }}</span>
          </li>
          <li class="wl__stat">
            <span class="wl__stat-pic"><TankJar :level="savedEntry.energy" clip="tile" /></span>
            <span class="wl__stat-name">Tank</span>
            <span class="wl__stat-value" :class="{ 'is-skipped': !savedEntry.energy }">{{ labelOf(ENERGY, savedEntry.energy) || "Skipped" }}</span>
          </li>
          <li class="wl__stat">
            <span class="wl__stat-pic"><StoneStack :count="savedEntry.stress" /></span>
            <span class="wl__stat-name">Carrying</span>
            <span class="wl__stat-value">{{ stressLabel(savedEntry.stress) }}</span>
          </li>
          <li class="wl__stat">
            <span class="wl__stat-pic wl__stat-pic--pair"><CloseCircles :level="savedEntry.closeness" /></span>
            <span class="wl__stat-name">With {{ partnerFirst || "your partner" }}</span>
            <span class="wl__stat-value" :class="{ 'is-skipped': !savedEntry.closeness }">{{ labelOf(CLOSENESS, savedEntry.closeness) || "Skipped" }}</span>
          </li>
        </ul>
        <dl v-if="savedEntry.body.length || savedEntry.concerns.length || savedEntry.lifts.length" class="wl__tags">
          <div v-if="savedEntry.body.length">
            <dt>Holding it in</dt>
            <dd><span v-for="a in savedEntry.body" :key="a" class="wl__tag wl__tag--body">{{ labelOf(BODY_AREAS, a) }}</span></dd>
          </div>
          <div v-if="savedEntry.concerns.length">
            <dt>Took the most</dt>
            <dd><span v-for="c in savedEntry.concerns" :key="c" class="wl__tag wl__tag--took">{{ labelOf(CONCERNS, c) }}</span></dd>
          </div>
          <div v-if="savedEntry.lifts.length">
            <dt>Gave a little back</dt>
            <dd><span v-for="l in savedEntry.lifts" :key="l" class="wl__tag wl__tag--gave">{{ labelOf(LIFTS, l) }}</span></dd>
          </div>
        </dl>
      </section>

      <!-- 3. What it might mean -->
      <section class="wl__card wl__tone wl__tone--mean" aria-labelledby="wl-mean">
        <h3 id="wl-mean" class="nt-heading wl__sec">
          <span class="wl__sec-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg></span>
          What it might mean
        </h3>
        <ul class="wl__insights">
          <li v-for="i in reading.insights" :key="i.title" class="wl__insight">
            <strong class="wl__insight-title">{{ i.title }}</strong>
            <span v-if="i.from" class="wl__insight-from">From your answers: {{ i.from }}</span>
            <span class="wl__insight-body">{{ i.body }}</span>
            <span v-if="i.tip" class="wl__insight-tip"><strong>Try this</strong> {{ i.tip }}</span>
          </li>
        </ul>
      </section>

      <!-- 4. The next 24 hours -->
      <section class="wl__card wl__tone wl__tone--plan" aria-labelledby="wl-plan">
        <div class="wl__sec-row">
          <h3 id="wl-plan" class="nt-heading wl__sec">
            <span class="wl__sec-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg></span>
            Next 24 hours
          </h3>
          <span class="wl__progress-label">{{ done.length }} of {{ reading.plan.length }} done</span>
        </div>
        <div class="wl__meter" aria-hidden="true"><span :style="{ width: `${(done.length / reading.plan.length) * 100}%` }" /></div>
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
            <div class="wl__plan-body">
              <strong class="wl__plan-title">{{ p.title }}</strong>
              <span class="wl__plan-text">{{ p.body }}</span>
              <router-link v-if="p.to" class="app-link" :to="p.to">{{ p.action }}</router-link>
            </div>
          </li>
        </ul>
      </section>

      <!-- 5. You and your partner. A hard day offers a way to reach out, and opens the chat. -->
      <section v-if="partnerName" class="wl__card wl__tone wl__tone--partner wl__partner" :class="{ 'is-hard': partnerHard }" aria-labelledby="wl-partner">
        <h3 id="wl-partner" class="nt-heading wl__sec">
          <span class="wl__sec-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.6" /><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M15 14.3c.6-.2 1.3-.3 2-.3 2.4 0 4 1.5 4 4" /></svg></span>
          You and {{ partnerFirst }}
        </h3>
        <div v-if="partnerLatest" class="wl__partner-row">
          <span class="wl__partner-face" aria-hidden="true"><Face :level="partnerLatest.entry.mood" /></span>
          <div>
            <p class="wl__partner-name">{{ partnerFirst }}, {{ partnerLatest.date === today ? "today" : partnerLatest.weekday }}</p>
            <p class="wl__partner-text">
              Feeling {{ moodLabel(partnerLatest.entry.mood).toLowerCase() }}, carrying {{ stressLabel(partnerLatest.entry.stress).toLowerCase() }}.
              <template v-if="partnerLatest.entry.concerns.length">
                Took the most: {{ labelsOf(CONCERNS, partnerLatest.entry.concerns).toLowerCase() }}.
              </template>
            </p>
          </div>
        </div>
        <p v-else class="wl__partner-text">{{ partnerFirst }} has not checked in this week yet.</p>

        <div v-if="partnerHard" class="wl__reach">
          <p class="wl__reach-text"><strong>{{ partnerFirst }} is not doing well.</strong> A short message can help more than you think.</p>
          <AppButton variant="outline" size="md" type="button" @click="reachOut">Reach out to {{ partnerFirst }}</AppButton>
        </div>

        <figure class="wl__say">
          <figcaption>If you want to say something to {{ partnerFirst }}. Nothing is sent.</figcaption>
          <blockquote>“{{ reading.share }}”</blockquote>
        </figure>
      </section>

      <!-- 6. Against your week -->
      <section class="wl__card wl__tone wl__tone--week" aria-labelledby="wl-compare">
        <h3 id="wl-compare" class="nt-heading wl__sec">
          <span class="wl__sec-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l5-5 4 4 8-9M15 7h5v5" /></svg></span>
          Against your week
        </h3>
        <p class="wl__trend" :class="trend && `wl__trend--${trend}`">
          <span v-if="trend" class="wl__trend-arrow" aria-hidden="true">{{ trend === "lighter" ? "↑" : trend === "heavier" ? "↓" : "→" }}</span>
          {{ reading.compare }}
        </p>
        <div v-if="reading.talk" class="wl__callout">
          <p>{{ reading.talk }}</p>
          <router-link class="app-link" :to="ROUTES.SUPPORT">Find support</router-link>
        </div>
      </section>

      <div class="wl__nav">
        <span class="wl__spacer" />
        <router-link class="app-link" :to="ROUTES.HOME">Back to Home</router-link>
      </div>
    </div>

    <section class="wl__card" aria-labelledby="wl-week">
      <div class="wl__card-head">
        <h2 id="wl-week" class="nt-heading wl__h">{{ partnerName ? "This week, together" : "Your week" }}</h2>
        <span v-if="partnerName" class="wl__legend-inline">
          <span class="wl__swatch wl__swatch--you" aria-hidden="true" /> You
          <span class="wl__swatch wl__swatch--them" aria-hidden="true" /> {{ partnerFirst }}
        </span>
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
            <svg v-if="partnerLinePath" class="wl__line wl__line--them" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path :d="partnerLinePath" vector-effect="non-scaling-stroke" />
            </svg>
          </div>
          <ul class="wl__days" aria-label="Mood over the last 7 days">
            <li v-for="(day, i) in days" :key="day.date" class="wl__day">
              <span class="wl__col" role="img" :aria-label="bothLabel(day, i)" :title="bothLabel(day, i)">
                <span v-if="day.entry" class="wl__dot" :class="{ 'wl__dot--solo': !partnerDays[i].entry }" :style="{ top: `${10 + yOf(day.entry.mood) * 1.2}px` }" />
                <span v-if="partnerDays[i].entry" class="wl__dot wl__dot--them" :class="{ 'wl__dot--solo': !day.entry }" :style="{ top: `${10 + yOf(partnerDays[i].entry.mood) * 1.2}px` }" />
              </span>
              <span class="wl__weekday" :class="{ 'is-today': day.date === today }">{{ day.date === today ? "Today" : day.weekday }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <p class="wl__disclaimer">
      For reflection, not diagnosis. Your check-ins are shared with your partner. If you feel unsafe, contact emergency services or a
      healthcare professional.
    </p>
  </div>
</template>

<style scoped>
.wl { display: flex; flex-direction: column; gap: 24px; max-width: 760px; font-size: 1rem; color: var(--nt-ink); }
.wl__head { display: flex; flex-direction: column; gap: 8px; }
.wl__sub { margin: 0; color: var(--nt-muted); }

/* The butter "Yours alone" box, for the check-in and its summary. */
.wl__box { display: flex; flex-direction: column; gap: 16px; padding: 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.wl__top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px; }
.wl__label { display: inline-flex; align-items: center; gap: 6px; margin: 0; }
.wl__count-step { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.wl__progress { height: 2px; background: var(--nt-line); }
.wl__progress span { display: block; height: 100%; background: var(--nt-plum); transition: width 0.3s ease; }
.wl__earlier { margin: 4px 0 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.wl__earlier .app-textbtn { margin-left: 4px; }
.wl__question { margin-top: 8px; font-size: 1.75rem; line-height: 1.25; }
.wl__question:focus { outline: none; }
.wl__hint { margin: -8px 0 4px; font-size: 0.9375rem; line-height: 1.5; color: var(--nt-muted); }

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
.wl__legend-row { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
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
.wl__muted-inline { margin-left: 6px; font-weight: 400; color: var(--nt-muted); }

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
.wl__sum-title { font-size: 1.75rem; line-height: 1.2; }
.wl__sum-title:focus { outline: none; }
.wl__plan { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.wl__plan-item { display: flex; align-items: flex-start; gap: 12px; }
.wl__plan-item.is-done .wl__plan-body { color: var(--nt-muted); }
.wl__plan-item.is-done .wl__plan-body strong { text-decoration: line-through; }
.wl__plan-body .app-link { margin-left: 4px; white-space: nowrap; }
.wl__summary { display: flex; flex-direction: column; gap: 16px; }
.wl__chip { display: inline-flex; align-items: center; gap: 6px; margin: 0; padding: 4px 10px; border-radius: 999px; font-size: 0.875rem; font-weight: 500; }
.wl__chip--done { background: #ccfbf1; color: #115e59; }
.wl__hero { flex-direction: row; align-items: center; gap: 24px; background: #f4f7fb; }
.wl__hero-face { flex: none; width: 96px; }
.wl__hero-text { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; min-width: 0; }
.wl__story { margin: 0; font-size: 1.0625rem; line-height: 1.6; }
.wl__hero-note { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.wl__sec { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 1.25rem; line-height: 1.3; }
.wl__tone { background: var(--tint); border-color: var(--edge); }
.wl__tone--glance { --tint: #f3f7fc; --edge: #dce6f2; --accent: #dbeafe; --ink: #1e40af; }
.wl__tone--mean { --tint: #fdf5ef; --edge: #f6d8c6; --accent: #f6d8c6; --ink: #7a3f1f; }
.wl__tone--plan { --tint: #f1fcfa; --edge: #ccfbf1; --accent: #ccfbf1; --ink: #115e59; }
.wl__tone--partner { --tint: #f7f3f8; --edge: #e6dce9; --accent: #e6dce9; --ink: #3b2f3f; }
.wl__tone--week { --tint: #f8f9fb; --edge: #e5e7eb; --accent: #e5e7eb; --ink: #374151; }
.wl__sec-icon { display: grid; flex: none; place-items: center; width: 32px; height: 32px; background: var(--accent, var(--nt-gray)); border-radius: 8px; color: var(--ink, var(--nt-plum)); }
.wl__tone .wl__stat, .wl__tone .wl__plan-item.is-done, .wl__tone .wl__say, .wl__tone .wl__trend { background: #fff; }
.wl__tone .wl__insight { background: #fff; }
.wl__tone .wl__plan-item { background: #fff; border-color: var(--edge); }
.wl__tone .wl__plan-item.is-done { background: rgb(255 255 255 / 55%); }
.wl__tone .wl__meter { background: #fff; }
.wl__tone--plan .wl__meter span { background: #14b8a6; }
.wl__tone .wl__insight-from { background: var(--accent); color: var(--ink); }
.wl__tone .wl__insight-tip strong { color: var(--ink); }
.wl__sec-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.wl__glance { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.wl__stat { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 14px 8px 12px; background: var(--nt-gray); border-radius: 12px; text-align: center; }
.wl__stat-pic { display: flex; align-items: center; justify-content: center; height: 56px; margin-bottom: 6px; }
.wl__stat-pic :deep(svg) { width: auto; max-width: 100%; height: 100%; }
.wl__stat-pic--face :deep(svg) { height: 48px; }
.wl__stat-pic--pair :deep(svg) { height: 30px; }
.wl__stat-name { font-size: 0.875rem; color: var(--nt-muted); }
.wl__stat-value { font-size: 0.9375rem; font-weight: 600; }
.wl__stat-value.is-skipped { font-weight: 400; color: var(--nt-muted); }
.wl__tags { display: flex; flex-direction: column; gap: 10px; margin: 0; }
.wl__tags > div { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.wl__tags dt { flex: 0 0 9rem; font-size: 0.875rem; font-weight: 400; color: var(--nt-muted); }
.wl__tags dd { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
.wl__tag { padding: 3px 10px; border-radius: 999px; font-size: 0.875rem; font-weight: 500; }
.wl__tag--body { background: #dce6f2; color: #34506f; }
.wl__tag--took { background: #f6d8c6; color: #7a3f1f; }
.wl__tag--gave { background: #ccfbf1; color: #115e59; }
.wl__insights { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; margin: 0; padding: 0; list-style: none; }
.wl__insight { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; background: var(--nt-gray); border-left: 4px solid #5c7a9e; border-radius: 8px; }
.wl__insight:nth-child(2) { border-left-color: #e3a584; }
.wl__insight:nth-child(3) { border-left-color: #14b8a6; }
.wl__insight-title { font-size: 1rem; }
.wl__insight-from { align-self: flex-start; padding: 2px 10px; background: #fff; border-radius: 999px; font-size: 0.875rem; color: var(--nt-muted); }
.wl__insight-tip { padding-top: 8px; border-top: 1px solid var(--nt-line); font-size: 0.9375rem; line-height: 1.55; }
.wl__insight-tip strong { margin-right: 4px; color: var(--nt-plum); }
.wl__insight-body { font-size: 0.9375rem; line-height: 1.55; color: var(--nt-ink); }
.wl__progress-label { font-size: 0.875rem; color: var(--nt-muted); white-space: nowrap; }
.wl__meter { height: 6px; background: var(--nt-line); border-radius: 999px; overflow: hidden; }
.wl__meter span { display: block; height: 100%; background: var(--nt-plum); transition: width 0.3s ease; }
.wl__plan { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.wl__plan-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border: 1px solid var(--nt-line); border-radius: 8px; }
.wl__plan-item.is-done { background: var(--nt-gray); }
.wl__plan-item.is-done .wl__plan-body { color: var(--nt-muted); }
.wl__plan-item.is-done .wl__plan-title { text-decoration: line-through; }
.wl__plan-body { display: flex; flex-direction: column; gap: 2px; font-size: 0.9375rem; line-height: 1.55; }
.wl__plan-body .app-link { align-self: flex-start; margin-top: 2px; }
.wl__tone.wl__partner.is-hard { --tint: #fff6ef; --edge: #e3a584; --accent: #f6d8c6; --ink: #7a3f1f; }
.wl__partner-row { display: flex; align-items: center; gap: 14px; }
.wl__partner-face { flex: none; width: 52px; }
.wl__partner-name { margin: 0; font-weight: 600; }
.wl__partner-text { margin: 0; font-size: 0.9375rem; line-height: 1.5; }
.wl__reach { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; background: #fff; border: 1px solid #e3a584; border-radius: 8px; }
.wl__reach-text { flex: 1 1 14rem; margin: 0; font-size: 0.9375rem; line-height: 1.5; }
.wl__say { margin: 0; padding: 14px 16px; background: var(--nt-gray); border-radius: 8px; }
.wl__say figcaption { margin-bottom: 6px; font-size: 0.875rem; color: var(--nt-muted); }
.wl__say blockquote { margin: 0; font-size: 1rem; line-height: 1.6; }
.wl__trend { display: flex; align-items: center; gap: 12px; margin: 0; padding: 12px 14px; background: var(--nt-gray); border-radius: 8px; font-size: 0.9375rem; line-height: 1.5; }
.wl__trend-arrow { display: grid; flex: none; place-items: center; width: 28px; height: 28px; background: #fff; border-radius: 50%; font-size: 1.125rem; font-weight: 600; }
.wl__trend--lighter .wl__trend-arrow { color: #115e59; }
.wl__trend--heavier .wl__trend-arrow { color: #c0553b; }
.wl__callout { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 14px 16px; border: 1px solid var(--nt-line); border-left: 4px solid #c0553b; border-radius: 8px; font-size: 0.9375rem; line-height: 1.55; }
.wl__callout p { margin: 0; }
.wl__tick { display: grid; flex: none; place-items: center; width: 20px; height: 20px; margin-top: 3px; padding: 0; background: #fff; border: 1.5px solid var(--nt-muted); border-radius: 50%; color: #fff; cursor: pointer; }
.wl__tick[aria-pressed="true"] { background: var(--nt-plum); border-color: var(--nt-plum); }

/* Cards */
.wl__card { display: flex; flex-direction: column; gap: 12px; padding: 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.wl__card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.wl__h { font-size: 1.375rem; line-height: 1.3; }
.wl__body { margin: 0; font-size: 0.9375rem; line-height: 1.55; color: var(--nt-ink); }
.wl__legend-inline { display: inline-flex; align-items: center; gap: 6px; font-size: 0.875rem; color: var(--nt-muted); white-space: nowrap; }
.wl__dot--them { left: 62%; background: var(--nt-apricot-d); }
.wl__dot--solo { left: 50%; }
.wl__line--them path { stroke: var(--nt-apricot-d); }
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
.wl__dot { position: absolute; left: 38%; width: 12px; height: 12px; background: var(--nt-plum); border: 2px solid #fff; border-radius: 50%; transform: translate(-50%, -50%); }
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
  .wl__glance { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wl__hero { flex-direction: column; align-items: flex-start; }
  .wl__tags dt { flex-basis: 100%; }
  .wl__stage { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .wl__picture--narrow { max-width: 130px; }
  .wl__picture { max-width: 220px; }
  .wl__pairs { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .wl__faces { gap: 6px; }
  .wl__face { padding: 10px 4px; }
  .wl__tile { grid-template-columns: 44px minmax(0, 1fr) auto; gap: 12px; }
}
@media (max-width: 575px) {
  .wl__box, .wl__card { padding: 20px 16px; }
  .wl__question { font-size: 1.5rem; }
  .wl__axis { display: none; }
  .wl__chart { grid-template-columns: minmax(0, 1fr); }
}
</style>
