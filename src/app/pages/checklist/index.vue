<script setup>
import "@/app/app.css";
import { computed, inject, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { checklistView, dueLabel, myOpenTasks, ownerChip, queuedTasks, taskOwner, TITLE_MAX } from "@/app/utils/checklistHelpers";
import { dayLabel } from "@/app/utils/entryHelpers";
import { describeSharedError } from "@/app/utils/sharedHelpers";
import { displayName, useHome, HOME_KEY } from "@/app/composables/useHome";
import { useShared, SHARED_KEY } from "@/app/composables/useShared";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "ChecklistPage" });

// The layout loads the household and the shared stores once and provides them. Fall back to
// loading here so the page also works when rendered on its own.
const home = inject(HOME_KEY, null) ?? useHome();
const { loading, error, reload, me, partner, householdId } = home;
const myUid = computed(() => me.value.uid);
const partnerUid = computed(() => partner.value?.uid ?? "");
const shared = inject(SHARED_KEY, null) ?? useShared(householdId, myUid, partnerUid);
const rtw = shared.rtw;

const now = ref(new Date());
let clock = null;
onMounted(() => {
  clock = setInterval(() => {
    now.value = new Date();
  }, 60000);
});
onBeforeUnmount(() => clearInterval(clock));

const myName = computed(() => displayName(me.value.firstName) || "Me");
const partnerFirst = computed(() => (partner.value ? displayName(partner.value.firstName) : ""));
const partnerLabel = computed(() => partnerFirst.value || "your partner");
const hasPartner = computed(() => Boolean(partnerUid.value));

const tasks = computed(() => rtw.tasks ?? []);
const listLoading = computed(() => !householdId.value || Boolean(rtw.loading));
const listErrorInfo = computed(() => (rtw.error ? describeSharedError(rtw.error.code, "checklist") : null));

// Tabs
const tab = ref("all");
const tabs = computed(() => [
  { key: "all", label: "Everyone" },
  { key: "mine", label: "Mine" },
  ...(hasPartner.value ? [{ key: "partner", label: `${partnerFirst.value || "Partner"}'s` }] : []),
]);
const view = computed(() =>
  checklistView(tasks.value, { meUid: myUid.value, tab: tab.value, today: now.value }),
);
const isEmpty = computed(() => !view.value.groups.length && !view.value.done.length);
const ownListEmpty = computed(() => !tasks.value.length);

// Adding a task: one line, who does it, and an optional date.
const title = ref("");
const who = ref("me");
const showDate = ref(false);
const due = ref("");
const adding = ref(false);

async function add() {
  const text = title.value.trim();
  if (!text || adding.value) return;
  adding.value = true;
  const owner = who.value === "partner" && hasPartner.value ? partnerUid.value : who.value === "both" ? "both" : myUid.value;
  const added = await rtw.addTask({ title: text, group: "home", owner, due: showDate.value && due.value ? due.value : null });
  adding.value = false;
  if (!added) return;
  title.value = "";
  due.value = "";
  showDate.value = false;
}

// Ticking, and marking my own tasks to pass on at the next handover.
const busy = ref("");
async function toggle(task) {
  if (busy.value) return;
  busy.value = task.id;
  try {
    await rtw.toggleTask(task.id);
  } finally {
    busy.value = "";
  }
}
async function setQueued(task, on) {
  if (busy.value) return;
  busy.value = task.id;
  try {
    await rtw.updateTask(task.id, { queued: on });
  } finally {
    busy.value = "";
  }
}

const canPass = (task) => hasPartner.value && !task.done && taskOwner(task, myUid.value) === "me";
const chip = (task) => ownerChip(task, { meUid: myUid.value, meName: myName.value, partnerName: partnerFirst.value || "Your partner" });
const dueOf = (task) => dueLabel(task, now.value);

const queuedCount = computed(() => queuedTasks(tasks.value, myUid.value).length);
const hasOwnOpen = computed(() => myOpenTasks(tasks.value, myUid.value).length > 0);

// The Done section stays folded until asked for.
const showDone = ref(false);
function doneMeta(task) {
  const by = task.doneBy === myUid.value ? myName.value : task.doneBy === partnerUid.value ? partnerFirst.value || "Your partner" : "";
  const when = task.doneAt ? dayLabel(task.doneAt, now.value) : "";
  return [by, when].filter(Boolean).join(", ");
}
</script>

<template>
  <div class="ck">
    <div aria-live="polite">
      <p v-if="loading" class="ck__status">Loading the checklist...</p>
    </div>

    <div v-if="!loading && error" class="ck__error alert alert-danger" role="alert">
      <p class="mb-0">{{ error }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="reload">Try again</button>
    </div>

    <template v-if="!loading && !error">
      <header class="ck__head">
        <div>
          <h1 class="nt-title ck__title">Our checklist</h1>
          <p class="ck__sub">Who is doing what, in one place.</p>
        </div>
        <RouterLink v-if="hasPartner && hasOwnOpen" :to="ROUTES.HANDOVER" class="app-link ck__handover">
          Hand over to {{ partnerLabel }}
        </RouterLink>
      </header>

      <p v-if="listLoading" class="ck__status">Loading the checklist...</p>
      <div v-if="!listLoading && listErrorInfo" class="ck__error alert alert-danger" role="alert">
        <div>
          <p class="mb-0">{{ listErrorInfo.text }}</p>
          <p v-if="listErrorInfo.detail" class="ck__muted">{{ listErrorInfo.detail }}</p>
        </div>
      </div>

      <section v-if="!listLoading && !listErrorInfo" class="ck__card" aria-label="Checklist">
        <div class="ck__tabs" role="group" aria-label="Show tasks for">
          <button
            v-for="item in tabs"
            :key="item.key"
            type="button"
            class="ck__tab"
            :aria-pressed="tab === item.key ? 'true' : 'false'"
            @click="tab = item.key"
          >
            {{ item.label }}
          </button>
        </div>

        <form class="ck__add" @submit.prevent="add">
          <div class="ck__add-row">
            <label class="visually-hidden" for="ck-title">Add a task</label>
            <input
              id="ck-title"
              v-model="title"
              type="text"
              class="app-control"
              :maxlength="TITLE_MAX"
              placeholder="Add a task, e.g. book vaccination"
            />
            <button type="submit" class="btn btn-primary" :disabled="!title.trim() || adding">
              {{ adding ? "Adding..." : "Add" }}
            </button>
          </div>
          <div class="ck__add-opts">
            <div v-if="hasPartner" class="ck__who" role="group" aria-label="Who does it">
              <span class="ck__muted">Who does it</span>
              <button type="button" class="ck__opt" :aria-pressed="who === 'me' ? 'true' : 'false'" @click="who = 'me'">Me</button>
              <button type="button" class="ck__opt" :aria-pressed="who === 'partner' ? 'true' : 'false'" @click="who = 'partner'">
                {{ partnerFirst || "Partner" }}
              </button>
              <button type="button" class="ck__opt" :aria-pressed="who === 'both' ? 'true' : 'false'" @click="who = 'both'">Both</button>
            </div>
            <button v-if="!showDate" type="button" class="app-textbtn" @click="showDate = true">Add a date</button>
            <span v-else class="ck__date">
              <label class="visually-hidden" for="ck-due">Due date</label>
              <input id="ck-due" v-model="due" type="date" class="app-control" />
              <button type="button" class="app-textbtn" @click="showDate = false; due = ''">No date</button>
            </span>
          </div>
        </form>

        <p v-if="rtw.writeError" class="ck__row-error" role="alert">{{ rtw.writeError }}</p>

        <p v-if="ownListEmpty" class="ck__empty">Nothing on the list yet. Add the first task above.</p>
        <p v-else-if="isEmpty" class="ck__empty">Nothing here.</p>

        <section v-for="group in view.groups" :key="group.key" class="ck__group" :aria-labelledby="`ck-g-${group.key}`">
          <h2 :id="`ck-g-${group.key}`" class="ck__h2">{{ group.label }}</h2>
          <ul class="ck__rows">
            <li v-for="task in group.tasks" :key="task.id" class="ck__row">
              <label class="ck__label">
                <input
                  type="checkbox"
                  class="ck__box"
                  :checked="task.done"
                  :disabled="busy === task.id"
                  @change="toggle(task)"
                />
                <span class="ck__text">
                  <span class="ck__name">{{ task.title }}</span>
                  <span v-if="dueOf(task)" class="ck__due" :class="{ 'ck__due--late': /overdue/i.test(dueOf(task)) }">{{ dueOf(task) }}</span>
                </span>
              </label>
              <div class="ck__side">
                <span class="ck__chip"><span class="ck__initial" aria-hidden="true">{{ chip(task).initial }}</span>{{ chip(task).name }}</span>
                <template v-if="canPass(task)">
                  <span v-if="task.queued" class="ck__queued">
                    Queued for handover
                    <button type="button" class="app-textbtn" :disabled="busy === task.id" @click="setQueued(task, false)">Undo</button>
                  </span>
                  <button v-else type="button" class="app-textbtn" :disabled="busy === task.id" @click="setQueued(task, true)">
                    Give to {{ partnerLabel }}
                  </button>
                </template>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="view.done.length" class="ck__group" aria-labelledby="ck-g-done">
          <div class="ck__done-head">
            <h2 id="ck-g-done" class="ck__h2 ck__h2--muted">Done</h2>
            <span class="ck__muted">{{ view.done.length }} finished</span>
            <button
              type="button"
              class="app-textbtn"
              :aria-expanded="showDone ? 'true' : 'false'"
              aria-controls="ck-done-list"
              @click="showDone = !showDone"
            >
              {{ showDone ? "Hide" : "Show" }}
            </button>
          </div>
          <ul v-if="showDone" id="ck-done-list" class="ck__rows">
            <li v-for="task in view.done" :key="task.id" class="ck__row ck__row--done">
              <label class="ck__label">
                <input type="checkbox" class="ck__box" checked :disabled="busy === task.id" @change="toggle(task)" />
                <span class="ck__text"><span class="ck__name">{{ task.title }}</span></span>
              </label>
              <span class="ck__muted">{{ doneMeta(task) }}</span>
            </li>
          </ul>
        </section>

        <p v-if="queuedCount" class="ck__queue">
          <span>{{ queuedCount === 1 ? "1 task is ready to pass on." : `${queuedCount} tasks are ready to pass on.` }}</span>
          <RouterLink :to="ROUTES.HANDOVER" class="app-link">Go to handover</RouterLink>
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ck { display: flex; flex-direction: column; gap: 24px; margin: 0; font-size: 1rem; }
.ck__status { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.ck__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.ck__error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin: 0; font-size: 0.875rem; border-radius: 8px; }

.ck__head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px; }
.ck__title { font-size: 2.5rem; line-height: 1.2; margin: 0 0 8px; }
.ck__sub { margin: 0; font-size: 1rem; color: var(--nt-muted); }
.ck__handover { margin-top: 12px; }

.ck__card { display: flex; flex-direction: column; gap: 20px; max-width: 760px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; padding: 24px; }

.ck__tabs { display: flex; gap: 20px; border-bottom: 1px solid var(--nt-line); }
.ck__tab { padding: 0 0 10px; margin-bottom: -1px; background: none; border: 0; border-bottom: 2px solid transparent; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-muted); cursor: pointer; }
.ck__tab[aria-pressed="true"] { color: var(--nt-ink); font-weight: 600; border-bottom-color: var(--nt-plum); }
.ck__tab:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }

.ck__add { display: flex; flex-direction: column; gap: 12px; }
.ck__add-row { display: flex; gap: 12px; align-items: stretch; }
.ck__add-row .app-control { flex: 1; min-width: 0; }
.ck__add-opts { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.ck__who { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.ck__opt { min-height: 32px; padding: 4px 14px; font-family: inherit; font-size: 0.875rem; color: var(--nt-ink); background: #fff; border: 1px solid var(--nt-line); border-radius: 8px; cursor: pointer; }
.ck__opt:hover { border-color: var(--nt-muted); }
.ck__opt[aria-pressed="true"] { border-color: var(--nt-plum); background: var(--nt-apricot); font-weight: 600; }
.ck__opt:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.ck__date { display: inline-flex; align-items: center; gap: 12px; }
.ck__date .app-control { width: auto; }
.ck__row-error { margin: 0; font-size: 0.875rem; color: var(--nt-coral); }
.ck__empty { margin: 0; padding: 16px 0; font-size: 0.875rem; color: var(--nt-muted); }

.ck__group { display: flex; flex-direction: column; gap: 4px; }
.ck__h2 { margin: 0; padding-bottom: 8px; font-size: 1rem; font-weight: 600; line-height: 1.3; color: var(--nt-ink); border-bottom: 1px solid var(--nt-line); }
.ck__h2--muted { color: var(--nt-muted); padding-bottom: 0; border-bottom: 0; }
.ck__done-head { display: flex; align-items: baseline; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--nt-line); }
.ck__done-head .ck__muted { margin-left: auto; }

.ck__rows { margin: 0; padding: 0; list-style: none; }
.ck__row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 12px 0; border-bottom: 1px solid var(--nt-line); }
.ck__row--done .ck__name { color: var(--nt-muted); text-decoration: line-through; }
.ck__label { display: flex; align-items: flex-start; gap: 12px; cursor: pointer; min-width: 0; }
.ck__box { flex: none; width: 18px; height: 18px; margin: 2px 0 0; accent-color: var(--nt-plum); cursor: pointer; }
.ck__box:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.ck__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ck__name { font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); overflow-wrap: anywhere; }
.ck__due { font-size: 0.875rem; color: var(--nt-muted); }
.ck__due--late { color: var(--nt-coral); }
.ck__side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; font-size: 0.875rem; }
.ck__chip { display: inline-flex; align-items: center; gap: 8px; color: var(--nt-ink); }
.ck__initial { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; font-size: 0.75rem; border: 1px solid var(--nt-ink); border-radius: 50%; }
.ck__queued { display: inline-flex; flex-wrap: wrap; align-items: baseline; justify-content: flex-end; gap: 8px; color: var(--nt-muted); }

.ck__queue { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin: 0; padding-top: 16px; border-top: 1px solid var(--nt-line); font-size: 0.875rem; color: var(--nt-ink); }

@media (max-width: 575px) {
  .ck__card { padding: 20px 16px; }
  .ck__title { font-size: 2rem; }
  .ck__row { grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .ck__side { flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; padding-left: 30px; }
}
</style>
