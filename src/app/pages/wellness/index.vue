<script setup>
import "@/app/app.css";
import { computed, ref } from "vue";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppButton from "@/components/ui/AppButton.vue";
import ChipGroup from "@/app/components/ChipGroup.vue";
import { dateKey, useCheckinsStore } from "@/app/stores/checkins";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "WellnessPage" });

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
const stress = ref(existing?.stress ?? null);
const error = ref("");
const saved = ref(null); // { mood, stress } of the last save in this visit

function save() {
  if (!mood.value || !stress.value) {
    error.value = "Choose a mood and a stress level first.";
    return;
  }
  error.value = "";
  store.save({ mood: mood.value, stress: stress.value });
  saved.value = { mood: mood.value, stress: stress.value };
}

const hardStretch = computed(() => saved.value && (saved.value.mood === 1 || saved.value.stress === 5));

const days = computed(() => store.lastSeven(new Date()));
const hasAny = computed(() => days.value.some((d) => d.entry));
const barHeight = (value) => 16 + value * 20;
const barLabel = (day) =>
  day.entry
    ? `${day.weekday}: mood ${day.entry.mood} of 5, stress ${day.entry.stress} of 5`
    : `${day.weekday}: no check-in`;
</script>

<template>
  <div class="wl">
    <header class="wl__head">
      <h1 class="nt-title wl__title">Wellness, privately</h1>
      <p class="wl__sub">A short reflection for you. Not a diagnosis and not shared by default.</p>
    </header>

    <div class="wl__cols">
      <form class="wl__main" aria-labelledby="wl-question" novalidate @submit.prevent="save">
        <h2 id="wl-question" class="nt-heading">How are you feeling today?</h2>

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

        <div role="status" class="wl__status">
          <p v-if="saved" class="wl__saved">Saved. Only you can see this.</p>
        </div>

        <p v-if="hardStretch" class="wl__note">
          It sounds like a hard stretch. Support options are one tap away.
          <router-link class="app-link" :to="ROUTES.SUPPORT">See support resources</router-link>
        </p>
      </form>

      <aside class="wl__side" aria-label="Your pattern and support">
        <section aria-labelledby="wl-pattern">
          <div class="wl__title-row">
            <h2 id="wl-pattern" class="nt-heading nt-heading--sm">Your pattern</h2>
            <AppBadge color="gray" outlined>Private</AppBadge>
          </div>
          <p v-if="!hasAny" class="wl__muted">Your last check-ins will appear here.</p>
          <ul v-else class="wl__bars" aria-label="Mood over the last 7 days">
            <li v-for="day in days" :key="day.date" class="wl__bar-item">
              <span class="wl__bar-area">
                <span
                  v-if="day.entry"
                  class="wl__bar"
                  role="img"
                  :style="{ height: `${barHeight(day.entry.mood)}px` }"
                  :aria-label="barLabel(day)"
                  :title="barLabel(day)"
                ></span>
                <span v-else class="wl__bar wl__bar--empty" role="img" :aria-label="barLabel(day)" :title="barLabel(day)"></span>
              </span>
              <span class="wl__bar-num">{{ day.entry ? day.entry.mood : "" }}</span>
              <span class="wl__bar-day">{{ day.weekday }}</span>
            </li>
          </ul>
          <p v-if="hasAny" class="wl__muted">Bar height is your mood, from 1 to 5.</p>
        </section>

        <section aria-labelledby="wl-support">
          <h2 id="wl-support" class="nt-heading nt-heading--sm">Need a little support?</h2>
          <AppButton variant="outline" size="md" :to="ROUTES.SUPPORT">Explore resources</AppButton>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.wl { display: flex; flex-direction: column; gap: 24px; max-width: 1120px; margin: 0 auto; font-size: 1rem; }
.wl__head { display: flex; flex-direction: column; gap: 8px; }
.wl__title { font-size: 2.5rem; line-height: 1.2; }
.wl__sub { margin: 0; color: var(--nt-muted); }
.wl__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }

.wl__cols { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 40px; align-items: start; }
.wl__main { display: flex; flex-direction: column; gap: 24px; min-width: 0; max-width: 640px; }
.wl__group { display: flex; flex-direction: column; gap: 12px; min-width: 0; margin: 0; padding: 0; border: 0; }
.wl__legend { float: none; width: auto; margin: 0; padding: 0; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }
.wl__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.wl__status { margin-top: -8px; }
.wl__saved { margin: 0; font-size: 0.875rem; font-weight: 500; color: var(--nt-ink); }
.wl__note { margin: 0; padding-top: 16px; border-top: 1px solid var(--nt-line); font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }

.wl__side { display: flex; flex-direction: column; gap: 32px; min-width: 0; }
.wl__side section { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.wl__title-row { display: flex; align-items: center; gap: 12px; }
.wl__title-row h2, .wl__side h2 { margin: 0; }

.wl__bars { display: flex; align-items: flex-end; gap: 8px; width: 100%; margin: 0; padding: 0 0 8px; list-style: none; border-bottom: 1px solid var(--nt-line); }
.wl__bar-item { display: flex; flex: 1; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
.wl__bar-area { display: flex; align-items: flex-end; height: 120px; }
.wl__bar { display: block; width: 24px; background: var(--nt-plum); border-radius: 4px 4px 0 0; }
.wl__bar--empty { height: 2px; background: var(--nt-line); }
.wl__bar-num { min-height: 20px; font-size: 0.875rem; color: var(--nt-ink); }
.wl__bar-day { font-size: 0.875rem; color: var(--nt-muted); }

@media (max-width: 991px) {
  .wl__cols { grid-template-columns: minmax(0, 1fr); }
  .wl__title { font-size: 2rem; }
}
</style>
