<script setup>
import "@/app/app.css";
import { computed, inject, nextTick, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import ChipGroup from "@/app/components/ChipGroup.vue";
import Icon from "@/app/components/Icon.vue";
import Tabs from "@/app/components/Tabs.vue";
import RtwPumping from "@/app/components/RtwPumping.vue";
import RtwResponsibilities from "@/app/components/RtwResponsibilities.vue";
import { dueText, groupTasks, ownerCounts, returnSentence, suggestedTasks } from "@/app/api/rtwHelpers";
import { isIsoDate, toIso } from "@/app/api/rotaHelpers";
import {
  describeSharedError,
  ownerKey as ownerKeyFor,
  ownerLabel,
  ownerUid,
  relativeTime,
  updatedLine,
} from "@/app/api/sharedHelpers";
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

const myFirst = computed(() => {
  const first = home?.me?.value?.firstName;
  return first ? displayName(first) : "";
});
const partnerFirst = computed(() => {
  const first = home?.partner?.value?.firstName;
  return first ? displayName(first) : "";
});
const partnerName = computed(() => partnerFirst.value || "Your partner");
const myUid = computed(() => home?.me?.value?.uid || store.meUid);
const partnerUid = computed(() => home?.partner?.value?.uid || store.partnerUid);
// An owner is a uid or "both" in Firestore, and a chip key inside the form.
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
  { id: "responsibilities", label: "Responsibilities" },
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
const categoryDescriptions = {
  childcare: "Care arrangements, trials and handovers.",
  work: "Workplace conversations and practical changes.",
  home: "Routines that keep work and home coordinated.",
  pumping: "Equipment, spaces and feeding preparation.",
  wellbeing: "Rest, recovery and support for both parents.",
};
const categorySummaries = computed(() =>
  TASK_GROUPS.map((group) => {
    const tasks = store.tasks.filter((task) => task.group === group.value);
    return {
      ...group,
      description: categoryDescriptions[group.value],
      total: tasks.length,
      complete: tasks.filter((task) => task.done).length,
    };
  }),
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
      <p class="rw__sub">A shared plan for getting ready, one step at a time. You both see the same plan.</p>
    </header>

    <Tabs v-model="tab" :tabs="TABS" label="Return to work sections" id-base="rtw" />

    <div aria-live="polite">
      <p v-if="loading" class="rw__muted">Loading the plan...</p>
    </div>

    <div v-if="!loading && errorInfo" class="rw__error alert alert-danger" role="alert">
      <p class="mb-0">{{ errorInfo.text }}</p>
      <p v-if="errorInfo.detail" class="rw__muted">{{ errorInfo.detail }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="retry">Try again</button>
    </div>

    <p v-if="store.writeError" class="app-error-text" role="alert">{{ store.writeError }}</p>

    <!-- Plan -->
    <div v-if="tab === 'plan' && !loading && !errorInfo" id="rtw-panel-plan" class="rw__plan" role="tabpanel" aria-labelledby="rtw-tab-plan">
      <div class="row g-4 align-items-stretch">
        <div class="col-xl-8">
          <section class="rw__roadmap h-100" aria-labelledby="rtw-roadmap-title">
            <div class="d-flex flex-wrap align-items-start justify-content-between gap-3">
              <div>
                <p class="rw__eyebrow">Your return roadmap</p>
                <h2 id="rtw-roadmap-title" class="nt-heading rw__roadmap-title rw__sentence">
                  {{ store.returnDate ? sentence : "Set the date that anchors your plan" }}
                </h2>
              </div>
              <span class="badge rw__ready">{{ completionPercent }}% ready</span>
            </div>

            <form v-if="showDateForm" class="rw__date-form" novalidate @submit.prevent="saveDate">
              <h3 class="rw__date-prompt">When do you go back?</h3>
              <div class="rw__date-row">
                <label class="rw__field">
                  <span class="rw__label">First day back at work</span>
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
              </div>
              <p v-if="dateError" id="rtw-date-error" class="app-error-text" role="alert">{{ dateError }}</p>
            </form>
            <div v-else class="d-flex flex-wrap align-items-center gap-3">
              <button type="button" class="app-textbtn" @click="startChangeDate">Change date</button>
              <span v-if="savedLine" class="rw__muted">{{ savedLine }}</span>
            </div>

            <div class="progress rw__progress" role="progressbar" aria-label="Return plan completion" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="completionPercent">
              <div class="progress-bar" :style="{ width: `${completionPercent}%` }"></div>
            </div>
            <p class="rw__muted">{{ completedCount }} of {{ store.tasks.length }} preparation tasks complete</p>

            <div class="row row-cols-1 row-cols-md-3 g-3">
              <div v-for="category in categorySummaries.slice(0, 3)" :key="category.value" class="col">
                <button type="button" class="rw__category h-100 w-100 text-start" @click="selectedGroup = category.value">
                  <span class="rw__category-label">{{ category.label }}</span>
                  <span>{{ category.description }}</span>
                  <strong>{{ category.complete }}/{{ category.total }} complete →</strong>
                </button>
              </div>
            </div>

            <div class="rw__next d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div><span>Next small step</span><strong>{{ nextTask ? nextTask.title : "Add your first preparation task" }}</strong></div>
              <button v-if="nextTask" type="button" class="btn btn-light btn-sm" @click="selectedGroup = nextTask.group">Open</button>
              <button v-else type="button" class="btn btn-light btn-sm" @click="openForm()">Start plan</button>
            </div>
          </section>
        </div>

        <div class="col-xl-4 d-flex flex-column gap-4">
          <section class="rw__side-panel" aria-labelledby="rtw-date-summary">
            <div class="d-flex align-items-center justify-content-between gap-3">
              <h2 id="rtw-date-summary" class="nt-heading nt-heading--sm">Key date</h2>
              <button v-if="store.returnDate" type="button" class="btn btn-outline btn-sm" @click="startChangeDate">Edit</button>
            </div>
            <div class="rw__key-date">
              <span>First day back</span>
              <strong>{{ store.returnDate ? sentence.split('.')[0].replace('Back at work on ', '') : "Not set" }}</strong>
              <small>{{ store.returnDate ? sentence.split('.')[1]?.trim() : "Add a date to build the countdown" }}</small>
            </div>
          </section>

          <section class="rw__side-panel flex-grow-1" aria-labelledby="rtw-change-title">
            <h2 id="rtw-change-title" class="nt-heading nt-heading--sm">When plans change</h2>
            <p class="rw__muted">Quick routes for moments when the original plan no longer works.</p>
            <nav class="rw__change-list" aria-label="Contingency support">
              <button type="button" @click="selectedGroup = 'childcare'"><span><strong>Childcare changed?</strong><small>Review childcare tasks</small></span><span aria-hidden="true">→</span></button>
              <RouterLink :to="ROUTES.WELLNESS"><span><strong>Someone is overwhelmed?</strong><small>Open a private check-in</small></span><span aria-hidden="true">→</span></RouterLink>
              <RouterLink :to="ROUTES.SUPPORT"><span><strong>Need a pumping space?</strong><small>Explore support resources</small></span><span aria-hidden="true">→</span></RouterLink>
            </nav>
          </section>
        </div>
      </div>

      <div class="d-flex flex-wrap gap-2" role="group" aria-label="Filter tasks by category">
        <button type="button" class="btn btn-outline btn-sm" :class="{ 'rw__filter--active': selectedGroup === 'all' }" @click="selectedGroup = 'all'">All tasks</button>
        <button v-for="category in categorySummaries" :key="category.value" type="button" class="btn btn-outline btn-sm" :class="{ 'rw__filter--active': selectedGroup === category.value }" @click="selectedGroup = category.value">
          {{ category.label }} · {{ category.complete }}/{{ category.total }}
        </button>
      </div>

      <section class="rw__steps" aria-labelledby="rtw-steps">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div><h2 id="rtw-steps" class="nt-heading nt-heading--sm">Preparation tasks</h2><p class="rw__muted mt-1">{{ countsText }}</p></div>
          <button v-if="!addOpen" type="button" class="btn btn-outline btn-sm" @click="openForm()"><Icon name="plus" :size="16" /> Add a task</button>
        </div>

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
                    <p class="rw__meta"><span class="app-badge">{{ ownerName(task.owner) }}</span><span>{{ groupLabel(task.group) }}</span><span v-if="task.due && !task.done" :class="{ 'rw__overdue': group.label === 'Overdue' }">{{ dueText(task.due, today) }}</span><span v-if="doneLine(task)">{{ doneLine(task) }}</span></p>
                  </div>
                </div>
                <div v-if="confirmingId === task.id" class="rw__confirm" role="group" :aria-label="`Delete ${task.title}`"><span class="rw__confirm-text">Delete this task?</span><button type="button" class="btn btn-outline btn-sm" @click="confirmDelete(task)">Delete</button><button type="button" class="btn btn-outline btn-sm" @click="confirmingId = ''">Cancel</button></div>
                <div v-else class="rw__actions"><button type="button" class="rw__icon" :aria-label="`Edit ${task.title}`" @click="openForm(task)"><Icon name="edit" :size="18" /></button><button type="button" class="rw__icon rw__icon--delete" :aria-label="`Delete ${task.title}`" @click="confirmingId = task.id"><Icon name="trash" :size="18" /></button></div>
              </li>
            </ul>
          </section>
        </template>
      </section>

      <section v-if="addOpen" class="rw__add" aria-label="Add a task">
        <form id="rtw-form" class="rw__form" novalidate @submit.prevent="submitForm">
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
          <div class="rw__field"><span class="rw__label">Group</span><ChipGroup v-model="form.group" :options="groupOptions" label="Group" /></div>
          <div class="rw__field"><span class="rw__label">Who does it</span><ChipGroup v-model="form.owner" :options="ownerOptions" label="Who does it" /></div>
          <label class="rw__field rw__field--narrow"><span class="rw__label">Due date (optional)</span><input v-model="form.due" class="app-control" type="date" /></label>
          <p v-if="formError" id="rtw-form-error" class="app-error-text" role="alert">{{ formError }}</p>
          <div class="rw__form-actions"><button type="submit" class="btn btn-primary btn-sm">{{ editId ? "Save task" : "Add task" }}</button><button type="button" class="btn btn-outline btn-sm" @click="closeForm">Cancel</button></div>
        </form>
      </section>

      <section v-if="suggestions.length" class="rw__suggest" aria-labelledby="rtw-suggestions">
        <h2 id="rtw-suggestions" class="nt-heading nt-heading--sm">Suggestions</h2>
        <ul class="rw__list">
          <li v-for="s in suggestions" :key="s.title" class="rw__task">
            <div class="rw__text">
              <p class="rw__task-title">{{ s.title }}</p>
              <p class="rw__meta">
                <span>{{ groupLabel(s.group) }}</span>
              </p>
            </div>
            <button type="button" class="btn btn-outline btn-sm" :aria-label="`Add ${s.title}`" @click="addSuggestion(s)">
              Add
            </button>
          </li>
        </ul>
      </section>
    </div>

    <div
      v-else-if="tab === 'responsibilities' && !loading && !errorInfo"
      id="rtw-panel-responsibilities"
      role="tabpanel"
      aria-labelledby="rtw-tab-responsibilities"
    >
      <RtwResponsibilities
        :my-name="myFirst"
        :partner-name="partnerFirst"
        :me-uid="myUid"
        :partner-uid="partnerUid"
      />
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
.rw { display: flex; flex-direction: column; gap: 24px; max-width: 1120px; margin: 0 auto; font-size: 1rem; }
.rw__head { display: flex; flex-direction: column; gap: 8px; }
.rw__title { font-size: 2.5rem; line-height: 1.2; }
.rw__sub { margin: 0; font-size: 1rem; color: var(--nt-muted); }
.rw__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }

.rw__error { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: 720px; }
.rw__plan { display: flex; flex-direction: column; gap: 32px; }
.rw__roadmap, .rw__side-panel { padding: 24px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: var(--bs-border-radius-lg); }
.rw__roadmap { display: flex; flex-direction: column; gap: 20px; background: linear-gradient(135deg, #fff 55%, #f2f8f6); }
.rw__eyebrow { margin: 0 0 6px; color: var(--nt-muted); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.rw__roadmap-title { max-width: 620px; font-size: 1.75rem; }
.rw__ready { padding: 7px 10px; background: #dfeee8; color: #356858; font-weight: 600; }
.rw__progress { height: 8px; background: #e9efec; }
.rw__progress .progress-bar { background: #8bbdaf; }
.rw__category { display: flex; flex-direction: column; gap: 8px; padding: 18px; background: #fff; border: 1px solid var(--nt-line); border-radius: 8px; color: var(--nt-muted); font: inherit; }
.rw__category:hover { border-color: var(--nt-apricot-d); }
.rw__category:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.rw__category-label { color: var(--nt-ink); font-weight: 700; }
.rw__category strong { margin-top: auto; color: var(--nt-ink); font-size: 0.875rem; }
.rw__next { padding: 14px 16px; background: var(--nt-plum); color: #fff; border-radius: 8px; }
.rw__next div { display: flex; flex-direction: column; }
.rw__next span { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.rw__side-panel { display: flex; flex-direction: column; gap: 16px; }
.rw__side-panel h2 { margin: 0; }
.rw__key-date { display: flex; flex-direction: column; gap: 3px; padding: 16px; background: #f4ece3; border-radius: 8px; }
.rw__key-date span, .rw__key-date small { color: var(--nt-muted); font-size: 0.875rem; }
.rw__key-date strong { font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 400; }
.rw__change-list { display: flex; flex-direction: column; border-top: 1px solid var(--nt-line); }
.rw__change-list a, .rw__change-list button { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 14px 0; background: transparent; border: 0; border-bottom: 1px solid var(--nt-line); color: var(--nt-ink); font: inherit; text-align: left; text-decoration: none; }
.rw__change-list a:hover, .rw__change-list button:hover { color: var(--nt-plum); }
.rw__change-list a:focus-visible, .rw__change-list button:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.rw__change-list span:first-child { display: flex; flex-direction: column; gap: 2px; }
.rw__change-list small { color: var(--nt-muted); }
.rw__filter--active { background: var(--nt-plum); border-color: var(--nt-plum); color: #fff; }
.rw__filter--active:hover { background: var(--nt-plum-hover); border-color: var(--nt-plum-hover); color: #fff; }

.rw__date-form { display: flex; flex-direction: column; gap: 12px; }
.rw__date-prompt { margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--nt-ink); }
.rw__date-title { margin: 0; }
.rw__date-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 16px; }
.rw__date-input { width: 220px; }
.rw__date-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 16px; }
.rw__sentence { margin: 0; font-family: var(--nt-serif); line-height: 1.3; letter-spacing: -0.01em; color: var(--nt-ink); }

.rw__steps { display: flex; flex-direction: column; gap: 12px; }
.rw__steps h2, .rw__suggest h2 { margin: 0; }
.rw__group { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.rw__group-title { margin: 0; font-family: inherit; font-size: 0.9375rem; font-weight: 600; color: var(--nt-ink); }
.rw__list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.rw__task { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 14px 0; border-bottom: 1px solid var(--nt-line); }
.rw__main { display: flex; align-items: flex-start; gap: 12px; min-width: 0; flex: 1 1 320px; }
.rw__check { flex: none; width: 20px; height: 20px; margin: 2px 0 0; cursor: pointer; }
.rw__check:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.rw__text { min-width: 0; }
.rw__task-title { display: block; margin: 0; font-size: 1rem; font-weight: 500; color: var(--nt-ink); cursor: pointer; }
.rw__task-title--done { color: var(--nt-muted); text-decoration: line-through; }
.rw__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin: 4px 0 0; font-size: 0.875rem; color: var(--nt-muted); }
.rw__overdue { color: var(--nt-coral); font-weight: 500; }
.rw__actions { display: flex; align-items: center; gap: 4px; }
.rw__icon { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; background: transparent; border: 0; border-radius: 8px; color: var(--nt-muted); cursor: pointer; transition: background-color 0.15s, color 0.15s; }
.rw__icon:hover { background: var(--nt-gray); color: var(--nt-ink); }
.rw__icon--delete:hover { color: var(--nt-coral); }
.rw__icon:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.rw__confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.rw__confirm-text { font-size: 0.875rem; color: var(--nt-ink); }

.rw__add { display: flex; flex-direction: column; align-items: flex-start; }
.rw__add-btn { display: inline-flex; align-items: center; gap: 8px; }
.rw__form { display: flex; flex-direction: column; gap: 16px; width: 100%; padding: 16px 0; border-top: 1px solid var(--nt-line); border-bottom: 1px solid var(--nt-line); }
.rw__field { display: flex; flex-direction: column; gap: 8px; }
.rw__field--narrow { max-width: 220px; }
.rw__label { font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.rw__form-actions { display: flex; flex-wrap: wrap; gap: 8px; }

.rw__suggest { display: flex; flex-direction: column; gap: 12px; }

@media (max-width: 767px) {
  .rw__title { font-size: 2rem; }
  .rw__date-input { width: 100%; }
}
</style>
