<script setup>
import "@/v3/v3.css";
import { computed, inject, nextTick, reactive, ref } from "vue";
import V3ChipGroup from "@/v3/components/V3ChipGroup.vue";
import V3Icon from "@/v3/components/V3Icon.vue";
import V3Tabs from "@/v3/components/V3Tabs.vue";
import RtwPumping from "@/v3/components/RtwPumping.vue";
import RtwResponsibilities from "@/v3/components/RtwResponsibilities.vue";
import { dueText, groupTasks, ownerCounts, returnSentence, suggestedTasks } from "@/v3/api/rtwHelpers";
import { isIsoDate, toIso } from "@/v3/api/rotaHelpers";
import {
  describeSharedError,
  ownerKey as ownerKeyFor,
  ownerLabel,
  ownerUid,
  relativeTime,
  updatedLine,
} from "@/v3/api/sharedHelpers";
import { TASK_GROUPS } from "@/v3/data/rtw";
import { displayName, V3_HOME_KEY } from "@/v3/composables/useV3Home";
import { V3_SHARED_KEY } from "@/v3/composables/useV3Shared";
import { useReturnToWorkStore } from "@/v3/stores/returnToWork";

defineOptions({ name: "V3ReturnToWorkPage" });

// The layout provides the household and the bound stores; only first names are needed here.
const home = inject(V3_HOME_KEY, null);
const shared = inject(V3_SHARED_KEY, null);
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

    <V3Tabs v-model="tab" :tabs="TABS" label="Return to work sections" id-base="rtw" />

    <div aria-live="polite">
      <p v-if="loading" class="rw__muted">Loading the plan...</p>
    </div>

    <div v-if="!loading && errorInfo" class="rw__error alert alert-danger" role="alert">
      <p class="mb-0">{{ errorInfo.text }}</p>
      <p v-if="errorInfo.detail" class="rw__muted">{{ errorInfo.detail }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="retry">Try again</button>
    </div>

    <p v-if="store.writeError" class="v3-error-text" role="alert">{{ store.writeError }}</p>

    <!-- Plan -->
    <div v-if="tab === 'plan' && !loading && !errorInfo" id="rtw-panel-plan" class="rw__plan" role="tabpanel" aria-labelledby="rtw-tab-plan">
      <section class="rw__date" aria-label="Return date">
        <form v-if="showDateForm" class="rw__date-form" novalidate @submit.prevent="saveDate">
          <h2 class="nt-heading nt-heading--sm rw__date-title">When do you go back?</h2>
          <div class="rw__date-row">
            <label class="rw__field">
              <span class="rw__label">First day back at work</span>
              <input
                v-model="dateDraft"
                class="v3-control rw__date-input"
                type="date"
                :aria-invalid="dateError ? 'true' : undefined"
                :aria-describedby="dateError ? 'rtw-date-error' : undefined"
              />
            </label>
            <button type="submit" class="btn btn-sm" :class="addOpen ? 'btn-outline' : 'btn-primary'">Save date</button>
            <button v-if="store.returnDate" type="button" class="v3-textbtn" @click="cancelChangeDate">Cancel</button>
          </div>
          <p v-if="dateError" id="rtw-date-error" class="v3-error-text" role="alert">{{ dateError }}</p>
        </form>
        <div v-else class="rw__date-line">
          <p class="rw__sentence">{{ sentence }}</p>
          <button type="button" class="v3-textbtn" @click="startChangeDate">Change date</button>
        </div>
      </section>

      <section class="rw__steps" aria-labelledby="rtw-steps">
        <h2 id="rtw-steps" class="nt-heading nt-heading--sm">Next steps</h2>
        <p v-if="savedLine" class="rw__muted">{{ savedLine }}</p>

        <p v-if="!store.tasks.length" class="rw__muted">No tasks yet. Add one or start from the suggestions below.</p>

        <template v-else>
          <p class="rw__muted">{{ countsText }}</p>
          <section v-for="group in groups" :key="group.label" class="rw__group" :aria-labelledby="`rtw-group-${group.label.replace(/\s+/g, '-').toLowerCase()}`">
            <h3 :id="`rtw-group-${group.label.replace(/\s+/g, '-').toLowerCase()}`" class="rw__group-title">
              {{ group.label }}
            </h3>
            <ul class="rw__list">
              <li v-for="task in group.tasks" :key="task.id" class="rw__task" :data-task="task.id">
                <div class="rw__main">
                  <input
                    :id="`rtw-task-${task.id}`"
                    class="form-check-input rw__check"
                    type="checkbox"
                    :checked="task.done"
                    @change="store.toggleTask(task.id)"
                  />
                  <div class="rw__text">
                    <label :for="`rtw-task-${task.id}`" class="rw__task-title" :class="{ 'rw__task-title--done': task.done }">
                      {{ task.title }}
                    </label>
                    <p class="rw__meta">
                      <span class="v3-badge">{{ ownerName(task.owner) }}</span>
                      <span>{{ groupLabel(task.group) }}</span>
                      <span
                        v-if="task.due && !task.done"
                        :class="{ 'rw__overdue': group.label === 'Overdue' }"
                        >{{ dueText(task.due, today) }}</span
                      >
                      <span v-if="doneLine(task)">{{ doneLine(task) }}</span>
                    </p>
                  </div>
                </div>

                <div v-if="confirmingId === task.id" class="rw__confirm" role="group" :aria-label="`Delete ${task.title}`">
                  <span class="rw__confirm-text">Delete this task?</span>
                  <button type="button" class="btn btn-outline btn-sm" @click="confirmDelete(task)">Delete</button>
                  <button type="button" class="btn btn-outline btn-sm" @click="confirmingId = ''">Cancel</button>
                </div>
                <div v-else class="rw__actions">
                  <button type="button" class="rw__icon" :aria-label="`Edit ${task.title}`" @click="openForm(task)">
                    <V3Icon name="edit" :size="18" />
                  </button>
                  <button
                    type="button"
                    class="rw__icon rw__icon--delete"
                    :aria-label="`Delete ${task.title}`"
                    @click="confirmingId = task.id"
                  >
                    <V3Icon name="trash" :size="18" />
                  </button>
                </div>
              </li>
            </ul>
          </section>
        </template>
      </section>

      <section class="rw__add" aria-label="Add a task">
        <button
          v-if="!addOpen"
          type="button"
          class="btn btn-outline btn-sm rw__add-btn"
          aria-expanded="false"
          aria-controls="rtw-form"
          @click="openForm()"
        >
          <V3Icon name="plus" :size="16" />
          <span>Add a task</span>
        </button>
        <form v-else id="rtw-form" class="rw__form" novalidate @submit.prevent="submitForm">
          <h3 class="rw__group-title">{{ editId ? "Edit task" : "Add a task" }}</h3>
          <label class="rw__field">
            <span class="rw__label">Task</span>
            <input
              ref="titleInput"
              v-model="form.title"
              class="v3-control"
              type="text"
              maxlength="80"
              autocomplete="off"
              :aria-invalid="formError ? 'true' : undefined"
              :aria-describedby="formError ? 'rtw-form-error' : undefined"
            />
          </label>
          <div class="rw__field">
            <span class="rw__label">Group</span>
            <V3ChipGroup v-model="form.group" :options="groupOptions" label="Group" />
          </div>
          <div class="rw__field">
            <span class="rw__label">Who does it</span>
            <V3ChipGroup v-model="form.owner" :options="ownerOptions" label="Who does it" />
          </div>
          <label class="rw__field rw__field--narrow">
            <span class="rw__label">Due date (optional)</span>
            <input v-model="form.due" class="v3-control" type="date" />
          </label>
          <p v-if="formError" id="rtw-form-error" class="v3-error-text" role="alert">{{ formError }}</p>
          <div class="rw__form-actions">
            <button type="submit" class="btn btn-primary btn-sm">{{ editId ? "Save task" : "Add task" }}</button>
            <button type="button" class="btn btn-outline btn-sm" @click="closeForm">Cancel</button>
          </div>
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
.rw__plan { display: flex; flex-direction: column; gap: 32px; max-width: 820px; }

.rw__date-form { display: flex; flex-direction: column; gap: 12px; }
.rw__date-title { margin: 0; }
.rw__date-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 16px; }
.rw__date-input { width: 220px; }
.rw__date-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 16px; }
.rw__sentence { margin: 0; font-family: var(--nt-serif); font-size: 1.25rem; line-height: 1.4; letter-spacing: -0.01em; color: var(--nt-ink); }

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
