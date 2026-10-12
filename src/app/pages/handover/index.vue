<script setup>
import "@/app/app.css";
import { computed, inject, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "@/app/components/Icon.vue";
import { RouterLink } from "vue-router";
import HandoverTasks from "@/app/components/HandoverTasks.vue";
import { acceptHandover, NOTE_MAX, sendHandover } from "@/app/api/handovers";
import { dueLabel, myOpenTasks } from "@/app/api/checklistHelpers";
import { dayLabel, formatTime, startOfDay } from "@/app/api/entryHelpers";
import { describeSharedError } from "@/app/api/sharedHelpers";
import {
  formatWindow,
  handoverStatus,
  cleanTasks,
  periodStartFrom,
  TASKS_MAX,
  taskProgress,
  tasksWithState,
  summariseWindow,
  summaryBlocks,
  summaryLine,
} from "@/app/api/handoverHelpers";
import { displayName, useHome, HOME_KEY } from "@/app/composables/useHome";
import { useEntries, ENTRIES_KEY } from "@/app/composables/useEntries";
import { useHandovers, HANDOVERS_KEY } from "@/app/composables/useHandovers";
import { SHARED_KEY } from "@/app/composables/useShared";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "HandoverPage" });

// Quick notes a parent can tap instead of typing. The picks and the optional line are joined
// into the one plain note the handover already stores.
const PICKS = ["Fussy after feeds", "Nappy rash", "Spit-up", "Slept well", "Needed rocking", "Long nap"];
const LINE_MAX = 200;
const SIX_HOURS = 6 * 3600000;

const home = inject(HOME_KEY, null) ?? useHome();
const { loading, error, reload, me, partner, householdId } = home;
const entriesShared = inject(ENTRIES_KEY, null) ?? useEntries(householdId);
const myUid = computed(() => me.value.uid);
const shared = inject(HANDOVERS_KEY, null) ?? useHandovers(householdId, myUid);
const sharedStores = inject(SHARED_KEY, null);
const rtw = sharedStores?.rtw ?? null;
const checklistTasks = computed(() => rtw?.tasks ?? []);

const now = ref(new Date());

const myName = computed(() => displayName(me.value.firstName));
const partnerFirst = computed(() => (partner.value ? displayName(partner.value.firstName) : ""));
const partnerLabel = computed(() => partnerFirst.value || "your partner");
const partnerUid = computed(() => partner.value?.uid ?? "");
const hasPartner = computed(() => Boolean(partnerUid.value));

function nameOf(uid) {
  if (!uid) return "Your partner";
  if (uid === myUid.value) return myName.value || "You";
  if (partnerUid.value && uid === partnerUid.value) return partnerFirst.value || "Your partner";
  return "Your partner";
}

const listLoading = computed(() => !householdId.value || shared.loading.value);
const listErrorInfo = computed(() =>
  shared.error.value ? describeSharedError(shared.error.value.code, "handovers") : null,
);
const handovers = computed(() => shared.handovers.value);
const entries = computed(() => entriesShared.entries.value);
const incoming = computed(() => shared.waitingForMe.value);
const latest = computed(() => shared.latest.value);

// The window the send form covers. By default it runs from the last handover, or from the start
// of today when there is none yet; "Change" lets the parent pick a different start.
const windowChoice = ref("auto");
const changing = ref(false);
const windowChoices = computed(() => {
  const list = [{ key: "auto", label: latest.value ? "Last handover" : "Start of today" }];
  if (latest.value) list.push({ key: "today", label: "Start of today" });
  list.push({ key: "six", label: "Last 6 hours" });
  return list;
});
const periodStart = computed(() => {
  if (windowChoice.value === "today") return startOfDay(now.value);
  if (windowChoice.value === "six") return new Date(now.value.getTime() - SIX_HOURS);
  return periodStartFrom(latest.value, now.value);
});
const sinceLine = computed(() =>
  windowChoice.value === "auto" && latest.value
    ? `Since your last handover at ${formatTime(periodStart.value)}`
    : `Since ${formatTime(periodStart.value)}`,
);
const liveSummary = computed(() => summariseWindow(entries.value, periodStart.value, now.value));
const liveBlocks = computed(() => summaryBlocks(liveSummary.value));
function chooseWindow(key) {
  windowChoice.value = key;
  changing.value = false;
}

// The received handover
const received = computed(() => {
  const handover = incoming.value;
  if (!handover) return null;
  return {
    id: handover.id,
    heading: `${nameOf(handover.from)} handed over at ${formatTime(handover.sentAt)}`,
    window: formatWindow(handover.periodStart, handover.sentAt),
    blocks: summaryBlocks(handover.summary),
    note: handover.note ?? "",
    needsAttention: Boolean(handover.needsAttention),
    attentionNote: handover.attentionNote ?? "",
    nextUp: handover.nextUp ?? [],
    tasks: tasksWithState(handover.tasks, checklistTasks.value),
  };
});

// The side panel shows only the newest handover that is not the one waiting for me.
const last = computed(() => {
  const handover = handovers.value.find((item) => item.id !== incoming.value?.id);
  if (!handover) return null;
  return {
    id: handover.id,
    when: `${dayLabel(handover.sentAt, now.value)}, ${formatTime(handover.sentAt)}`,
    who: `${nameOf(handover.from)} to ${nameOf(handover.to)}`,
    status: handoverStatus(handover, myUid.value, nameOf(handover.to)),
    accepted: /accepted/i.test(handoverStatus(handover, myUid.value, nameOf(handover.to))),
    summary: summaryLine(handover.summary),
    note: handover.note ?? "",
    tasks: tasksWithState(handover.tasks, checklistTasks.value),
    progress: taskProgress(tasksWithState(handover.tasks, checklistTasks.value)),
    mine: handover.to === myUid.value,
  };
});

// Ticking a task off. The tick lives on the checklist, so this is the same tick as there.
const ticking = ref("");
const tickError = ref("");
async function toggleChecklist(task) {
  if (!rtw || !task?.ref || ticking.value) return;
  ticking.value = task.id;
  tickError.value = "";
  try {
    const ok = await rtw.toggleTask(task.ref);
    if (ok === false) tickError.value = "We could not update that task. Check your connection and try again.";
  } finally {
    ticking.value = "";
  }
}

// Accepting
const accepting = ref(false);
const acceptError = ref("");
const acceptedText = ref("");
async function accept() {
  const handover = received.value;
  if (!handover || accepting.value || !householdId.value) return;
  accepting.value = true;
  acceptError.value = "";
  try {
    await acceptHandover(householdId.value, handover.id, myUid.value);
    acceptedText.value = "Handover accepted.";
  } catch (cause) {
    console.error("[app handover]", cause?.code, cause);
    acceptError.value = "We could not accept the handover. Check your connection and try again.";
  } finally {
    accepting.value = false;
  }
}

// The send form
const picks = ref([]);
const line = ref("");
const choice = ref({});
const sending = ref(false);
const sendError = ref("");
const sentText = ref("");

// Tasks I can hand over: my own open tasks on the checklist. The ones I queued there start
// ticked, and I can tick or untick any of them here. Nothing moves until I send.
const openMine = computed(() => myOpenTasks(checklistTasks.value, myUid.value));
const passed = (task) => choice.value[task.id] ?? Boolean(task.queued);
const chosen = computed(() => openMine.value.filter(passed));
const chosenTasks = computed(() => cleanTasks(chosen.value.map((task) => ({ text: task.title, ref: task.id }))));
const tasksFull = computed(() => chosenTasks.value.length >= TASKS_MAX);
function togglePass(task) {
  const on = passed(task);
  if (!on && tasksFull.value) return;
  choice.value = { ...choice.value, [task.id]: !on };
}

function togglePick(text) {
  picks.value = picks.value.includes(text) ? picks.value.filter((item) => item !== text) : [...picks.value, text];
}

// "Fussy after feeds, Nappy rash. Cream used at 2 PM."
const composedNote = computed(() => {
  const chosen = PICKS.filter((text) => picks.value.includes(text));
  const parts = [];
  if (chosen.length) parts.push(`${chosen.join(", ")}.`);
  const extra = line.value.trim();
  if (extra) parts.push(extra);
  return parts.join(" ").slice(0, NOTE_MAX);
});

async function send() {
  if (sending.value || !hasPartner.value || !householdId.value) return;
  sending.value = true;
  sendError.value = "";
  const handingOver = chosenTasks.value;
  try {
    await sendHandover({ uid: myUid.value }, householdId.value, {
      to: partnerUid.value,
      note: composedNote.value,
      tasks: handingOver,
      periodStart: periodStart.value,
      summary: liveSummary.value,
    });
    picks.value = [];
    line.value = "";
    choice.value = {};
    windowChoice.value = "auto";
    changing.value = false;
    sentText.value = `Handover sent to ${partnerLabel.value}.`;
    now.value = new Date();
    // The tasks now belong to my partner on the checklist too.
    if (rtw) {
      await Promise.all(
        handingOver.map((task) => rtw.updateTask(task.ref, { owner: partnerUid.value, queued: false })),
      );
    }
  } catch (cause) {
    console.error("[app handover]", cause?.code, cause);
    sendError.value = "We could not send the handover. Check your connection and try again.";
  } finally {
    sending.value = false;
  }
}

function retry() {
  shared.retry();
}

// The live summary counts a sleep that is still going, so the clock ticks once a minute.
let clockTimer = null;
onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 60000);
});
onBeforeUnmount(() => clearInterval(clockTimer));
</script>

<template>
  <div class="ho">
    <div aria-live="polite">
      <p v-if="loading" class="ho__status">Loading the handover...</p>
    </div>

    <div v-if="!loading && error" class="ho__error alert alert-danger" role="alert">
      <p class="mb-0">{{ error }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="reload">Try again</button>
    </div>

    <template v-if="!loading && !error">
      <header class="ho__head">
        <h1 class="nt-title ho__title">Handover</h1>
        <p class="ho__sub">Pass the shift on with a short note for {{ partnerLabel }}.</p>
      </header>

      <div aria-live="polite">
        <p v-if="listLoading" class="ho__status">Loading the handover...</p>
        <p v-if="acceptedText" class="ho__status">{{ acceptedText }}</p>
        <p v-if="sentText" class="ho__status">{{ sentText }}</p>
      </div>

      <div v-if="!listLoading && listErrorInfo" class="ho__error alert alert-danger" role="alert">
        <div>
          <p class="mb-0">{{ listErrorInfo.text }}</p>
          <p v-if="listErrorInfo.detail" class="ho__muted">{{ listErrorInfo.detail }}</p>
        </div>
        <button type="button" class="btn btn-outline btn-sm" @click="retry">Try again</button>
      </div>

      <div v-if="!listLoading && !listErrorInfo" class="ho__cols">
        <div class="ho__main">
        <!-- Waiting for me: read it, then accept it. -->
        <section v-if="received" class="ho__panel ho__card" aria-labelledby="ho-received">
          <h2 id="ho-received" class="ho__panel-title">{{ received.heading }}</h2>
          <p class="ho__muted">{{ received.window }}</p>

          <ul class="ho__stats" aria-label="What happened this shift">
            <li v-for="block in received.blocks" :key="block.key">
              <span class="ho__stat-value">{{ block.value }}</span>
              <span class="ho__stat-label">{{ block.label }}</span>
            </li>
          </ul>

          <p v-if="received.note" class="ho__note">{{ received.note }}</p>
          <p v-else class="ho__muted">No note was left.</p>

          <p v-if="received.needsAttention" class="ho__attention">
            <span class="ho__attention-label">Needs attention</span>
            <span>{{ received.attentionNote || "Read this before you take over." }}</span>
          </p>

          <template v-if="received.nextUp.length">
            <h3 class="ho__sub-title">Coming up</h3>
            <ul class="ho__list">
              <li v-for="item in received.nextUp" :key="item">{{ item }}</li>
            </ul>
          </template>

          <template v-if="received.tasks.length">
            <h3 class="ho__sub-title">Tasks for you</h3>
            <HandoverTasks
              :tasks="received.tasks"
              editable
              :busy="ticking"
              label="Tasks for you"
              @toggle="toggleChecklist($event)"
            />
          </template>

          <p v-if="acceptError" class="ho__row-error" role="alert">{{ acceptError }}</p>
          <div class="ho__actions">
            <button type="button" class="btn btn-primary" :disabled="accepting" @click="accept">
              {{ accepting ? "Accepting..." : "Accept handover" }}
            </button>
          </div>
        </section>

        <!-- Nothing waiting for me: send the shift on. -->
        <section v-else class="ho__panel ho__card" aria-labelledby="ho-send">
          <div class="ho__card-head">
            <span class="ho__icon-sq" aria-hidden="true"><Icon name="handover" :size="18" /></span>
            <div class="ho__card-titles">
              <p class="ho__card-kicker">Write a handover</p>
              <h2 id="ho-send" class="ho__panel-title">{{ sinceLine }}</h2>
            </div>
            <button
              type="button"
              class="app-textbtn ho__change"
              :aria-expanded="changing ? 'true' : 'false'"
              aria-controls="ho-window"
              @click="changing = !changing"
            >
              Change
            </button>
          </div>

          <div v-if="changing" id="ho-window" class="ho__window" role="group" aria-label="Start of the summary">
            <button
              v-for="choice in windowChoices"
              :key="choice.key"
              type="button"
              class="ho__pick"
              :aria-pressed="windowChoice === choice.key ? 'true' : 'false'"
              @click="chooseWindow(choice.key)"
            >
              {{ choice.label }}
            </button>
          </div>

          <ul class="ho__stats ho__stats--live" aria-label="This shift so far">
            <li v-for="block in liveBlocks" :key="block.key">
              <span class="ho__stat-value">{{ block.value }}</span>
              <span class="ho__stat-label">{{ block.label }}</span>
            </li>
          </ul>

          <div class="ho__field">
            <h3 id="ho-picks-title" class="ho__sub-title">Anything {{ partnerLabel }} should know?</h3>
            <p class="ho__muted">Tap what applies. Optional.</p>
            <div class="ho__picks" role="group" aria-labelledby="ho-picks-title">
              <button
                v-for="text in PICKS"
                :key="text"
                type="button"
                class="ho__pick"
                :aria-pressed="picks.includes(text) ? 'true' : 'false'"
                @click="togglePick(text)"
              >
                {{ text }}
              </button>
            </div>
            <label class="visually-hidden" for="ho-line">One more thing for {{ partnerLabel }}</label>
            <input
              id="ho-line"
              v-model="line"
              type="text"
              class="app-control"
              :maxlength="LINE_MAX"
              placeholder="One more thing? e.g. cream used at 2 PM"
            />
          </div>

          <div class="ho__field ho__rule">
            <div class="ho__tasks-head">
              <h3 id="ho-tasks-title" class="ho__sub-title">Tasks to pass on to {{ partnerLabel }}</h3>
              <RouterLink :to="ROUTES.CHECKLIST" class="app-link">Open checklist</RouterLink>
            </div>
            <template v-if="openMine.length">
              <p class="ho__muted">Tick the ones {{ partnerLabel }} should take over. Unticked tasks stay with you.</p>
              <ul class="ho__tasklist" aria-labelledby="ho-tasks-title">
                <li v-for="task in openMine" :key="task.id" class="ho__task">
                  <label class="ho__task-label">
                    <input
                      type="checkbox"
                      class="ho__task-box"
                      :checked="passed(task)"
                      :disabled="tasksFull && !passed(task)"
                      @change="togglePass(task)"
                    />
                    <span>{{ task.title }}</span>
                  </label>
                  <span class="ho__task-source">{{ [dueLabel(task, now), task.queued ? "Queued on the checklist" : ""].filter(Boolean).join(". ") }}</span>
                </li>
              </ul>
            </template>
            <p v-else class="ho__muted">You have no open tasks. Add some on the checklist and they will show here.</p>
          </div>

          <p v-if="!hasPartner" class="ho__muted ho__no-partner">
            Invite your partner from Today to send a handover.
          </p>
          <p v-if="sendError" class="ho__row-error" role="alert">{{ sendError }}</p>
          <div class="ho__actions ho__foot">
            <button type="button" class="btn btn-primary" :disabled="sending || !hasPartner" @click="send">
              {{ sending ? "Sending..." : `Send to ${partnerLabel}` }}
            </button>
            <p class="ho__muted ho__foot-note">{{ partnerLabel }} will be asked to accept it.</p>
          </div>
        </section>

        </div>

        <!-- Last handover -->
        <section class="ho__history ho__card" aria-labelledby="ho-last">
          <h2 id="ho-last" class="ho__h2">Last handover</h2>
          <div v-if="!last" class="ho__empty">
            <Icon name="clock" :size="20" />
            <p class="ho__muted ho__none">No handovers yet.</p>
          </div>
          <div v-else class="ho__last">
            <p class="ho__row-time">
              <Icon :name="last.accepted ? 'check' : 'clock'" :size="16" />
              {{ last.when }}
            </p>
            <p class="ho__row-who">{{ last.who }}</p>
            <p class="ho__row-meta">{{ last.status }}</p>
            <p class="ho__row-meta">{{ last.summary }}</p>
            <p v-if="last.note" class="ho__last-note">{{ last.note }}</p>
            <p v-else class="ho__muted">No note was left.</p>
            <template v-if="last.tasks.length">
              <h3 class="ho__sub-title ho__last-tasks">
                {{ last.mine ? "Tasks for you" : "Tasks you handed over" }}
                <span class="ho__muted">{{ last.progress.label }}</span>
              </h3>
              <HandoverTasks
                :tasks="last.tasks"
                :editable="last.mine"
                :busy="ticking"
                :label="last.mine ? 'Tasks for you' : 'Tasks you handed over'"
                @toggle="toggleChecklist($event)"
              />
              <p v-if="tickError" class="ho__row-error" role="alert">{{ tickError }}</p>
            </template>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ho { display: flex; flex-direction: column; gap: 24px; margin: 0; font-size: 1rem; }
.ho__status { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.ho__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.ho__error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin: 0; font-size: 0.875rem; border-radius: 8px; }

.ho__head { display: flex; flex-direction: column; gap: 8px; }
.ho__title { font-size: 2.5rem; line-height: 1.2; }
.ho__sub { margin: 0; font-size: 1rem; color: var(--nt-muted); }

.ho__cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; align-items: stretch; }
.ho__main { min-width: 0; display: flex; flex-direction: column; }
.ho__main > .ho__card { flex: 1; }
.ho__history { min-width: 0; }

.ho__card { background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; padding: 24px; }
.ho__card-head { display: flex; align-items: center; gap: 12px; }
.ho__change { margin-left: auto; align-self: flex-start; }
.ho__icon-sq { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; border-radius: 8px; background: var(--nt-apricot); color: var(--nt-plum); }
.ho__card-titles { min-width: 0; }
.ho__window { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.ho__picks { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.ho__pick { min-height: 44px; padding: 8px 12px; font-family: inherit; font-size: 0.875rem; line-height: 1.3; color: var(--nt-ink); background: #fff; border: 1px solid var(--nt-line); border-radius: 8px; cursor: pointer; transition: border-color 0.15s, background-color 0.15s; }
.ho__pick:hover { border-color: var(--nt-muted); }
.ho__pick[aria-pressed="true"] { border-color: var(--nt-plum); background: var(--nt-apricot); font-weight: 600; }
.ho__pick:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.ho__card-kicker { margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.3; color: var(--nt-ink); }

.ho__panel { display: flex; flex-direction: column; gap: 20px; }
.ho__panel-title { margin: 0; font-size: 0.875rem; font-weight: 400; line-height: 1.3; color: var(--nt-muted); }
#ho-received.ho__panel-title { font-size: 1.125rem; font-weight: 600; color: var(--nt-ink); }
.ho__h2 { margin: 0 0 12px; font-size: 1.125rem; font-weight: 600; line-height: 1.3; color: var(--nt-ink); }
.ho__sub-title { margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.3; color: var(--nt-ink); }
.ho__rule { padding-top: 20px; border-top: 1px solid var(--nt-line); }

.ho__stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 16px; margin: 0; padding: 0 0 20px; list-style: none; border-bottom: 1px solid var(--nt-line); }
.ho__stats li { display: flex; flex-direction: column; gap: 2px; font-size: 0.875rem; color: var(--nt-muted); }
.ho__stat-value { font-size: 1.75rem; font-weight: 600; line-height: 1.15; color: var(--nt-ink); }
.ho__stat-label { font-size: 0.875rem; color: var(--nt-muted); }

.ho__note { margin: 0; font-size: 1rem; line-height: 1.5; color: var(--nt-ink); overflow-wrap: anywhere; }
.ho__attention { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin: 0; padding-left: 12px; border-left: 2px solid var(--nt-coral); font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); }
.ho__attention-label { font-weight: 600; color: var(--nt-coral); }

.ho__list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.ho__list li { padding: 8px 0; border-bottom: 1px solid var(--nt-line); font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); }

.ho__field { display: flex; flex-direction: column; gap: 8px; }
.ho__label { font-size: 0.875rem; font-weight: 500; color: var(--nt-ink); }


.ho__no-partner { max-width: 48ch; }

.ho__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.ho__foot { margin-top: auto; align-items: center; gap: 16px; padding-top: 20px; border-top: 1px solid var(--nt-line); }
.ho__foot-note { flex: 1; min-width: 160px; }
.ho__last { display: flex; flex-direction: column; gap: 4px; }
.ho__tasks-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.ho__tasklist { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.ho__task { display: flex; flex-direction: column; gap: 2px; padding: 10px 0; border-bottom: 1px solid var(--nt-line); }
.ho__task-label { display: flex; align-items: flex-start; gap: 10px; font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); cursor: pointer; }
.ho__task-box { flex: none; width: 18px; height: 18px; margin: 2px 0 0; accent-color: var(--nt-plum); cursor: pointer; }
.ho__task-box:disabled { cursor: not-allowed; }
.ho__task-box:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.ho__task-source { padding-left: 28px; font-size: 0.875rem; color: var(--nt-muted); }
.ho__last-tasks { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: 16px; }
.ho__last-note { margin: 8px 0 0; font-size: 1rem; line-height: 1.5; color: var(--nt-ink); overflow-wrap: anywhere; }
.ho__row-error { margin: 0; font-size: 0.875rem; color: var(--nt-coral); }

.ho__history { display: flex; flex-direction: column; }
.ho__empty { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 24px 0; color: var(--nt-muted); }
.ho__none { padding: 0; }
.ho__row-time { display: inline-flex; align-items: center; gap: 6px; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); white-space: nowrap; }
.ho__row-who { margin: 0; font-size: 0.875rem; font-weight: 600; line-height: 1.45; color: var(--nt-ink); }
.ho__row-meta { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }

@media (min-width: 1100px) {
  .ho__cols { grid-template-columns: minmax(0, 1fr) 380px; }
}
@media (max-width: 991px) {
  .ho__title { font-size: 2rem; }
}
@media (max-width: 575px) {
  .ho__card { padding: 20px 16px; }
    }
</style>
