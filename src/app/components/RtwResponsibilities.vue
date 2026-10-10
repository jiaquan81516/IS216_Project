<script setup>
import "@/app/app.css";
import { computed } from "vue";
import ChipGroup from "@/app/components/ChipGroup.vue";
import { balanceHint, responsibilityCounts, responsibilitySummary } from "@/app/api/rtwHelpers";
import { ownerKey, ownerUid } from "@/app/api/sharedHelpers";
import { RESPONSIBILITY_AREAS } from "@/app/data/rtw";
import { useReturnToWorkStore } from "@/app/stores/returnToWork";

defineOptions({ name: "RtwResponsibilities" });

// myName and partnerName are first names from the household, or empty when unknown.
// meUid and partnerUid turn a chip choice into the uid that Firestore stores.
const props = defineProps({
  myName: { type: String, default: "" },
  partnerName: { type: String, default: "" },
  meUid: { type: String, default: "" },
  partnerUid: { type: String, default: "" },
});

const store = useReturnToWorkStore();

const partnerLabel = computed(() => props.partnerName || "Your partner");
const options = computed(() => [
  { value: "me", label: "Me" },
  { value: "partner", label: partnerLabel.value },
  { value: "both", label: "Both" },
  { value: "none", label: "Not decided" },
]);

const counts = computed(() => responsibilityCounts(store.responsibilities, props.meUid));
const chosen = (key) => ownerKey(store.responsibilities[key], props.meUid) || "none";
const summary = computed(() => responsibilitySummary(counts.value, partnerLabel.value));
const hint = computed(() =>
  balanceHint(counts.value, { me: props.myName || "You", partner: props.partnerName || "Your partner" }),
);

const taskTitles = computed(() => new Set(store.tasks.map((t) => t.title.trim().toLowerCase())));
const hasTask = (area) => taskTitles.value.has(area.task.toLowerCase());

function choose(area, value) {
  store.setResponsibility(area.key, value === "none" ? null : ownerUid(value, props.meUid, props.partnerUid));
}
function makeTask(area) {
  if (hasTask(area)) return;
  store.addTask({
    title: area.task,
    group: area.group,
    owner: store.responsibilities[area.key] || "both",
  });
}
</script>

<template>
  <div class="rtr">
    <p class="rtr__intro">Who covers what once you are both back at work.</p>

    <ul class="rtr__list" aria-label="Areas to share">
      <li v-for="area in RESPONSIBILITY_AREAS" :key="area.key" class="rtr__row" :data-area="area.key">
        <div class="rtr__text">
          <h2 :id="`rtr-${area.key}`" class="rtr__title">{{ area.title }}</h2>
          <p class="rtr__desc">{{ area.description }}</p>
        </div>
        <div class="rtr__controls">
          <ChipGroup
            :model-value="chosen(area.key)"
            :options="options"
            :label="`Who covers: ${area.title}`"
            @update:model-value="(value) => choose(area, value)"
          />
          <button
            type="button"
            class="btn btn-outline btn-sm rtr__make"
            :disabled="hasTask(area)"
            :aria-label="hasTask(area) ? `Task added for ${area.title}` : `Make a task for ${area.title}`"
            @click="makeTask(area)"
          >
            {{ hasTask(area) ? "Task added" : "Make a task" }}
          </button>
        </div>
      </li>
    </ul>

    <p class="rtr__summary" role="status">{{ summary }}</p>
    <p v-if="hint" class="rtr__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.rtr { display: flex; flex-direction: column; gap: 16px; max-width: 820px; }
.rtr__intro { margin: 0; font-size: 1rem; color: var(--nt-muted); }
.rtr__list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.rtr__row { display: grid; grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: 12px 24px; align-items: start; padding: 16px 0; border-bottom: 1px solid var(--nt-line); }
.rtr__title { margin: 0; font-family: inherit; font-size: 1rem; font-weight: 600; color: var(--nt-ink); letter-spacing: 0; }
.rtr__desc { margin: 2px 0 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.rtr__controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; }
.rtr__make { white-space: nowrap; }
.rtr__summary { margin: 0; font-size: 1rem; font-weight: 500; color: var(--nt-ink); }
.rtr__hint { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }

@media (max-width: 767px) {
  .rtr__row { grid-template-columns: minmax(0, 1fr); }
}
</style>
