<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppLink from "@/components/ui/AppLink.vue";
import AvatarDot from "@/components/ui/AvatarDot.vue";
import ChoiceChips from "@/components/ui/ChoiceChips.vue";
import EntryPillTabs from "@/components/ui/EntryPillTabs.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import { ROUTES, path } from "@/shared/constants/routes";
import { NOW_MIN, TODAY, addEntry, entries, filterEntries, fmtTime, sortEntries } from "@/data/careLog";
import FeedTimer from "./components/FeedTimer.vue";

defineOptions({ name: "AddEntryPage" });

const router = useRouter();

const TYPES = [
  { value: "feed", label: "Feed" },
  { value: "sleep", label: "Sleep" },
  { value: "nappy", label: "Nappy" },
  { value: "medication", label: "Medication" },
  { value: "note", label: "Note" },
];
const STARTED = [
  { value: 0, label: "Today, Tuesday 6 October" },
  { value: 30, label: "Today, 30 minutes ago" },
  { value: 60, label: "Today, 1 hour ago" },
  { value: 120, label: "Today, 2 hours ago" },
];

const type = ref("feed");
const startedAgo = ref(0);
const notes = ref("");

// Feed
const how = ref("breast");
const side = ref("left");
const minutes = ref("14");
const amount = ref("");
// Sleep
const sleepKind = ref("Nap");
const sleepMinutes = ref("60");
// Nappy
const nappyKind = ref("Wet");
// Medication
const medicine = ref("Vitamin D drops");
// Note
const noteText = ref("");

const guideTo = path(ROUTES.GUIDE, { topic: "settle" });
const timerRef = ref(null);

const lastFeeds = computed(() =>
  sortEntries(filterEntries(entries, "feed").filter((e) => !e.live))
    .slice(0, 3)
    .map((e) => ({ id: e.id, time: fmtTime(e.min), text: e.text.replace(" minutes", " min"), who: e.who })),
);

const sleepLabel = (m) => {
  const n = Number(m) || 0;
  return n >= 60 ? `${Math.floor(n / 60)} h ${n % 60} min` : `${n} min`;
};

const valid = computed(() => {
  if (type.value === "note") return noteText.value.trim().length > 0;
  if (type.value === "feed") return Number(minutes.value) > 0 || (how.value === "bottle" && Number(amount.value) > 0);
  if (type.value === "sleep") return Number(sleepMinutes.value) > 0;
  return true;
});

function buildEntry() {
  const base = { type: type.value, min: NOW_MIN - startedAgo.value, date: TODAY, detail: notes.value.trim() };
  switch (type.value) {
    case "feed": {
      const mins = Number(minutes.value) > 0 ? `${Number(minutes.value)} minutes` : "";
      let text;
      if (how.value === "breast") {
        const where = side.value === "both" ? "Both breasts" : `${side.value === "left" ? "Left" : "Right"} breast`;
        text = `${where}, ${mins}`;
      } else if (how.value === "bottle") {
        text = Number(amount.value) > 0 ? `Bottle, ${Number(amount.value)} ml` : `Bottle, ${mins}`;
      } else {
        text = `Expressed milk, ${mins}`;
      }
      return { ...base, text };
    }
    case "sleep":
      return { ...base, text: `${sleepKind.value}, ${sleepLabel(sleepMinutes.value)}`, sleepMin: Number(sleepMinutes.value) };
    case "nappy":
      return { ...base, text: `${nappyKind.value}, changed` };
    case "medication":
      return {
        ...base,
        text: medicine.value === "Vitamin D drops" ? "Vitamin D drops, as on the label" : "Prescribed medicine, as on the label",
      };
    default:
      return { ...base, text: noteText.value.trim(), detail: "" };
  }
}

const tried = ref(false);
function save() {
  tried.value = true;
  if (!valid.value) return;
  timerRef.value?.stop();
  addEntry(buildEntry());
  router.push(ROUTES.CARE_LOG);
}

// Stopping the timer fills in the minutes.
function onTimerStop(seconds) {
  if (seconds > 0) minutes.value = String(Math.max(1, Math.round(seconds / 60)));
}

onBeforeUnmount(() => timerRef.value?.stop());
</script>

<template>
  <div class="nt-stack">
    <div><AppLink muted :to="ROUTES.CARE_LOG">Back to the care log</AppLink></div>
    <PageHeader title="Add to the care log" subtitle="Mei will see this as soon as you save it." />
    <div><EntryPillTabs v-model="type" :tabs="TYPES" aria-label="Entry type" /></div>

    <div class="nt-cols">
      <form class="nt-col form-col" novalidate @submit.prevent="save">
        <template v-if="type === 'feed'">
          <div class="field">
            <span id="how-label" class="field__label field__label--lg">How was baby fed?</span>
            <ChoiceChips
              v-model="how"
              aria-label="How was baby fed?"
              :options="[
                { value: 'breast', label: 'Breast' },
                { value: 'bottle', label: 'Bottle' },
                { value: 'expressed', label: 'Expressed milk' },
              ]"
            />
          </div>
          <div v-if="how === 'breast'" class="field">
            <span class="field__label field__label--lg">Which side?</span>
            <ChoiceChips
              v-model="side"
              aria-label="Which side?"
              :options="[
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
                { value: 'both', label: 'Both' },
              ]"
            />
          </div>
        </template>

        <template v-else-if="type === 'sleep'">
          <div class="field">
            <span class="field__label field__label--lg">What kind of sleep?</span>
            <ChoiceChips v-model="sleepKind" aria-label="What kind of sleep?" :options="['Nap', 'Night sleep']" />
          </div>
        </template>

        <template v-else-if="type === 'nappy'">
          <div class="field">
            <span class="field__label field__label--lg">What was in the nappy?</span>
            <ChoiceChips v-model="nappyKind" aria-label="What was in the nappy?" :options="['Wet', 'Dirty', 'Wet and dirty']" />
          </div>
        </template>

        <template v-else-if="type === 'medication'">
          <div class="field">
            <span class="field__label field__label--lg">Which medication?</span>
            <ChoiceChips v-model="medicine" aria-label="Which medication?" :options="['Vitamin D drops', 'Prescribed medicine']" />
            <p class="nt-small nt-muted mb-0">Log it exactly as the label or your doctor says. This log never suggests doses.</p>
          </div>
        </template>

        <div v-if="type !== 'note'" class="field">
          <label for="started" class="field__label">{{ type === "sleep" ? "Fell asleep at" : "Started at" }}</label>
          <select id="started" v-model="startedAgo" class="form-select">
            <option v-for="o in STARTED" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>

        <div v-if="type === 'feed'" class="row-fields">
          <div class="field">
            <label for="minutes" class="field__label">Minutes</label>
            <input id="minutes" v-model="minutes" class="form-control" type="number" min="1" inputmode="numeric" placeholder="14" />
          </div>
          <div class="field">
            <label for="amount" class="field__label">Amount (ml)</label>
            <input
              id="amount"
              v-model="amount"
              class="form-control"
              type="number"
              min="1"
              inputmode="numeric"
              placeholder="90"
              :disabled="how !== 'bottle'"
              aria-describedby="amount-hint"
            />
            <span id="amount-hint" class="nt-small nt-muted">Bottle only</span>
          </div>
        </div>

        <div v-if="type === 'sleep'" class="field">
          <label for="sleep-min" class="field__label">Minutes asleep</label>
          <input id="sleep-min" v-model="sleepMinutes" class="form-control" type="number" min="1" inputmode="numeric" />
        </div>

        <div v-if="type === 'note'" class="field">
          <label for="note-text" class="field__label">Note for Mei</label>
          <textarea
            id="note-text"
            v-model="noteText"
            class="form-control"
            rows="3"
            placeholder="Anything she should know before the next feed."
          />
          <span v-if="tried && !valid" class="nt-small field__error">Write a short note first.</span>
        </div>
        <div v-else class="field">
          <label for="notes" class="field__label">Notes for Mei</label>
          <input id="notes" v-model="notes" class="form-control" type="text" placeholder="Optional. Anything she should know before the next feed." />
        </div>

        <div class="actions">
          <AppButton type="submit">Save entry</AppButton>
          <AppLink :to="ROUTES.CARE_LOG">Cancel</AppLink>
        </div>
        <p class="nt-small nt-muted mb-0">Entries you save can be edited for 24 hours. Mei is told about any change.</p>
      </form>

      <div class="nt-col">
        <FeedTimer v-if="type === 'feed'" ref="timerRef" @stop="onTimerStop" />
        <section class="nt-card">
          <h2 class="nt-heading nt-heading--sm">Last three feeds</h2>
          <div v-for="f in lastFeeds" :key="f.id" class="last">
            <span class="last__time">{{ f.time }}</span>
            <span class="last__text">{{ f.text }}</span>
            <AvatarDot :who="f.who" :size="24" />
          </div>
        </section>
        <div><AppLink :to="guideTo">Stuck? See what to try</AppLink></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-col {
  gap: 20px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field__label {
  font-weight: 500;
  font-size: 0.9375rem;
}
.field__label--lg {
  font-size: 1rem;
}
.field__error {
  color: var(--nt-coral);
}
.row-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 20px;
}
.last {
  display: flex;
  align-items: center;
  gap: 12px;
}
.last__time {
  width: 64px;
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.last__text {
  flex: 1;
  font-size: 0.9375rem;
  font-weight: 500;
}
@media (max-width: 575px) {
  .row-fields {
    grid-template-columns: 1fr;
  }
}
</style>
