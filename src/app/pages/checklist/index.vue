<script setup>
import BabySwitch from "@/app/components/BabySwitch.vue";
import SkeletonList from "@/app/components/SkeletonList.vue";
import LoadingScreen from "@/app/components/LoadingScreen.vue";
import "@/app/app.css";
import { computed, inject, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { checklistView, dueLabel, ownerChip, taskOwner, TITLE_MAX } from "@/app/utils/checklistHelpers";
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

const sharedBy = computed(() => (partnerFirst.value ? `${myName.value} and ${partnerFirst.value}` : myName.value));
const openCount = computed(() => tasks.value.filter((t) => !t.done).length);
const doneCount = computed(() => tasks.value.filter((t) => t.done).length);
const progressLine = computed(() => `${doneCount.value} of ${tasks.value.length} done`);

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

// Ticking a task done or undone.
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

const chip = (task) => ownerChip(task, { meUid: myUid.value, meName: myName.value, partnerName: partnerFirst.value || "Your partner" });
const dueOf = (task) => dueLabel(task, now.value);


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
      <LoadingScreen v-if="loading" variant="inline" label="Loading the checklist" />
    </div>

    <div v-if="!loading && error" class="ck__error alert alert-danger" role="alert">
      <p class="mb-0">{{ error }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="reload">Try again</button>
    </div>

    <template v-if="!loading && !error">
  <header class="ck__hero">
    <div class="ck__hero-text">
      <p class="ck__eyebrow">Shared by {{ sharedBy }}</p>
      <h1 class="ck__title">Our checklist</h1>
      <p class="ck__lead">Who is doing what, in one place.</p>
      <p v-if="tasks.length" class="ck__pill"><span class="ck__pill-dot"></span>{{ progressLine }}</p>
    </div>
  </header>
  <BabySwitch />

  <SkeletonList v-if="listLoading" :rows="4" :height="56" label="Loading the checklist" />
  <div v-if="!listLoading && listErrorInfo" class="ck__error alert alert-danger" role="alert">
    <div>
      <p class="mb-0">{{ listErrorInfo.text }}</p>
      <p v-if="listErrorInfo.detail" class="ck__muted">{{ listErrorInfo.detail }}</p>
    </div>
  </div>

  <template v-if="!listLoading && !listErrorInfo">
    <section class="ck__add-card" aria-label="Add a task">
      <form class="ck__add" @submit.prevent="add">
        <div class="ck__add-row">
          <label class="visually-hidden" for="ck-title">Add a task</label>
          <input id="ck-title" v-model="title" type="text" class="ck__input" :maxlength="TITLE_MAX" placeholder="Add a task, e.g. book vaccination" />
          <button type="submit" class="ck__btn" :disabled="!title.trim() || adding">{{ adding ? "Adding..." : "Add" }}</button>
        </div>
        <div class="ck__add-opts">
          <div v-if="hasPartner" class="ck__who" role="group" aria-label="Who does it">
            <span class="ck__muted">Who does it</span>
            <button type="button" class="ck__opt" :aria-pressed="who === 'me' ? 'true' : 'false'" @click="who = 'me'">Me</button>
            <button type="button" class="ck__opt" :aria-pressed="who === 'partner' ? 'true' : 'false'" @click="who = 'partner'">{{ partnerFirst || "Partner" }}</button>
            <button type="button" class="ck__opt" :aria-pressed="who === 'both' ? 'true' : 'false'" @click="who = 'both'">Both</button>
          </div>
          <button v-if="!showDate" type="button" class="ck__link" @click="showDate = true">Add a date</button>
          <span v-else class="ck__date">
            <label class="visually-hidden" for="ck-due">Due date</label>
            <input id="ck-due" v-model="due" type="date" class="ck__input ck__input--date" />
            <button type="button" class="ck__link" @click="showDate = false; due = ''">No date</button>
          </span>
        </div>
      </form>
      <p v-if="rtw.writeError" class="ck__row-error" role="alert">{{ rtw.writeError }}</p>
    </section>

    <section class="ck__list" aria-label="Checklist">
      <div class="ck__row-head">
        <h2 class="ck__h2">Tasks</h2>
        <div class="ck__filters" role="group" aria-label="Show tasks for">
          <button v-for="item in tabs" :key="item.key" type="button" class="ck__chip-btn" :aria-pressed="tab === item.key ? 'true' : 'false'" @click="tab = item.key">{{ item.label }}</button>
        </div>
      </div>

      <p v-if="ownListEmpty" class="ck__empty">Nothing on the list yet. Add the first task above.</p>
      <p v-else-if="isEmpty" class="ck__empty">Nothing here.</p>

      <div v-for="group in view.groups" :key="group.key" class="ck__group">
        <div class="ck__day-head"><span class="ck__day-pill">{{ group.label }}</span><span class="ck__day-line"></span></div>
        <TransitionGroup tag="ul" name="li" class="ck__rows">
          <li v-for="task in group.tasks" :key="task.id" class="ck__row">
            <label class="ck__label">
              <input type="checkbox" class="ck__box" :checked="task.done" :disabled="busy === task.id" @change="toggle(task)" />
              <span class="ck__text">
                <span class="ck__name">{{ task.title }}</span>
                <span v-if="dueOf(task)" class="ck__due" :class="{ 'ck__due--late': /overdue/i.test(dueOf(task)) }">{{ dueOf(task) }}</span>
              </span>
            </label>
            <span class="ck__owner"><span class="ck__initial" aria-hidden="true">{{ chip(task).initial }}</span>{{ chip(task).name }}</span>
          </li>
        </TransitionGroup>
      </div>

      <div v-if="view.done.length" class="ck__group">
        <div class="ck__day-head">
          <span class="ck__day-pill ck__day-pill--muted">Done</span>
          <span class="ck__day-line"></span>
          <span class="ck__muted">{{ view.done.length }} finished</span>
          <button type="button" class="ck__link" :aria-expanded="showDone ? 'true' : 'false'" aria-controls="ck-done-list" @click="showDone = !showDone">{{ showDone ? "Hide" : "Show" }}</button>
        </div>
        <TransitionGroup tag="ul" name="li" v-if="showDone" id="ck-done-list" class="ck__rows">
          <li v-for="task in view.done" :key="task.id" class="ck__row ck__row--done">
            <label class="ck__label">
              <input type="checkbox" class="ck__box" checked :disabled="busy === task.id" @change="toggle(task)" />
              <span class="ck__text"><span class="ck__name">{{ task.title }}</span></span>
            </label>
            <span class="ck__muted">{{ doneMeta(task) }}</span>
          </li>
        </TransitionGroup>
      </div>
    </section>
  </template>
</template>
  </div>
</template>

<style scoped>
.ck { --navy: #243560; --navy-2: #2d3f70; --ink: #1f2a52; --cream: #fdf9f0; --sand: #e9d9b8; display: flex; flex-direction: column; gap: 24px; width: 100%; max-width: 1020px; margin: 0 auto; color: var(--ink); }
.ck__status, .ck__muted { margin: 0; font-size: 0.875rem; color: #6b7392; }
.ck__error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; border-radius: 8px; }

.ck__hero { padding: 32px 40px; background: var(--navy-2); border-radius: 28px; border-bottom: 5px solid #182246; color: #fff; }
.ck__hero-text { display: flex; flex-direction: column; gap: 10px; }
.ck__eyebrow { margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #f2a477; }
.ck__title { margin: 0; font-family: var(--nt-serif); font-size: 3rem; line-height: 1.05; font-weight: 700; color: #fff; }
.ck__lead { margin: 0; font-size: 1.0625rem; color: #dfe5f7; }
.ck__pill { display: inline-flex; align-items: center; align-self: flex-start; gap: 8px; margin: 6px 0 0; padding: 8px 16px; border: 1px solid rgb(255 255 255 / 35%); border-radius: 999px; background: rgb(255 255 255 / 10%); font-size: 0.9375rem; }
.ck__pill-dot { width: 10px; height: 10px; border-radius: 50%; background: #8fd19e; }

.ck__add-card { padding: 20px 24px; background: #fbf0d6; border: 1px solid #ecd9a8; border-bottom-width: 3px; border-radius: 24px; }
.ck__add { display: flex; flex-direction: column; gap: 12px; }
.ck__add-row { display: flex; gap: 12px; align-items: stretch; }
.ck__input { flex: 1; min-width: 0; height: 48px; padding: 0 16px; background: #fff; border: 1.5px solid var(--sand); border-radius: 14px; font-family: inherit; font-size: 1rem; color: var(--ink); }
.ck__input:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
.ck__input--date { flex: none; width: auto; height: 40px; }
.ck__btn { flex: none; padding: 0 28px; background: var(--navy); border: 0; border-bottom: 3px solid #182246; border-radius: 14px; font-family: inherit; font-size: 1rem; font-weight: 600; color: #fff; cursor: pointer; }
.ck__btn:disabled { opacity: 0.5; cursor: default; }
.ck__btn:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
.ck__add-opts { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.ck__who { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.ck__opt { padding: 6px 16px; background: transparent; border: 1.5px solid var(--navy); border-radius: 999px; font-family: inherit; font-size: 0.875rem; font-weight: 600; color: var(--navy); cursor: pointer; }
.ck__opt[aria-pressed="true"] { background: var(--navy); color: #fff; }
.ck__opt:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
.ck__date { display: inline-flex; align-items: center; gap: 12px; }
.ck__link { padding: 4px 0; background: none; border: 0; font-family: inherit; font-size: 0.875rem; font-weight: 600; color: var(--navy); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.ck__row-error { margin: 8px 0 0; font-size: 0.875rem; color: var(--nt-coral); }

.ck__list { padding: 24px 28px 28px; background: var(--cream); border: 1px solid var(--sand); border-bottom-width: 4px; border-radius: 24px; }
.ck__row-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.ck__h2 { margin: 0; font-family: var(--nt-serif); font-size: 1.75rem; font-weight: 700; }
.ck__filters { display: flex; flex-wrap: wrap; gap: 8px; }
.ck__chip-btn { padding: 8px 20px; background: transparent; border: 1.5px solid var(--navy); border-radius: 999px; font-family: inherit; font-size: 0.9375rem; font-weight: 600; color: var(--navy); cursor: pointer; }
.ck__chip-btn[aria-pressed="true"] { background: var(--navy); color: #fff; }
.ck__chip-btn:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
.ck__empty { margin: 0; padding: 16px 0; font-size: 0.9375rem; color: #6b7392; }

.ck__group { margin-top: 12px; }
.ck__day-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.ck__day-pill { padding: 4px 12px; background: var(--navy); border-radius: 8px; font-size: 0.8125rem; font-weight: 600; color: #fff; }
.ck__day-pill--muted { background: #6b7392; }
.ck__day-line { flex: 1; border-top: 2px dashed var(--sand); }
.ck__rows { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.ck__row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; background: #fff; border: 1px solid var(--sand); border-radius: 18px; }
.ck__row--done .ck__name { color: #6b7392; text-decoration: line-through; }
.ck__label { display: flex; align-items: center; gap: 14px; min-width: 0; cursor: pointer; }
.ck__box { flex: none; appearance: none; width: 28px; height: 28px; margin: 0; background: #fff; border: 3px solid #a8532f; border-radius: 50%; cursor: pointer; }
.ck__box:checked { background: #a8532f radial-gradient(circle, #fff 0 30%, transparent 32%); }
.ck__box:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
.ck__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ck__name { font-family: var(--nt-serif); font-size: 1.125rem; font-weight: 700; overflow-wrap: anywhere; }
.ck__due { align-self: flex-start; font-size: 0.8125rem; color: #4a5272; }
.ck__due--late { padding: 1px 10px; background: #f3e1dc; border-radius: 999px; font-weight: 600; color: #a8473f; }
.ck__owner { flex: none; display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px; background: #f1ead9; border-radius: 999px; font-size: 0.875rem; font-weight: 600; }
.ck__initial { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; background: var(--navy); border-radius: 50%; font-size: 0.75rem; color: #fff; }

@media (max-width: 575px) {
  .ck__hero { padding: 24px; }
  .ck__title { font-size: 2.25rem; }
  .ck__list { padding: 20px 16px; }
  .ck__add-row { flex-direction: column; }
  .ck__btn { height: 48px; }
  .ck__row { flex-wrap: wrap; }
}
</style>