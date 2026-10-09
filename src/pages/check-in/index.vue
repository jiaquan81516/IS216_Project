<script setup>
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import ChoiceChips from "@/components/ui/ChoiceChips.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import YoursAlone from "@/components/ui/YoursAlone.vue";
import { CHART_ROWS, QUESTIONS, SAMPLE_HISTORY, dateKey, loadCheckins, saveCheckin } from "@/data/checkin.js";
import { ROUTES } from "@/shared/constants/routes";

defineOptions({ name: "checkInPage" });

const router = useRouter();

// Private to this device. Nothing here is read from or written to a shared store.
const saved = ref(loadCheckins());
const today = new Date();
const todayKey = dateKey(today);

const answers = reactive({ mood: 3, stress: 3, sleep: 2, confidence: 3 });
const todaySaved = computed(() => Boolean(saved.value[todayKey]));
if (saved.value[todayKey]) {
  for (const q of QUESTIONS) answers[q.key] = saved.value[todayKey][q.key] ?? answers[q.key];
}

const DAY_LETTERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
// Six days before today, oldest first, then today.
const days = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(today);
  d.setDate(today.getDate() - (6 - i));
  return { key: dateKey(d), label: DAY_LETTERS[d.getDay()] };
});

function valueFor(metric, day, idx) {
  return saved.value[day.key]?.[metric] ?? SAMPLE_HISTORY[metric][idx];
}

const chart = computed(() =>
  CHART_ROWS.map((row) => ({
    ...row,
    bars: days.map((d, i) => ({ key: d.key, value: valueFor(row.key, d, i) })),
    today: answers[row.key],
  })),
);

// Bar height in px for a 1 to 5 value.
const barHeight = (v) => 10 + v * 10;

const lowSleepDays = computed(() => {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (valueFor("sleep", days[i], i) < 3) n++;
    else break;
  }
  return n;
});

const sleepNote = computed(() => {
  const lead =
    lowSleepDays.value > 0
      ? `Your sleep has been below fair for ${lowSleepDays.value} day${lowSleepDays.value === 1 ? "" : "s"}.`
      : "Your sleep has been fair or better lately.";
  return `${lead} Dashed bars are today, not saved yet.`;
});

const lastSaved = computed(() => {
  const times = Object.values(saved.value)
    .map((v) => v?.savedAt)
    .filter(Boolean)
    .sort();
  const latest = times[times.length - 1];
  if (!latest) return "Last saved yesterday at 9:40 PM";
  const d = new Date(latest);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return dateKey(d) === todayKey ? `Last saved today at ${time}` : `Last saved ${d.toLocaleDateString("en-US", { weekday: "long" })} at ${time}`;
});

function save() {
  saved.value = saveCheckin({ ...answers });
  router.push(ROUTES.HOME);
}

const calendarUrl = (() => {
  const start = new Date(today);
  start.setDate(today.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 10 * 60 * 1000);
  const fmt = (d) => `${dateKey(d).replaceAll("-", "")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Ten minutes outside",
    details: "Daylight and a short walk after the morning feed.",
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
})();

const options = Object.fromEntries(
  QUESTIONS.map((q) => [q.key, q.options.map((label, i) => ({ value: i + 1, label }))]),
);
</script>

<template>
  <div class="nt-stack">
    <PageHeader title="Check-in" subtitle="A minute for yourself, once a day.">
      <span class="nt-muted nt-small">{{ lastSaved }}</span>
    </PageHeader>

    <div class="nt-cols">
      <div class="nt-col">
        <YoursAlone>
          <h2 class="nt-heading checkin__title">How are you doing today?</h2>
          <p class="mb-0" style="font-size: 0.9375rem">Four quick questions. Mei can’t see your answers.</p>

          <fieldset v-for="q in QUESTIONS" :key="q.key" class="checkin__q">
            <legend class="checkin__q-title">{{ q.title }}</legend>
            <p class="checkin__q-hint">{{ q.hint }}</p>
            <ChoiceChips v-model="answers[q.key]" :options="options[q.key]" variant="tinted" :aria-label="q.title" />
          </fieldset>

          <p class="mb-0" style="font-size: 0.8125rem">This is a reflection tool, not a clinical assessment.</p>
          <div class="d-flex flex-wrap align-items-center gap-4 pt-2">
            <AppButton @click="save">Save check-in</AppButton>
            <AppLink :to="ROUTES.HOME">Skip today</AppLink>
          </div>
        </YoursAlone>
      </div>

      <aside class="nt-col" aria-label="Your history and ideas">
        <AppCard title="Your last 7 days">
          <div class="chart" role="img" aria-label="Bar chart of your last 7 days for mood, stress, sleep and confidence">
            <div class="chart__row chart__row--head" aria-hidden="true">
              <span class="chart__name"></span>
              <span v-for="d in days" :key="d.key" class="chart__col-label">{{ d.label }}</span>
              <span class="chart__col-label">Now</span>
            </div>
            <div v-for="row in chart" :key="row.key" class="chart__row" aria-hidden="true">
              <span class="chart__name">{{ row.label }}</span>
              <span v-for="b in row.bars" :key="b.key" class="chart__bar" :style="{ height: `${barHeight(b.value)}px` }"></span>
              <span
                class="chart__bar"
                :class="{ 'chart__bar--today': !todaySaved }"
                :style="{ height: `${barHeight(row.today)}px` }"
              ></span>
            </div>
          </div>
          <p class="nt-muted mb-0 nt-small">{{ sleepNote }}</p>
        </AppCard>

        <AppCard title="Small things that might help">
          <div class="help-item">
            <p class="help-item__title">Ten minutes outside after the morning feed</p>
            <p class="help-item__text">Daylight and a short walk can lift a heavy day.</p>
            <a class="nt-link nt-small" :href="calendarUrl" target="_blank" rel="noopener noreferrer">Add to calendar</a>
          </div>
          <hr class="nt-rule" />
          <div class="help-item">
            <p class="help-item__title">Ask for one early night this week</p>
            <p class="help-item__text">Swap a night with Mei so you get a full stretch of sleep.</p>
            <AppLink :to="ROUTES.ROTA" class="nt-small">Open sleep rotation</AppLink>
          </div>
          <hr class="nt-rule" />
          <div class="help-item">
            <p class="help-item__title">Talk to someone</p>
            <p class="help-item__text">If you’ve felt low or anxious for more than two weeks, speak to your doctor or a counsellor.</p>
            <AppLink :to="ROUTES.HELP_READING" class="nt-small">Find support services</AppLink>
          </div>
        </AppCard>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.checkin__title {
  font-size: 1.75rem;
}
.checkin__q {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 12px 0 0;
  border: 0;
}
.checkin__q-title {
  float: none;
  width: auto;
  margin: 0;
  padding: 0;
  font-size: 1.0625rem;
  font-weight: 500;
}
.checkin__q-hint {
  margin: 0;
  font-size: 0.875rem;
}
.chart {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-x: auto;
}
.chart__row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.chart__row--head {
  align-items: flex-start;
}
.chart__name {
  flex: none;
  width: 76px;
  font-size: 0.8125rem;
  font-weight: 500;
}
.chart__col-label {
  flex: none;
  width: 28px;
  font-size: 0.75rem;
  text-align: center;
  color: var(--nt-muted);
}
.chart__bar {
  flex: none;
  width: 28px;
  background: var(--nt-plum);
  border: 1.5px solid var(--nt-plum);
  border-radius: 3px;
}
.chart__bar--today {
  background: transparent;
  border-style: dashed;
}
.help-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.help-item__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 500;
}
.help-item__text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 20px;
  color: var(--nt-muted);
}
</style>
