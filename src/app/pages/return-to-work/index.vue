<script setup>
import "@/app/app.css";
import { computed, inject, nextTick, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import Icon from "@/app/components/Icon.vue";
import Tabs from "@/app/components/Tabs.vue";
import RtwPumping from "@/app/components/RtwPumping.vue";
import { dueText, daysUntil, groupTasks, ownerCounts, returnSentence, suggestedTasks } from "@/app/utils/rtwHelpers";
import { isIsoDate, toIso } from "@/app/utils/rotaHelpers";
import {
  describeSharedError,
  ownerKey as ownerKeyFor,
  ownerLabel,
  ownerUid,
  relativeTime,
  updatedLine,
} from "@/app/utils/sharedHelpers";
import { TASK_GROUPS } from "@/app/data/rtw";
import { displayName, HOME_KEY } from "@/app/composables/useHome";
import { SHARED_KEY } from "@/app/composables/useShared";
import { useReturnToWorkStore } from "@/app/stores/returnToWork";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "ReturnToWorkPage" });

// The layout provides the household and the bound stores; only first names are needed here.
const home = inject(HOME_KEY, null);
const shared = inject(SHARED_KEY, null);
const store = useReturnToWorkStore();

const partnerFirst = computed(() => {
  const first = home?.partner?.value?.firstName;
  return first ? displayName(first) : "";
});
const partnerName = computed(() => partnerFirst.value || "Your partner");
const myUid = computed(() => home?.me?.value?.uid || store.meUid);
const partnerUid = computed(() => home?.partner?.value?.uid || store.partnerUid);
// An owner is a uid or "both" in Firestore, and a select value inside the form.
const ownerName = (owner) => ownerLabel(owner, myUid.value, "Me", partnerName.value);
const toOwnerUid = (key) => ownerUid(key, myUid.value, partnerUid.value) ?? "both";
const doneLine = (task) => {
  if (!task.done) return "";
  const who = ownerLabel(task.doneBy, myUid.value, "you", partnerName.value);
  const when = relativeTime(task.doneAt);
  if (!who) return "";
  return when ? `Done by ${who} ${when}` : `Done by ${who}`;
};

// Shared data state. The page waits for the household id, so it never shows an error first.
const householdId = computed(() => home?.householdId?.value ?? store.householdId);
const loading = computed(() => !householdId.value || store.loading);
const errorInfo = computed(() => (store.error ? describeSharedError(store.error.code, "plan") : null));
function retry() {
  shared?.retry();
}
const savedLine = computed(() =>
  updatedLine(
    { updatedAt: store.updatedAt, updatedBy: store.updatedBy },
    myUid.value,
    "you",
    partnerName.value,
    new Date(),
  ),
);

const TABS = [
  { id: "plan", label: "Plan" },
  { id: "pumping", label: "Pumping preparation" },
];
const tab = ref("plan");

const today = toIso(new Date());

// Return date
const editingDate = ref(false);
const dateDraft = ref(store.returnDate || "");
const dateError = ref("");
const showDateForm = computed(() => !store.returnDate || editingDate.value);
const sentence = computed(() => returnSentence(store.returnDate, today));
const daysToGo = computed(() => (store.returnDate ? daysUntil(store.returnDate, today) : null));

function startChangeDate() {
  dateDraft.value = store.returnDate || "";
  dateError.value = "";
  editingDate.value = true;
}
async function saveDate() {
  if (!isIsoDate(dateDraft.value)) {
    dateError.value = "Choose the day you go back to work.";
    return;
  }
  const ok = await store.setReturnDate(dateDraft.value);
  if (!ok) return;
  dateError.value = "";
  editingDate.value = false;
}
function cancelChangeDate() {
  editingDate.value = false;
  dateError.value = "";
}

// Task list
const groups = computed(() => groupTasks(store.tasks, today));
const completedCount = computed(() => store.tasks.filter((task) => task.done).length);
const completionPercent = computed(() =>
  store.tasks.length ? Math.round((completedCount.value / store.tasks.length) * 100) : 0,
);
const nextTask = computed(() => groups.value.flatMap((group) => group.tasks).find((task) => !task.done) ?? null);
const selectedGroup = ref("all");
// Childcare, Work and Home always show. Other categories show once they have a task.
const categorySummaries = computed(() =>
  TASK_GROUPS.map((group) => {
    const tasks = store.tasks.filter((task) => task.group === group.value);
    return { ...group, total: tasks.length, complete: tasks.filter((task) => task.done).length };
  }).filter((group, index) => index < 3 || group.total > 0),
);
const visibleGroups = computed(() => {
  if (selectedGroup.value === "all") return groups.value;
  return groups.value
    .map((group) => ({ ...group, tasks: group.tasks.filter((task) => task.group === selectedGroup.value) }))
    .filter((group) => group.tasks.length);
});
const counts = computed(() => ownerCounts(store.tasks, myUid.value));
const countsText = computed(
  () => `Open tasks: Me ${counts.value.me}, ${partnerName.value} ${counts.value.partner}, both ${counts.value.both}.`,
);
const groupLabel = (value) => TASK_GROUPS.find((g) => g.value === value)?.label ?? "";
const suggestions = computed(() => suggestedTasks(store.tasks.map((t) => t.title)));

// Delete with inline confirm
const confirmingId = ref("");

// Add and edit form
const addOpen = ref(false);
const editId = ref("");
const form = reactive({ title: "", group: "home", owner: "both", due: "" });
const formError = ref("");
const titleInput = ref(null);

const ownerKeyOf = (owner) => ownerKeyFor(owner, myUid.value);
const ownerOptions = computed(() => [
  { value: "me", label: "Me" },
  { value: "partner", label: partnerName.value },
  { value: "both", label: "Both" },
]);
const groupOptions = TASK_GROUPS.map((g) => ({ value: g.value, label: g.label }));

async function openForm(task = null) {
  confirmingId.value = "";
  formError.value = "";
  editId.value = task?.id ?? "";
  form.title = task?.title ?? "";
  form.group = task?.group ?? "home";
  form.owner = task ? (ownerKeyOf(task.owner) ?? "both") : "both";
  form.due = task?.due ?? "";
  addOpen.value = true;
  await nextTick();
  titleInput.value?.focus();
}
function closeForm() {
  addOpen.value = false;
  editId.value = "";
  formError.value = "";
}
function submitForm() {
  const title = form.title.trim();
  if (!title) {
    formError.value = "Add a title for the task.";
    return;
  }
  const payload = {
    title,
    group: form.group,
    owner: toOwnerUid(form.owner),
    due: isIsoDate(form.due) ? form.due : null,
  };
  if (editId.value) store.updateTask(editId.value, payload);
  else store.addTask(payload);
  closeForm();
}
function addSuggestion(suggestion) {
  store.addTask({ title: suggestion.title, group: suggestion.group, owner: "both", due: null });
}
function confirmDelete(task) {
  store.removeTask(task.id);
  confirmingId.value = "";
  if (editId.value === task.id) closeForm();
}
</script>

<template>
  <div class="rw">
    <header class="rw__head">
      <h1 class="nt-title rw__title">Return to work</h1>
      <p class="rw__sub">A shared plan for getting ready. You both see the same plan.</p>
    </header>

    <Tabs v-model="tab" :tabs="TABS" label="Return to work sections" id-base="rtw" />

    <div aria-live="polite">
      <p v-if="loading" class="rw__muted">Loading the plan...</p>
    </div>

    <div v-if="!loading && errorInfo" class="rw__error alert alert-danger" role="alert">
      <p class="mb-0">{{ errorInfo.text }}</p>
      <p v-if="errorInfo.detail" class="rw__muted">{{ errorInfo.detail }}</p>
      <button type="button" class="app-textbtn" @click="retry">Try again</button>
    </div>

    <p v-if="store.writeError" class="app-error-text" role="alert">{{ store.writeError }}</p>

    <!-- Plan -->
    <div v-if="tab === 'plan' && !loading && !errorInfo" id="rtw-panel-plan" class="rw__plan" role="tabpanel" aria-labelledby="rtw-tab-plan">
      <div class="rw__main-col">
        <section class="rw__card rw__date" aria-labelledby="rtw-roadmap-title">
          <div class="rw__card-head">
            <span class="rw__tile rw__tile--apricot" aria-hidden="true"><Icon name="calendar" :size="18" /></span>
            <h2 id="rtw-roadmap-title" class="rw__h2">Return plan</h2>
          </div>
          <p class="rw__sentence">{{ store.returnDate ? sentence : "When do you go back?" }}</p>

          <form v-if="showDateForm" class="rw__date-row" novalidate @submit.prevent="saveDate">
            <label class="rw__field">
              <span class="rw__label">First day back</span>
              <input
                v-model="dateDraft"
                class="app-control rw__date-input"
                type="date"
                :aria-invalid="dateError ? 'true' : undefined"
                :aria-describedby="dateError ? 'rtw-date-error' : undefined"
              />
            </label>
            <button type="submit" class="btn btn-sm" :class="addOpen ? 'btn-outline' : 'btn-primary'">Save date</button>
            <button v-if="store.returnDate" type="button" class="app-textbtn" @click="cancelChangeDate">Cancel</button>
            <p v-if="dateError" id="rtw-date-error" class="app-error-text rw__full" role="alert">{{ dateError }}</p>
          </form>
          <p v-else class="rw__line">
            <button type="button" class="app-textbtn" @click="startChangeDate">Change date</button>
            <span v-if="savedLine" class="rw__muted">{{ savedLine }}</span>
          </p>

          <div class="rw__block">
            <div class="rw__progress" role="progressbar" aria-label="Return plan completion" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="completionPercent">
              <div class="rw__progress-bar" :style="{ width: `${completionPercent}%` }"></div>
            </div>
            <p class="rw__muted">{{ completedCount }} of {{ store.tasks.length }} preparation tasks complete</p>
          </div>

          <div class="rw__filters" role="group" aria-label="Filter tasks by category">
            <button type="button" class="rw__filter" :aria-pressed="selectedGroup === 'all' ? 'true' : 'false'" @click="selectedGroup = 'all'">All tasks</button>
            <button v-for="category in categorySummaries" :key="category.value" type="button" class="rw__filter" :aria-pressed="selectedGroup === category.value ? 'true' : 'false'" @click="selectedGroup = category.value">
              {{ category.label }} {{ category.complete }}/{{ category.total }}
            </button>
          </div>

          <p class="rw__next">
            <template v-if="nextTask">
              <span class="rw__next-text">Next: {{ nextTask.title }}</span>
              <button type="button" class="app-textbtn" @click="selectedGroup = nextTask.group">Open</button>
            </template>
            <template v-else>
              <span class="rw__next-text">Add your first preparation task</span>
              <button type="button" class="app-textbtn" @click="openForm()">Start plan</button>
            </template>
          </p>
        </section>

        <section class="rw__card rw__steps" aria-labelledby="rtw-steps">
          <div class="rw__steps-head">
            <div>
              <h2 id="rtw-steps" class="rw__h2">Preparation tasks</h2>
              <p class="rw__muted">{{ countsText }}</p>
            </div>
            <button v-if="!addOpen" type="button" class="app-textbtn rw__add-link" @click="openForm()"><Icon name="plus" :size="16" /> Add a task</button>
          </div>

          <form v-if="addOpen" id="rtw-form" class="rw__form" novalidate aria-label="Add a task" @submit.prevent="submitForm">
            <h3 class="rw__group-title">{{ editId ? "Edit task" : "Add a task" }}</h3>
            <label class="rw__field">
              <span class="rw__label">Task</span>
              <input
                ref="titleInput"
                v-model="form.title"
                class="app-control"
                type="text"
                maxlength="80"
                autocomplete="off"
                :aria-invalid="formError ? 'true' : undefined"
                :aria-describedby="formError ? 'rtw-form-error' : undefined"
              />
            </label>
            <div class="rw__form-row">
              <label class="rw__field">
                <span class="rw__label">Group</span>
                <select v-model="form.group" class="app-control">
                  <option v-for="o in groupOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
              </label>
              <label class="rw__field">
                <span class="rw__label">Who does it</span>
                <select v-model="form.owner" class="app-control">
                  <option v-for="o in ownerOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
              </label>
              <label class="rw__field"><span class="rw__label">Due date (optional)</span><input v-model="form.due" class="app-control" type="date" /></label>
            </div>
            <p v-if="formError" id="rtw-form-error" class="app-error-text" role="alert">{{ formError }}</p>
            <div class="rw__form-actions"><button type="submit" class="btn btn-primary btn-sm">{{ editId ? "Save task" : "Add task" }}</button><button type="button" class="app-textbtn" @click="closeForm">Cancel</button></div>
          </form>

          <p v-if="!store.tasks.length" class="rw__muted">No tasks yet. Add one or start from the suggestions below.</p>
          <p v-else-if="!visibleGroups.length" class="rw__muted">No tasks in this category yet.</p>

          <template v-else>
            <section v-for="group in visibleGroups" :key="group.label" class="rw__group" :aria-labelledby="`rtw-group-${group.label.replace(/\s+/g, '-').toLowerCase()}`">
              <h3 :id="`rtw-group-${group.label.replace(/\s+/g, '-').toLowerCase()}`" class="rw__group-title">{{ group.label }}</h3>
              <ul class="rw__list">
                <li v-for="task in group.tasks" :key="task.id" class="rw__task" :data-task="task.id">
                  <div class="rw__main">
                    <input :id="`rtw-task-${task.id}`" class="form-check-input rw__check" type="checkbox" :checked="task.done" @change="store.toggleTask(task.id)" />
                    <div class="rw__text">
                      <label :for="`rtw-task-${task.id}`" class="rw__task-title" :class="{ 'rw__task-title--done': task.done }">{{ task.title }}</label>
                      <p class="rw__meta"><span class="rw__owner">{{ ownerName(task.owner) }}</span><span>{{ groupLabel(task.group) }}</span><span v-if="task.due && !task.done" :class="{ 'rw__overdue': group.label === 'Overdue' }">{{ dueText(task.due, today) }}</span><span v-if="doneLine(task)">{{ doneLine(task) }}</span></p>
                    </div>
                  </div>
                  <div v-if="confirmingId === task.id" class="rw__confirm" role="group" :aria-label="`Delete ${task.title}`"><span class="rw__confirm-text">Delete this task?</span><button type="button" class="app-textbtn" @click="confirmDelete(task)">Delete</button><button type="button" class="app-textbtn" @click="confirmingId = ''">Cancel</button></div>
                  <div v-else class="rw__actions"><button type="button" class="rw__icon" :aria-label="`Edit ${task.title}`" @click="openForm(task)"><Icon name="edit" :size="18" /></button><button type="button" class="rw__icon rw__icon--delete" :aria-label="`Delete ${task.title}`" @click="confirmingId = task.id"><Icon name="trash" :size="18" /></button></div>
                </li>
              </ul>
            </section>
          </template>
        </section>

        <section v-if="suggestions.length" class="rw__card rw__suggest" aria-labelledby="rtw-suggestions">
          <h2 id="rtw-suggestions" class="rw__h2">Suggestions</h2>
          <ul class="rw__list">
            <li v-for="s in suggestions" :key="s.title" class="rw__task">
              <div class="rw__text">
                <p class="rw__task-title">{{ s.title }}</p>
                <p class="rw__meta">
                  <span>{{ groupLabel(s.group) }}</span>
                </p>
              </div>
              <button type="button" class="app-textbtn" :aria-label="`Add ${s.title}`" @click="addSuggestion(s)">
                Add
              </button>
            </li>
          </ul>
        </section>
      </div>

      <aside class="rw__rail" aria-label="Countdown and support">
        <section class="rw__card rw__count" aria-labelledby="rtw-count-title">
          <div class="rw__card-head">
            <span class="rw__tile rw__tile--powder" aria-hidden="true"><Icon name="clock" :size="18" /></span>
            <h2 id="rtw-count-title" class="rw__h2">Countdown</h2>
          </div>
          <template v-if="daysToGo !== null && daysToGo > 0">
            <p class="rw__big">{{ daysToGo }}</p>
            <p class="rw__muted">{{ daysToGo === 1 ? "day" : "days" }} until your first day back</p>
          </template>
          <p v-else-if="daysToGo === 0" class="rw__count-text">Your first day back is today.</p>
          <p v-else-if="daysToGo !== null" class="rw__count-text">You are back at work. Keep the plan up to date as things settle.</p>
          <p v-else class="rw__count-text">Choose your first day back and the days to go show here.</p>
        </section>

        <section class="rw__card rw__change" aria-labelledby="rtw-change-title">
          <h2 id="rtw-change-title" class="rw__h2">When plans change</h2>
          <nav class="rw__change-list" aria-label="Contingency support">
            <button type="button" class="rw__row" @click="selectedGroup = 'childcare'">
              <Icon name="home" :size="20" class="rw__row-icon" /><span class="rw__row-text">Childcare changed? Review childcare tasks</span><Icon name="chevron" :size="16" class="rw__row-go" />
            </button>
            <RouterLink class="rw__row" :to="ROUTES.WELLNESS">
              <Icon name="heart" :size="20" class="rw__row-icon" /><span class="rw__row-text">Someone is overwhelmed? Open a check-in</span><Icon name="chevron" :size="16" class="rw__row-go" />
            </RouterLink>
            <RouterLink class="rw__row" :to="ROUTES.SUPPORT">
              <Icon name="lifebuoy" :size="20" class="rw__row-icon" /><span class="rw__row-text">Need a pumping space? Find support</span><Icon name="chevron" :size="16" class="rw__row-go" />
            </RouterLink>
          </nav>
        </section>
      </aside>
    </div>

    <div
      v-else-if="tab === 'pumping' && !loading && !errorInfo"
      id="rtw-panel-pumping"
      role="tabpanel"
      aria-labelledby="rtw-tab-pumping"
    >
      <RtwPumping />
    </div>
  </div>
</template>

<style scoped>
.rw { display: flex; flex-direction: column; gap: 24px; width: 100%; font-size: 1rem; }
.rw__head { display: flex; flex-direction: column; gap: 8px; }
.rw__title { font-size: 2.5rem; line-height: 1.2; }
.rw__sub { margin: 0; font-size: 1rem; color: var(--nt-muted); }
.rw__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.rw__h2 { margin: 0; font-family: inherit; font-size: 1.0625rem; font-weight: 600; color: var(--nt-ink); }

.rw__error { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: 720px; }
.rw__plan { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; align-items: start; }
.rw__main-col, .rw__rail { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
@media (min-width: 1100px) {
  .rw__plan { grid-template-columns: minmax(0, 1fr) 360px; }
  .rw__rail { position: sticky; top: 24px; }
}

.rw__card { display: flex; flex-direction: column; gap: 16px; padding: 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.rw__card-head { display: flex; align-items: center; gap: 12px; }
.rw__tile { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; color: var(--nt-plum); }
.rw__tile--apricot { background: var(--nt-apricot); }
.rw__tile--powder { background: var(--nt-powder); }

.rw__sentence { margin: 0; font-family: var(--nt-serif); font-size: 1.75rem; font-weight: 400; line-height: 1.3; letter-spacing: -0.01em; color: var(--nt-ink); }
.rw__date-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 20px; }
.rw__date-input { width: 220px; }
.rw__full { flex-basis: 100%; }
.rw__line { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 20px; margin: 0; }
.rw__block { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid var(--nt-line); }
.rw__progress { width: 100%; height: 8px; overflow: hidden; background: var(--nt-line); border-radius: 999px; }
.rw__progress-bar { height: 100%; background: var(--nt-plum); border-radius: 999px; transition: width 0.3s; }
.rw__next { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 16px; margin: 0; padding-top: 16px; border-top: 1px solid var(--nt-line); color: var(--nt-ink); }
.rw__next-text { font-size: 1rem; font-weight: 500; }

.rw__big { margin: 0; font-family: var(--nt-serif); font-size: 3rem; line-height: 1; color: var(--nt-plum); }
.rw__count-text { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: var(--nt-muted); }
.rw__count { background: var(--nt-bg); }

.rw__change-list { display: flex; flex-direction: column; border-top: 1px solid var(--nt-line); }
.rw__row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 0; background: none; border: 0; border-bottom: 1px solid var(--nt-line); font: inherit; font-size: 0.9375rem; line-height: 1.4; text-align: left; text-decoration: none; color: var(--nt-ink); cursor: pointer; }
.rw__change-list > .rw__row:last-child { border-bottom: 0; padding-bottom: 0; }
.rw__row:hover .rw__row-text { text-decoration: underline; }
.rw__row:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
.rw__row-icon { flex: none; color: var(--nt-muted); }
.rw__row-text { flex: 1; min-width: 0; }
.rw__row-go { flex: none; color: var(--nt-muted); }

.rw__steps-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 8px 16px; }
.rw__add-link { display: inline-flex; align-items: center; gap: 6px; }
.rw__filters { display: flex; flex-wrap: nowrap; gap: 8px; padding-top: 16px; border-top: 1px solid var(--nt-line); overflow-x: auto; overflow-y: hidden; }
.rw__filter { flex: none; padding: 6px 14px; background: #fff; border: 1px solid var(--nt-line); border-radius: 999px; font: inherit; font-size: 0.875rem; color: var(--nt-muted); white-space: nowrap; cursor: pointer; }
.rw__filter:hover { border-color: var(--nt-muted); color: var(--nt-ink); }
.rw__filter[aria-pressed="true"] { background: var(--nt-plum); border-color: var(--nt-plum); color: #fff; font-weight: 500; }
.rw__filter:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.rw__group { display: flex; flex-direction: column; gap: 4px; }
.rw__group-title { margin: 0; font-family: inherit; font-size: 0.9375rem; font-weight: 600; color: var(--nt-ink); }
.rw__list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.rw__task { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 16px 0; border-bottom: 1px solid var(--nt-line); }
.rw__list > .rw__task:last-child { border-bottom: 0; }
.rw__main { display: flex; align-items: flex-start; gap: 12px; min-width: 0; flex: 1 1 320px; }
.rw__check { flex: none; width: 20px; height: 20px; margin: 2px 0 0; cursor: pointer; }
.rw__check:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.rw__text { min-width: 0; }
.rw__task-title { display: block; margin: 0; font-size: 1rem; font-weight: 600; color: var(--nt-ink); cursor: pointer; }
.rw__task-title--done { color: var(--nt-muted); text-decoration: line-through; }
.rw__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin: 4px 0 0; font-size: 0.875rem; color: var(--nt-muted); }
.rw__meta > span:not(:first-child) { padding: 1px 8px; background: var(--nt-gray); border-radius: 999px; font-size: 0.8125rem; }
.rw__owner { color: var(--nt-ink); }
.rw__overdue { color: var(--nt-coral); font-weight: 500; }
.rw__actions { display: flex; align-items: center; gap: 4px; }
.rw__icon { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; background: transparent; border: 0; border-radius: 8px; color: var(--nt-muted); cursor: pointer; }
.rw__icon:hover { background: var(--nt-gray); color: var(--nt-ink); }
.rw__icon--delete:hover { color: var(--nt-coral); }
.rw__icon:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.rw__confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.rw__confirm-text { font-size: 0.875rem; color: var(--nt-ink); }

.rw__form { display: flex; flex-direction: column; gap: 16px; padding: 16px 0; border-top: 1px solid var(--nt-line); border-bottom: 1px solid var(--nt-line); }
.rw__form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.rw__field { display: flex; flex-direction: column; gap: 8px; }
.rw__label { font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.rw__form-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; }

@media (max-width: 767px) {
  .rw__title { font-size: 2rem; }
  .rw__date-input { width: 100%; }
  .rw__card { padding: 20px; }
}
</style>