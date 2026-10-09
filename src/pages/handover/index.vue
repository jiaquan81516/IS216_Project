<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import ChoiceChips from "@/components/ui/ChoiceChips.vue";
import ChoiceRow from "@/components/ui/ChoiceRow.vue";
import HandoverShiftRows from "@/components/ui/HandoverShiftRows.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StepMarker from "@/components/ui/StepMarker.vue";
import { DEFAULT_NEXT_UP, DEFAULT_NOTE, SHIFT_ROWS, saveDraft, sendHandover } from "@/data/handover.js";
import { ROUTES } from "@/shared/constants/routes";

defineOptions({ name: "handoverPage" });

const router = useRouter();

const QUICK_NOTES = [
  "Fussy after feeds",
  "Slept well",
  "Nappy cream used",
  "Spat up a little",
  "Gas drops given",
  "Low on wipes",
];

const STEPS = [
  { title: "You send it", text: "5:50 PM, when you tap Send. The handover is saved to the care log." },
  { title: "Mei is notified", text: "A push alert goes to her phone straight away." },
  { title: "Mei taps Got it", text: "You see the time she read it. If she has not by 6:15 PM we remind her once." },
  { title: "On call switches", text: "Mei is on call from 6 PM. Alerts move from your phone to hers." },
  { title: "Both of you can look back", text: "Past handovers stay in the log, newest first." },
];

const note = ref(DEFAULT_NOTE);
const picked = ref(["Fussy after feeds"]);
const nextUp = ref([...DEFAULT_NEXT_UP]);
const needsAttention = ref(false);
const addingTask = ref(false);
const newTask = ref("");

// Tapping a chip adds its text to the note, tapping again takes it out.
function onPick(next) {
  const prev = picked.value;
  for (const text of next.filter((t) => !prev.includes(t))) {
    const base = note.value.trim();
    note.value = base ? `${base} ${text}.` : `${text}.`;
  }
  for (const text of prev.filter((t) => !next.includes(t))) {
    note.value = note.value
      .replace(`${text}.`, "")
      .replace(text, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  picked.value = next;
}

const canAddTask = computed(() => newTask.value.trim().length > 0);

function addTask() {
  if (!canAddTask.value) return;
  nextUp.value.push(newTask.value.trim());
  newTask.value = "";
  addingTask.value = false;
}

function payload() {
  return { note: note.value.trim(), needsAttention: needsAttention.value, nextUp: nextUp.value };
}

function send() {
  sendHandover(payload());
  router.push(ROUTES.HANDOVER_RECEIVED);
}

function draft() {
  saveDraft(payload());
  router.push(ROUTES.CARE_LOG);
}
</script>

<template>
  <div class="nt-stack">
    <AppLink :to="ROUTES.CARE_LOG" muted class="align-self-start">Back to the care log</AppLink>
    <PageHeader
      title="Hand over to Mei"
      subtitle="Tuesday 5:50 PM. Your day shift, 6 AM to 6 PM. Mei is on call from 6 PM."
    />

    <div class="nt-cols">
      <div class="nt-col">
        <AppCard title="What happened this shift" variant="plain">
          <p class="nt-muted mb-0 handover__intro">Filled in from the care log. Edit anything that is wrong.</p>
          <HandoverShiftRows :rows="SHIFT_ROWS" editable />
        </AppCard>

        <AppCard title="What Mei should know">
          <label for="handover-note" class="handover__label">Your note</label>
          <textarea id="handover-note" v-model="note" class="form-control" rows="3"></textarea>
          <p class="nt-muted nt-small mb-0" id="quick-note-label">Tap to add a quick note:</p>
          <ChoiceChips
            :model-value="picked"
            :options="QUICK_NOTES"
            multiple
            aria-label="Quick notes"
            @update:model-value="onPick"
          />
        </AppCard>

        <AppCard title="Next up">
          <ul class="handover__list">
            <li v-for="(item, i) in nextUp" :key="`${i}-${item}`">
              <span class="nt-muted" aria-hidden="true">–</span>
              <span>{{ item }}</span>
            </li>
          </ul>
          <form v-if="addingTask" class="handover__add" @submit.prevent="addTask">
            <label for="handover-task" class="visually-hidden">New task for Mei</label>
            <input id="handover-task" v-model="newTask" class="form-control" placeholder="What should Mei do?" />
            <AppButton type="submit" variant="outline" size="md" :disabled="!canAddTask" @click.prevent="addTask">Add</AppButton>
          </form>
          <AppLink v-else class="align-self-start" @click="addingTask = true">Add a task for Mei</AppLink>
          <hr class="nt-rule" />
          <ChoiceRow
            v-model="needsAttention"
            type="checkbox"
            title="Mark as needs attention"
            description="Mei gets a louder alert and must confirm she has read it."
          />
        </AppCard>

        <div class="d-flex flex-wrap gap-3">
          <AppButton @click="send">Send handover to Mei</AppButton>
          <AppButton variant="outline" @click="draft">Save draft</AppButton>
        </div>
      </div>

      <aside class="nt-col" aria-label="About this handover">
        <AppCard title="What happens next">
          <ol class="handover__steps">
            <li v-for="(s, i) in STEPS" :key="s.title">
              <StepMarker :n="i + 1" :state="i === 0 ? 'now' : 'todo'" />
              <div>
                <p class="handover__step-title">{{ s.title }}</p>
                <p class="handover__step-text">{{ s.text }}</p>
              </div>
            </li>
          </ol>
        </AppCard>
        <AppCard title="Yesterday’s handover">
          <p class="handover__step-title mb-0">Sent 5:58 PM, accepted by Mei 6:02 PM</p>
          <p class="handover__step-text mb-0">Note: Nap ran long, may want a later feed.</p>
        </AppCard>
        <p class="nt-muted mb-0" style="font-size: 0.8125rem">Handovers record what was logged. They are not medical advice.</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.handover__intro {
  font-size: 0.9375rem;
}
.handover__label {
  font-size: 0.9375rem;
  font-weight: 500;
}
.handover__list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9375rem;
}
.handover__list li {
  display: flex;
  gap: 10px;
  line-height: 22px;
}
.handover__add {
  display: flex;
  gap: 8px;
}
.handover__steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.handover__steps li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.handover__step-title {
  margin: 0 0 2px;
  font-size: 0.9375rem;
  font-weight: 500;
}
.handover__step-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 20px;
  color: var(--nt-muted);
}
</style>
