<script setup>
import "@/app/app.css";
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppLink from "@/components/ui/AppLink.vue";
import Icon from "@/app/components/Icon.vue";
import { acceptHandover } from "@/api/handovers";
import { ownerUid } from "@/app/utils/sharedHelpers";
import { buildStream, groupByDay, firstNameOf } from "@/app/utils/stream";
import { agoText, dutyTonight, nextUp, todaySummary } from "@/app/utils/homeSummary";
import { formatMinutes, formatTime as clockTime } from "@/app/utils/entryHelpers";
import { displayName, useHome, HOME_KEY } from "@/app/composables/useHome";
import { useEntries, ENTRIES_KEY } from "@/app/composables/useEntries";
import { useHandovers, HANDOVERS_KEY } from "@/app/composables/useHandovers";
import { usePrefs } from "@/app/composables/usePrefs";
import { useShared, SHARED_KEY } from "@/app/composables/useShared";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "HomePage" });

// The layout loads the household, the care log, the handovers and the shared stores once and
// provides them. Fall back to loading here so the page also works when rendered on its own.
const home = inject(HOME_KEY, null) ?? useHome();
const { loading, error, reload, me, partner, inviteCode, householdId } = home;
const myUid = computed(() => me.value.uid);
const partnerUid = computed(() => partner.value?.uid ?? "");
const entriesShared = inject(ENTRIES_KEY, null) ?? useEntries(householdId);
const handoversShared = inject(HANDOVERS_KEY, null) ?? useHandovers(householdId, myUid);
const shared = inject(SHARED_KEY, null) ?? useShared(householdId, myUid, partnerUid);
const posts = shared.posts;
const rtw = shared.rtw;

const router = useRouter();
const { formatTime } = usePrefs();

const now = ref(new Date());
let clock = null;
onMounted(() => {
  clock = setInterval(() => {
    now.value = new Date();
  }, 60000);
  document.addEventListener("click", onDocumentClick);
});
onBeforeUnmount(() => {
  clearInterval(clock);
  document.removeEventListener("click", onDocumentClick);
});

// Header
const greeting = computed(() => {
  const hour = now.value.getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
});
const dateText = computed(() => {
  const weekday = now.value.toLocaleDateString("en-GB", { weekday: "long" });
  const month = now.value.toLocaleDateString("en-GB", { month: "long" });
  return `${weekday}, ${now.value.getDate()} ${month}`;
});
const myName = computed(() => displayName(me.value.firstName));
const partnerFirst = computed(() => (partner.value ? displayName(partner.value.firstName) : ""));
const showInvite = computed(() => !partner.value && Boolean(inviteCode.value));

// The stream
const members = computed(() => {
  const list = [{ uid: me.value.uid, displayName: me.value.displayName || me.value.firstName }];
  if (partner.value) list.push({ uid: partner.value.uid, displayName: partner.value.displayName || partner.value.firstName });
  return list;
});
const items = computed(() =>
  buildStream({
    posts: posts.posts,
    entries: entriesShared.entries.value,
    handovers: handoversShared.handovers.value,
    tasks: rtw.tasks,
    uid: myUid.value,
    members: members.value,
    now: now.value,
  }),
);
const groups = computed(() => groupByDay(items.value, now.value));
const streamLoading = computed(() => !householdId.value || posts.loading || entriesShared.loading.value);
const streamError = computed(() => posts.errorInfo);

function metaLine(item) {
  const who = `${item.authorName}, ${formatTime(item.at)}`;
  return item.kindLabel ? `${who} · ${item.kindLabel}` : who;
}
function seenLine(item) {
  return item.ackedByNames.length ? `Seen by ${item.ackedByNames.join(" and ")}` : "";
}

// Tonight: who is on night duty, from the shared rota the shell already binds. Nothing here
// binds a store. While the rota is loading or unreadable the card stays out of the way.
const rotaStore = computed(() => shared.rota ?? null);
const dutyReady = computed(() => !rotaStore.value || (!rotaStore.value.loading && !rotaStore.value.error));
const duty = computed(() => {
  const rota = rotaStore.value;
  const hasRota = Boolean(rota?.settings);
  return dutyTonight({
    rotaSettings: hasRota ? rota.settings : null,
    view: hasRota ? rota.view : null,
    now: now.value,
    uid: myUid.value,
    members: members.value,
  });
});

// Today at a glance, from the shared care log, calendar and return to work tasks.
const entriesFailed = computed(() => Boolean(entriesShared.error?.value));
const summary = computed(() => todaySummary({ entries: entriesShared.entries.value, now: now.value }));
const lastFeed = computed(() =>
  summary.value.lastFeedAt ? `${clockTime(summary.value.lastFeedAt)}, ${agoText(summary.value.lastFeedAt, now.value)}` : "",
);
const upNext = computed(() =>
  nextUp({
    events: shared.calendar?.events ?? [],
    tasks: rtw.tasks,
    handoverTime: shared.rota?.settings ? shared.rota.view.handoverTime : null,
    now: now.value,
  }),
);
const countRows = computed(() => [
  { key: "feeds", label: "Feeds", value: summary.value.feeds ? String(summary.value.feeds) : "None" },
  { key: "sleep", label: "Sleep total", value: summary.value.sleepMinutes ? formatMinutes(summary.value.sleepMinutes) : "None" },
  { key: "nappies", label: "Nappies", value: summary.value.nappies ? String(summary.value.nappies) : "None" },
]);

// Composer
const text = ref("");
const announcement = ref("");
const sending = ref(false);
const input = ref(null);
const plusButton = ref(null);
const menuOpen = ref(false);
const menuEl = ref(null);
const composerEl = ref(null);
const MENU = [
  { key: "feed", label: "Log feed" },
  { key: "sleep", label: "Log sleep" },
  { key: "nappy", label: "Log nappy" },
  { key: "medication", label: "Medicine" },
  { key: "task", label: "Add a task" },
  { key: "handover", label: "Send handover" },
];

function announce(message) {
  announcement.value = "";
  nextTick(() => {
    announcement.value = message;
  });
}

async function send() {
  const body = text.value.trim();
  if (!body || sending.value) return;
  sending.value = true;
  const ok = await posts.send(body);
  sending.value = false;
  if (ok) {
    text.value = "";
    announce("Message sent");
    input.value?.focus();
  }
}

function menuItems() {
  return Array.from(menuEl.value?.querySelectorAll('[role="menuitem"]') ?? []);
}
async function openMenu(focusIndex = 0) {
  menuOpen.value = true;
  await nextTick();
  const list = menuItems();
  list[focusIndex === -1 ? list.length - 1 : focusIndex]?.focus();
}
function closeMenu({ restoreFocus = false } = {}) {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  if (restoreFocus) plusButton.value?.focus();
}
function toggleMenu() {
  if (menuOpen.value) closeMenu();
  else openMenu(0);
}
function onPlusKeydown(event) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    openMenu(0);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    openMenu(-1);
  } else if (event.key === "Escape") {
    closeMenu({ restoreFocus: true });
  }
}
function onMenuKeydown(event) {
  const list = menuItems();
  const at = list.indexOf(document.activeElement);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    list[(at + 1) % list.length]?.focus();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    list[(at - 1 + list.length) % list.length]?.focus();
  } else if (event.key === "Home") {
    event.preventDefault();
    list[0]?.focus();
  } else if (event.key === "End") {
    event.preventDefault();
    list[list.length - 1]?.focus();
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeMenu({ restoreFocus: true });
  } else if (event.key === "Tab") {
    closeMenu();
  }
}
function onDocumentClick(event) {
  if (menuOpen.value && composerEl.value && !composerEl.value.contains(event.target)) closeMenu();
}
function choose(key) {
  closeMenu();
  if (key === "task") {
    openTask();
  } else if (key === "handover") {
    router.push(ROUTES.HANDOVER);
  } else {
    router.push({ path: ROUTES.CARE_LOG, query: { log: key } });
  }
}

// Add a task
const taskOpen = ref(false);
const taskTitle = ref("");
const taskWho = ref("both");
const taskDue = ref("");
const taskError = ref("");
const taskSaving = ref(false);
const taskInput = ref(null);

async function openTask() {
  taskOpen.value = true;
  taskError.value = "";
  await nextTick();
  taskInput.value?.focus();
}
function closeTask() {
  taskOpen.value = false;
  taskTitle.value = "";
  taskWho.value = "both";
  taskDue.value = "";
  taskError.value = "";
  nextTick(() => plusButton.value?.focus());
}
async function saveTask() {
  const title = taskTitle.value.trim();
  if (!title) {
    taskError.value = "Add a title for the task.";
    return;
  }
  taskSaving.value = true;
  const saved = await rtw.addTask({
    title,
    owner: ownerUid(taskWho.value, myUid.value, partnerUid.value) || "both",
    due: taskDue.value || null,
  });
  taskSaving.value = false;
  if (!saved) {
    taskError.value = rtw.writeError || "We could not add the task. Try again.";
    return;
  }
  closeTask();
  announce("Task added");
}

// Item actions
const actionError = ref("");
async function gotIt(item) {
  actionError.value = "";
  if (item.kind === "handover") {
    try {
      await acceptHandover(householdId.value, item.rawId, myUid.value);
    } catch (cause) {
      console.error("[app handover]", cause?.code, cause);
      actionError.value = "We could not save that. Check your connection and try again.";
    }
    return;
  }
  if (!(await posts.ack(item.rawId))) actionError.value = posts.writeError;
}
async function markDone(item) {
  actionError.value = "";
  if (!(await rtw.toggleTask(item.rawId))) actionError.value = rtw.writeError;
}
async function removePost(item) {
  actionError.value = "";
  if (await posts.remove(item.rawId)) announce("Message deleted");
  else actionError.value = posts.writeError;
}

const copied = ref(false);
let copiedTimer = null;
async function copyCode() {
  try {
    await navigator.clipboard.writeText(inviteCode.value);
    copied.value = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Clipboard can be blocked; the code stays visible to copy by hand.
  }
}
onBeforeUnmount(() => clearTimeout(copiedTimer));
</script>

<template>
  <div class="hp">
    <div aria-live="polite">
      <p v-if="loading" class="hp__status">Loading your household...</p>
    </div>

    <div v-if="!loading && error" class="hp__error alert alert-danger" role="alert">
      <p class="mb-0">{{ error }}</p>
      <AppButton variant="outline" size="sm" @click="reload">Try again</AppButton>
    </div>

    <template v-if="!loading && !error">
      <header class="hp__head">
        <h1 class="nt-title hp__title">Home</h1>
        <p class="hp__sub">Good {{ greeting }}, {{ myName }}. {{ dateText }}</p>
      </header>

      <div class="hp__grid">
      <div class="hp__top">
      <div v-if="showInvite" class="hp__invite" role="status">
        <p class="hp__invite-text">
          Invite your partner with code <strong>{{ inviteCode }}</strong>
        </p>
        <button type="button" class="hp__text-btn" @click="copyCode">{{ copied ? "Copied" : "Copy code" }}</button>
      </div>

      <div ref="composerEl" class="hp__composer">
        <form class="hp__field" @submit.prevent="send">
          <input
            ref="input"
            v-model="text"
            class="hp__input"
            type="text"
            maxlength="500"
            autocomplete="off"
            aria-label="Message, log, or add a task"
            placeholder="Message, log, or add a task..."
          />
          <button v-if="text.trim()" type="submit" class="hp__send" :disabled="sending">Send</button>
          <button
            ref="plusButton"
            type="button"
            class="hp__plus"
            aria-label="More actions"
            aria-haspopup="menu"
            :aria-expanded="menuOpen ? 'true' : 'false'"
            aria-controls="hp-menu"
            @click="toggleMenu"
            @keydown="onPlusKeydown"
          >
            <Icon name="plus" :size="20" />
          </button>
        </form>

        <ul v-if="menuOpen" id="hp-menu" ref="menuEl" class="hp__menu" role="menu" aria-label="More actions" @keydown="onMenuKeydown">
          <li v-for="entry in MENU" :key="entry.key" role="none">
            <button type="button" class="hp__menu-item" role="menuitem" tabindex="-1" @click="choose(entry.key)">
              {{ entry.label }}
            </button>
          </li>
        </ul>
      </div>

      <p v-if="posts.writeError" class="hp__problem" role="alert">{{ posts.writeError }}</p>
      <p v-if="actionError" class="hp__problem" role="alert">{{ actionError }}</p>
      <p class="visually-hidden" aria-live="polite" role="status">{{ announcement }}</p>

      <form v-if="taskOpen" class="hp__task" aria-label="Add a task" @submit.prevent="saveTask">
        <label class="hp__task-label">
          <span>Task</span>
          <input ref="taskInput" v-model="taskTitle" class="hp__task-input" type="text" maxlength="120" autocomplete="off" />
        </label>
        <fieldset class="hp__who">
          <legend>Who</legend>
          <label><input v-model="taskWho" type="radio" name="hp-who" value="me" /> You</label>
          <label v-if="partner"><input v-model="taskWho" type="radio" name="hp-who" value="partner" /> {{ partnerFirst }}</label>
          <label><input v-model="taskWho" type="radio" name="hp-who" value="both" /> Both</label>
        </fieldset>
        <label class="hp__task-label">
          <span>Due (optional)</span>
          <input v-model="taskDue" class="hp__task-input hp__task-input--date" type="date" />
        </label>
        <p v-if="taskError" class="hp__problem" role="alert">{{ taskError }}</p>
        <div class="hp__task-actions">
          <button type="submit" class="hp__text-btn" :disabled="taskSaving">Add task</button>
          <button type="button" class="hp__text-btn hp__text-btn--muted" @click="closeTask">Cancel</button>
        </div>
      </form>

      </div>

      <div class="hp__rail">
        <section v-if="dutyReady" class="hp__card" aria-labelledby="hp-duty-title">
          <div class="hp__duty">
            <span class="hp__moon" :class="`hp__moon--${duty.tone}`" aria-hidden="true"><Icon name="moon" :size="18" /></span>
            <div class="hp__duty-body">
              <h2 id="hp-duty-title" class="hp__card-title">{{ duty.title }}</h2>
              <p class="hp__muted">{{ duty.line }}</p>
              <AppLink class="hp__link" :to="ROUTES.ROTA">{{ duty.link }}</AppLink>
            </div>
          </div>
        </section>

        <section class="hp__card" aria-labelledby="hp-glance-title">
          <h2 id="hp-glance-title" class="hp__card-title">Today at a glance</h2>
          <p v-if="entriesFailed" class="hp__muted">The care log could not be read yet.</p>
          <template v-else>
            <dl class="hp__rows">
              <div v-for="row in countRows" :key="row.key" class="hp__row">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            </dl>
            <div class="hp__block">
              <p class="hp__label">Last feed</p>
              <p v-if="lastFeed" class="hp__big">{{ lastFeed }}</p>
              <p v-else class="hp__muted">No feeds logged today</p>
            </div>
            <div class="hp__block">
              <p class="hp__label">Next up</p>
              <template v-if="upNext">
                <p class="hp__big">{{ upNext.title }}</p>
                <p class="hp__muted">{{ upNext.when }}</p>
              </template>
              <p v-else class="hp__muted">Nothing coming up</p>
            </div>
          </template>
          <AppLink class="hp__link" :to="ROUTES.CARE_LOG">Open care log</AppLink>
        </section>
      </div>

      <div class="hp__lower">
      <section class="hp__stream" aria-label="Household stream">
        <p v-if="streamLoading" class="hp__status">Loading...</p>
        <div v-else-if="streamError" class="hp__notice" role="alert">
          <p class="hp__muted">{{ streamError.text }}</p>
          <p v-if="streamError.detail" class="hp__muted">{{ streamError.detail }}</p>
        </div>
        <div v-else-if="!groups.length" class="hp__empty">
          <Icon name="note" :size="20" />
          <p class="hp__muted">Nothing here yet. Post a message or log something.</p>
        </div>

        <template v-else>
        <div v-for="group in groups" :key="group.key" class="hp__group">
          <h2 class="hp__day">{{ group.label }}</h2>
          <ul class="hp__list">
            <li v-for="item in group.items" :key="item.id" class="hp__item">
              <p class="hp__meta">{{ metaLine(item) }}</p>
              <p class="hp__text">{{ item.text }}</p>
              <template v-if="item.kind === 'handover'">
                <p v-if="item.meta.counts" class="hp__meta">{{ item.meta.counts }}</p>
                <p v-if="item.meta.needsAttention" class="hp__attention">
                  Needs attention{{ item.meta.attentionNote ? `: ${item.meta.attentionNote}` : "" }}
                </p>
              </template>

              <div class="hp__actions">
                <template v-if="item.kind === 'message' || item.kind === 'handover'">
                  <button v-if="item.needsAck && !item.acked" type="button" class="hp__text-btn" @click="gotIt(item)">Got it</button>
                  <span v-else-if="seenLine(item)" class="hp__seen">{{ seenLine(item) }}</span>
                </template>
                <template v-else-if="item.kind === 'task'">
                  <button v-if="!item.done" type="button" class="hp__text-btn" @click="markDone(item)">Done</button>
                  <span v-else class="hp__seen">Completed</span>
                </template>
                <button
                  v-if="item.kind === 'message' && item.isMine"
                  type="button"
                  class="hp__text-btn hp__text-btn--muted hp__delete"
                  @click="removePost(item)"
                >
                  Delete
                </button>
              </div>
            </li>
          </ul>
        </div>
        </template>
      </section>

      <p class="hp__checkin">
        <span>How are you holding up?</span>
        <AppLink class="hp__link" :to="ROUTES.WELLNESS">Check in privately</AppLink>
      </p>
      </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hp { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 1100px; font-size: 1rem; }
.hp__status { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.hp__error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin: 0; font-size: 0.875rem; border-radius: 8px; }

.hp__head { display: flex; flex-direction: column; gap: 8px; }
.hp__title { font-size: 2.5rem; line-height: 1.2; }
.hp__sub { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }

.hp__invite { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 8px 16px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 8px; }
.hp__invite-text { margin: 0; font-size: 0.875rem; color: var(--nt-ink); }
.hp__invite-text strong { font-weight: 600; }

.hp__composer { position: relative; }
.hp__field { display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 8px 0 16px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 12px; }
.hp__field:focus-within { border-color: var(--nt-plum); outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.hp__input { flex: 1; min-width: 0; height: 100%; border: 0; background: transparent; font-family: inherit; font-size: 1rem; color: var(--nt-ink); }
.hp__input:focus { outline: none; }
.hp__input::placeholder { color: var(--nt-muted); }
.hp__send { flex: none; height: 36px; padding: 0 14px; background: var(--nt-plum); border: 1px solid var(--nt-plum); border-radius: 8px; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: #fff; cursor: pointer; }
.hp__send:hover { background: var(--nt-plum-hover); }
.hp__send:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.hp__send:disabled { opacity: 0.6; cursor: default; }
.hp__plus { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: transparent; border: 0; border-radius: 8px; color: var(--nt-plum); cursor: pointer; }
.hp__plus:hover { background: var(--nt-gray); }
.hp__plus:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.hp__menu { position: absolute; top: calc(100% + 4px); right: 0; z-index: 10; min-width: 200px; margin: 0; padding: 4px; list-style: none; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 12px; }
.hp__menu-item { display: block; width: 100%; padding: 10px 12px; background: transparent; border: 0; border-radius: 8px; font-family: inherit; font-size: 0.875rem; text-align: left; color: var(--nt-ink); cursor: pointer; }
.hp__menu-item:hover, .hp__menu-item:focus { background: var(--nt-gray); }
.hp__menu-item:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: -2px; }

.hp__problem { margin: 0; font-size: 0.875rem; color: var(--nt-coral); }

.hp__task { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 12px; }
.hp__task-label { display: flex; flex-direction: column; gap: 4px; font-size: 0.875rem; color: var(--nt-muted); }
.hp__task-input { height: 40px; padding: 0 12px; border: 1px solid var(--nt-line); border-radius: 8px; font-family: inherit; font-size: 1rem; color: var(--nt-ink); background: var(--nt-white); }
.hp__task-input--date { max-width: 200px; }
.hp__task-input:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.hp__who { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; margin: 0; padding: 0; border: 0; font-size: 0.875rem; color: var(--nt-ink); }
.hp__who legend { float: none; width: auto; margin: 0 0 4px; padding: 0; font-size: 0.875rem; color: var(--nt-muted); }
.hp__who label { display: inline-flex; align-items: center; gap: 6px; }
.hp__task-actions { display: flex; gap: 16px; }

.hp__grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.hp__top, .hp__lower { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.hp__rail { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
@media (min-width: 1100px) {
  .hp__grid { grid-template-columns: minmax(0, 1fr) 340px; grid-template-areas: "top rail" "lower rail"; column-gap: 24px; }
  .hp__top { grid-area: top; }
  .hp__lower { grid-area: lower; }
  .hp__rail { grid-area: rail; align-self: start; }
}

.hp__card { display: flex; flex-direction: column; gap: 12px; padding: 20px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 12px; }
.hp__card-title { margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 1rem; font-weight: 600; line-height: 1.3; color: var(--nt-ink); }
.hp__duty { display: flex; align-items: flex-start; gap: 12px; }
.hp__duty-body { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
.hp__moon { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: var(--nt-gray); color: var(--nt-ink); }
.hp__moon--partner { background: #dce6f2; }
.hp__moon--you { background: #f6d8c6; }
.hp__card .hp__link { align-self: flex-start; }
.hp__rows { margin: 0; }
.hp__row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--nt-line); font-size: 1rem; color: var(--nt-ink); }
.hp__row:first-child { border-top: 0; padding-top: 0; }
.hp__row dt { font-weight: 400; color: var(--nt-muted); }
.hp__row dd { margin: 0; font-weight: 500; color: var(--nt-ink); }
.hp__block { display: flex; flex-direction: column; gap: 2px; padding-top: 12px; border-top: 1px solid var(--nt-line); }
.hp__label { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.hp__big { margin: 0; font-size: 1rem; line-height: 1.4; color: var(--nt-ink); overflow-wrap: anywhere; }
.hp__notice { padding: 16px; border: 1px solid var(--nt-line); border-radius: 12px; background: var(--nt-white); display: flex; flex-direction: column; gap: 4px; }
.hp__empty { display: flex; align-items: center; gap: 12px; padding: 20px; border: 1px solid var(--nt-line); border-radius: 12px; background: var(--nt-white); color: var(--nt-muted); }

.hp__text-btn { padding: 0; background: none; border: 0; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-plum); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.hp__text-btn:hover { color: var(--nt-plum-hover); }
.hp__text-btn:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
.hp__text-btn:disabled { opacity: 0.6; cursor: default; }
.hp__text-btn--muted { color: var(--nt-muted); }

.hp__stream { display: flex; flex-direction: column; gap: 24px; margin-top: 8px; }
.hp__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.hp__group { display: flex; flex-direction: column; gap: 4px; }
.hp__day { margin: 0; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-muted); }
.hp__list { margin: 0; padding: 0; list-style: none; }
.hp__item { padding: 14px 0; border-top: 1px solid var(--nt-line); }
.hp__meta { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.hp__text { margin: 2px 0 0; font-size: 1rem; line-height: 1.5; color: var(--nt-ink); overflow-wrap: anywhere; }
.hp__attention { margin: 2px 0 0; font-size: 0.875rem; color: var(--nt-coral); }
.hp__actions { display: flex; align-items: center; gap: 16px; margin-top: 6px; }
.hp__actions:empty { display: none; }
.hp__seen { font-size: 0.875rem; color: var(--nt-muted); }
.hp__delete { opacity: 0; }
.hp__item:hover .hp__delete, .hp__item:focus-within .hp__delete { opacity: 1; }
@media (hover: none) { .hp__delete { opacity: 1; } }

.hp__checkin { margin: 16px 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 0.875rem; color: var(--nt-muted); }
.hp__link, .hp__link:visited { font-size: 0.875rem; font-weight: 500; color: var(--nt-plum); text-decoration: underline; text-underline-offset: 3px; }
.hp__link:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }

@media (max-width: 991px) {
  .hp__title { font-size: 2rem; }
}
</style>
