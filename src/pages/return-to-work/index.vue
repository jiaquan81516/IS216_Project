<script setup>
import { computed, ref } from "vue";
import AppLink from "@/components/ui/AppLink.vue";
import EntryPillTabs from "@/components/ui/EntryPillTabs.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import ProgressBar from "@/components/ui/ProgressBar.vue";
import { ROUTES } from "@/shared/constants/routes";
import { GROUPS, MILESTONES, createPlans, daysToGo, ownerLabel, shortDate } from "@/data/returnToWork";
import TaskRow from "./components/TaskRow.vue";
import TaskDetail from "./components/TaskDetail.vue";

defineOptions({ name: "return-to-workPage" });

const plans = ref(createPlans());
const tab = ref("you");
const selectedIds = ref({ you: "y-manager", mei: "m-pump-times" });

const plan = computed(() => plans.value[tab.value]);
const tabs = [
  { value: "mei", label: "Mei's plan" },
  { value: "you", label: "Your plan" },
];

const selectedTask = computed(
  () => plan.value.tasks.find((t) => t.id === selectedIds.value[tab.value]) ?? plan.value.tasks[0],
);
const groups = computed(() =>
  GROUPS.map((name) => ({ name, tasks: plan.value.tasks.filter((t) => t.group === name) })).filter((g) => g.tasks.length),
);
const total = computed(() => plan.value.tasks.length);
const done = computed(() => plan.value.tasks.filter((t) => t.done).length);
const percent = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0));
const leaveDays = computed(() => daysToGo());

function toggle(id) {
  const task = plan.value.tasks.find((t) => t.id === id);
  if (task) task.done = !task.done;
}
function select(id) {
  selectedIds.value[tab.value] = id;
}
function save(id, changes) {
  const task = plan.value.tasks.find((t) => t.id === id);
  if (task) Object.assign(task, changes);
}
const detail = (task) => `Due ${shortDate(task.due)}. ${ownerLabel(task.owner, tab.value)}`;
</script>

<template>
  <div class="nt-stack">
    <PageHeader title="Return to work" subtitle="Plan the first weeks back so nobody is guessing.">
      <EntryPillTabs v-model="tab" :tabs="tabs" aria-label="Whose plan" />
    </PageHeader>

    <section class="nt-card" aria-label="Countdown">
      <div class="d-flex flex-column gap-2">
        <p class="countdown__days mb-0">{{ leaveDays }} days to go</p>
        <p class="countdown__text mb-0">{{ plan.leaveText }} {{ done }} of {{ total }} tasks done.</p>
      </div>
      <ProgressBar :value="percent" />
      <ol class="milestones" aria-label="Milestones">
        <li v-for="m in MILESTONES" :key="m.label">
          <span class="milestones__label">{{ m.label }}</span>
          <span class="milestones__date">{{ m.date }}</span>
        </li>
      </ol>
    </section>

    <div class="nt-cols">
      <div class="nt-col">
        <section class="nt-card" aria-label="Tasks">
          <div v-for="g in groups" :key="g.name" class="group">
            <h2 class="group__title">{{ g.name }}</h2>
            <TaskRow
              v-for="task in g.tasks"
              :key="task.id"
              :task="task"
              :selected="task.id === selectedTask.id"
              :detail="detail(task)"
              @toggle="toggle"
              @select="select"
            />
            <AppLink v-if="g.name === 'Pumping'" :to="ROUTES.PUMPING" class="align-self-start nt-small">
              See rooms near Raffles Place
            </AppLink>
          </div>
        </section>
      </div>
      <div class="nt-col">
        <TaskDetail :task="selectedTask" :viewer="tab" @save="save" />
        <p class="nt-small nt-muted mb-0">
          Night wakings on workdays are set in the
          <AppLink :to="ROUTES.ROTA">sleep rotation</AppLink>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.countdown__days {
  font-family: var(--nt-serif);
  font-size: 2.25rem;
  line-height: 1.2;
}
.countdown__text {
  max-width: 420px;
  font-size: 0.9375rem;
  line-height: 1.45;
  color: var(--nt-muted);
}
.milestones {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px 24px;
  padding: 0;
  margin: 0;
  list-style: none;
}
.milestones li {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.milestones__label {
  font-size: 0.875rem;
  font-weight: 500;
}
.milestones__date {
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.group__title {
  margin: 0;
  font-family: var(--bs-body-font-family);
  font-size: 1rem;
  font-weight: 500;
}
</style>
