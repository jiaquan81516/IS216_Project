<script setup>
import BabySwitch from "@/app/components/BabySwitch.vue";
import { useToast } from "@/app/composables/useToast";
import SkeletonList from "@/app/components/SkeletonList.vue";
import LoadingScreen from "@/app/components/LoadingScreen.vue";
import "@/app/app.css";
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppBadge from "@/components/ui/AppBadge.vue";
import CareLogPanel from "@/app/components/CareLogPanel.vue";
import Icon from "@/app/components/Icon.vue";
import { addEntry, deleteEntry, loadOlder, markSeen, updateEntry } from "@/api/entries";
import { notifyPartner } from "@/api/push";
import { isNightHour } from "@/app/utils/loadHelpers";
import {
  describeEntriesError,
  ENTRY_TYPES,
  formatMinutes,
  groupByDay,
  lastFeedHeading,
  lastOfType,
  summariseEntry,
  toDate,
  todayStats,
} from "@/app/utils/entryHelpers";
import { displayName, useHome, HOME_KEY } from "@/app/composables/useHome";
import { ENTRIES_PAGE_SIZE, useEntries, ENTRIES_KEY } from "@/app/composables/useEntries";
import { usePrefs } from "@/app/composables/usePrefs";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";
const { selectedBabyId } = useSelectedBaby();

defineOptions({ name: "CareLogPage" });

const PAGE_SIZE = ENTRIES_PAGE_SIZE;

const home = inject(HOME_KEY, null) ?? useHome();
const { loading, error, reload, me, partner, baby, householdId } = home;

const route = useRoute();
const router = useRouter();

// Times follow the 12h or 24h choice in Settings (Display).
const { formatTime: prefTime } = usePrefs();

const now = ref(new Date());
let clockTimer = null;

// Entries
const shared = inject(ENTRIES_KEY, null) ?? useEntries(householdId);
const live = shared.entries;
const entriesLoading = computed(() => !householdId.value || shared.loading.value);
const entriesErrorInfo = computed(() => (shared.error.value ? describeEntriesError(shared.error.value.code) : null));
const { selectedBaby } = useSelectedBaby();
const babyId = computed(() => selectedBaby.value?.id ?? "primary");

// `older` keeps every baby's older entries, so the "load older" position stays correct.
// Only the selected baby's are shown.
const older = ref([]);
const olderForBaby = computed(() => older.value.filter((e) => (e.babyId ?? "primary") === babyId.value));
const exhausted = ref(false);
const loadingMore = ref(false);
const moreError = ref("");

const allEntries = computed(() => {
  const ids = new Set(live.value.map((e) => e.id));
  const merged = [...live.value, ...olderForBaby.value.filter((e) => !ids.has(e.id))];
  return merged.sort((a, b) => (toDate(b.at)?.getTime() ?? 0) - (toDate(a.at)?.getTime() ?? 0));
});
// Based on the unfiltered list, so the button doesn't depend on how many belong to this baby.
const hasMore = computed(() => !exhausted.value && shared.raw.value.length >= PAGE_SIZE);

const newIds = ref(new Set());
const requested = new Set();

const myUid = computed(() => me.value.uid);
const isMine = (entry) => entry.by === myUid.value;
const hasSeen = (entry) => Object.prototype.hasOwnProperty.call(entry.seenBy ?? {}, myUid.value);

const FILTERS = [
  { key: "all", label: "All" },
  { key: "feed", label: "Feeds" },
  { key: "sleep", label: "Sleep" },
  { key: "nappy", label: "Nappies" },
  { key: "medication", label: "Meds" },
  { key: "note", label: "Notes" },
];
const filter = ref("all");
const groups = computed(() =>
  groupByDay(
    allEntries.value.filter((e) => filter.value === "all" || e.type === filter.value),
    now.value,
  ),
);

const partnerFirst = computed(() => (partner.value ? displayName(partner.value.firstName) : ""));

const myFirst = computed(() => displayName(me.value.firstName));
const sharedBy = computed(() => (partnerFirst.value ? `${myFirst.value} and ${partnerFirst.value}` : myFirst.value));
const todayLabel = computed(() => {
  const d = now.value;
  return `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" })}`;
});
const statusLine = computed(() => (lastFeed.value ? lastFeedTitle.value : "No feeds logged yet"));

function byLabel(entry) {
  if (isMine(entry)) return "you";
  return displayName(entry.byName) || partnerFirst.value || "your partner";
}
function seenByPartner(entry) {
  return Boolean(isMine(entry) && partner.value && entry.seenBy && partner.value.uid in entry.seenBy);
}
function summary(entry) {
  return summariseEntry(entry);
}
function iconOf(entry) {
  return ENTRY_TYPES[entry.type]?.icon ?? "note";
}

// Last feed strip and today stats
const lastFeed = computed(() => lastOfType(allEntries.value, "feed"));
const lastFeedTitle = computed(() => lastFeedHeading(lastFeed.value, now.value));
const lastFeedLine = computed(() => {
  const feed = lastFeed.value;
  if (!feed) return "";
  const d = feed.details ?? {};
  let what = "Feed";
  if (d.method === "breast") what = d.minutes ? `${d.minutes} minutes breastfeeding` : "Breastfeeding";
  else if (d.method === "bottle") what = d.ml ? `${d.ml} ml bottle` : "Bottle";
  else if (d.method === "expressed") what = d.ml ? `${d.ml} ml expressed milk` : "Expressed milk";
  return `${what}, logged by ${byLabel(feed)}`;
});
const stats = computed(() => {
  const s = todayStats(allEntries.value, now.value);
  return [
    { key: "feeds", value: String(s.feeds), label: s.feeds === 1 ? "Feed" : "Feeds" },
    { key: "sleep", value: formatMinutes(s.sleepMinutes), label: "Sleep" },
    { key: "nappies", value: String(s.nappies), label: s.nappies === 1 ? "Nappy" : "Nappies" },
  ];
});

function retry() {
  shared.retry();
}

async function more() {
  const pool = [...shared.raw.value, ...older.value].sort(
  (a, b) => (toDate(b.at)?.getTime() ?? 0) - (toDate(a.at)?.getTime() ?? 0),
  );
  const last = pool[pool.length - 1];
  if (!last || loadingMore.value) return;
  loadingMore.value = true;
  moreError.value = "";
  try {
    const page = await loadOlder(householdId.value, last.at, PAGE_SIZE);
    older.value = [...older.value, ...page];
    if (page.length < PAGE_SIZE) exhausted.value = true;
  } catch (cause) {
    console.error("[app care log]", cause?.code, cause);
    moreError.value = "Could not load older entries. Try again.";
  } finally {
    loadingMore.value = false;
  }
}

// Marking seen. newIds is captured first so the New badge stays for this visit.
function captureNew(list) {
  const additions = list.filter((e) => !isMine(e) && !hasSeen(e) && !newIds.value.has(e.id));
  if (additions.length) newIds.value = new Set([...newIds.value, ...additions.map((e) => e.id)]);
}
let seenTimer = null;
function scheduleSeen() {
  clearTimeout(seenTimer);
  seenTimer = setTimeout(flushSeen, 500);
}
async function flushSeen() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  const ids = allEntries.value.filter((e) => !isMine(e) && !hasSeen(e) && !requested.has(e.id)).map((e) => e.id);
  if (!ids.length || !householdId.value) return;
  ids.forEach((id) => requested.add(id));
  try {
    await markSeen(householdId.value, ids, myUid.value);
  } catch (cause) {
    console.error("[app care log]", cause?.code, cause);
  }
}

// Panel
const panelOpen = ref(false);
const panelType = ref("feed");
const editing = ref(null);
const saving = ref(false);
const saveError = ref("");
let trigger = null;

function openPanel(type = "feed", event = null) {
  trigger = event?.currentTarget ?? null;
  editing.value = null;
  panelType.value = type;
  saveError.value = "";
  panelOpen.value = true;
}
function openEdit(entry, event) {
  trigger = event?.currentTarget ?? null;
  editing.value = entry;
  panelType.value = entry.type;
  saveError.value = "";
  panelOpen.value = true;
}
async function closePanel() {
  if (saving.value) return;
  panelOpen.value = false;
  editing.value = null;
  await nextTick();
  if (trigger && document.contains(trigger)) trigger.focus();
  trigger = null;
}
const { showToast } = useToast();
async function onSave(payload) {
  if (saving.value || !householdId.value) return;
  saving.value = true;
  saveError.value = "";
  try {
    if (editing.value) {
      await updateEntry(householdId.value, editing.value.id, {
        at: payload.at,
        endedAt: payload.endedAt,
        details: payload.details,
      });
    } else {
      const id = await addEntry({ uid: myUid.value }, householdId.value, {
      ...payload,
      byName: displayName(me.value.firstName),
      babyId: babyId.value,
      });
      // A third night log tells the partner. The server counts the night and sends it once.
      const when = new Date(payload.at);
      if (!Number.isNaN(when.getTime()) && isNightHour(when.getHours())) notifyPartner(householdId.value, "heavy", id);
    }
    saving.value = false;
    const wasEdit = Boolean(editing.value);
    await closePanel();
    showToast({ title: wasEdit ? "Log updated" : "Log saved" });
  } catch (cause) {
    console.error("[app care log]", cause?.code, cause);
    saveError.value = "Could not save. Check your connection and try again.";
    saving.value = false;
  }
}

// Delete with inline confirm
const confirmingId = ref("");
const deletingId = ref("");
const rowError = ref({ id: "", text: "" });
function askDelete(entry) {
  confirmingId.value = entry.id;
  rowError.value = { id: "", text: "" };
}
async function confirmDelete(entry) {
  deletingId.value = entry.id;
  try {
    await deleteEntry(householdId.value, entry.id);
    confirmingId.value = "";
  } catch (cause) {
    console.error("[app care log]", cause?.code, cause);
    rowError.value = { id: entry.id, text: "Could not delete. Check your connection and try again." };
  } finally {
    deletingId.value = "";
  }
}

// Open the panel from a link such as ?log=feed, then clean the address.
function handleLogQuery() {
  const type = route?.query?.log;
  if (typeof type !== "string" || !type) return;
  if (ENTRY_TYPES[type]) openPanel(type);
  const rest = { ...route.query };
  delete rest.log;
  router.replace({ query: rest });
}

watch(() => route?.query?.log, handleLogQuery, { immediate: true });
watch(
  live,
  (list) => {
    captureNew(list);
    scheduleSeen();
  },
  { immediate: true },
);
watch(allEntries, () => scheduleSeen());

function onVisibility() {
  if (document.visibilityState === "visible") scheduleSeen();
}
onMounted(() => {
  document.addEventListener("visibilitychange", onVisibility);
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 60000);
});
onBeforeUnmount(() => {
  clearTimeout(seenTimer);
  clearInterval(clockTimer);
  document.removeEventListener("visibilitychange", onVisibility);
});

const quickTypes = Object.entries(ENTRY_TYPES).map(([key, t]) => ({ key, ...t }));
</script>

<template>
  <div class="cl">
    <div aria-live="polite">
      <LoadingScreen v-if="loading" variant="inline" label="Loading the log" />
    </div>

    <div v-if="!loading && error" class="cl__error alert alert-danger" role="alert">
      <p class="mb-0">{{ error }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="reload">Try again</button>
    </div>

    <template v-if="!loading && !error">
  <header class="cl__hero">
    <div class="cl__hero-text">
      <p class="cl__eyebrow">Shared by {{ sharedBy }}</p>
      <h1 class="cl__title">Care log</h1>
      <p class="cl__lead">Tap what just happened.<template v-if="partnerFirst"> {{ partnerFirst }} sees it straight away.</template></p>
      <p class="cl__pill"><span class="cl__pill-dot"></span>{{ statusLine }}</p>
    </div>
    <svg class="cl__art" viewBox="0 0 150 180" aria-hidden="true">
      <path d="M5 175V75a70 70 0 0 1 140 0v100z" fill="#f6e3c4" stroke="#e8cf9f" stroke-width="4"/>
      <path d="M20 175V78a55 55 0 0 1 110 0v97z" fill="#b6c6ea"/>
      <circle cx="75" cy="85" r="26" fill="#f8dcc0"/>
      <path d="M49 82a26 26 0 0 1 52 0z" fill="#f4e6d0"/>
      <circle cx="67" cy="90" r="2.5" fill="#2a2f55"/><circle cx="83" cy="90" r="2.5" fill="#2a2f55"/>
      <path d="M69 99q6 5 12 0" fill="none" stroke="#c76a5a" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M45 175c0-28 14-42 30-42s30 14 30 42z" fill="#98aadb"/>
    </svg>
  </header>
  <BabySwitch />

  <section aria-labelledby="cl-now">
    <div class="cl__row-head">
      <h2 id="cl-now" class="cl__h2">Log now</h2>
      <p class="cl__hint">Pick one, then adjust the time if needed</p>
    </div>
    <ul class="cl__tiles">
      <li v-for="t in quickTypes" :key="t.key">
        <button type="button" class="cl__tile" :data-type="t.key" @click="openPanel(t.key, $event)">
          <span class="cl__tile-icon"><Icon :name="t.icon" :size="22" /></span>
          <span class="cl__tile-label">{{ t.label }}</span>
          <span class="cl__tile-hint">{{ t.hint }}</span>
        </button>
      </li>
    </ul>
  </section>

  <section class="cl__today" aria-labelledby="cl-today">
    <div class="cl__row-head">
      <h2 id="cl-today" class="cl__eyebrow cl__eyebrow--rose">Today · {{ todayLabel }}</h2>
      <p class="cl__hint cl__hint--rose">Last feed: {{ lastFeed ? lastFeedTitle.replace("Last feed ", "") : "none yet" }}</p>
    </div>
    <dl class="cl__stats">
      <div v-for="stat in stats" :key="stat.key" class="cl__stat">
        <dt class="cl__stat-label">{{ stat.label }}</dt>
        <dd class="cl__big">{{ stat.value }}</dd>
      </div>
    </dl>
  </section>

  <section class="cl__timeline" aria-labelledby="cl-timeline">
    <div class="cl__row-head cl__row-head--wrap">
      <h2 id="cl-timeline" class="cl__h2 cl__h2--lg">Timeline</h2>
      <div class="cl__filters" role="group" aria-label="Filter the timeline">
        <button v-for="f in FILTERS" :key="f.key" type="button" class="cl__chip" :aria-pressed="filter === f.key ? 'true' : 'false'" @click="filter = f.key">{{ f.label }}</button>
      </div>
    </div>

    <div aria-live="polite">
      <SkeletonList v-if="entriesLoading" :rows="4" :height="64" label="Loading the log" />
    </div>

    <div v-if="!entriesLoading && entriesErrorInfo" class="cl__error alert alert-danger" role="alert">
      <p class="mb-0">{{ entriesErrorInfo.text }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="retry">Try again</button>
    </div>

    <template v-if="!entriesLoading && !entriesErrorInfo">
      <p v-if="!groups.length" class="cl__muted">Nothing logged yet. Tap a card above to start.</p>

      <div v-for="group in groups" :key="group.key" class="cl__day">
        <div class="cl__day-head"><span class="cl__day-pill">{{ group.label }}</span><span class="cl__day-line"></span></div>
        <TransitionGroup tag="ul" name="li" class="cl__rows">
          <li v-for="entry in group.entries" :key="entry.id" class="cl__item">
            <span class="cl__dot" aria-hidden="true"></span>
            <div class="cl__card">
              <span class="cl__card-icon" :data-type="entry.type"><Icon :name="iconOf(entry)" :size="20" /></span>
              <div class="cl__body">
                <p class="cl__row-title">{{ summary(entry).title }} <span class="cl__time">{{ prefTime(entry.at) }}</span></p>
                <p v-if="summary(entry).detail" class="cl__row-detail">{{ summary(entry).detail }}</p>
                <p v-if="summary(entry).note" class="cl__row-detail">{{ summary(entry).note }}</p>
                <p class="cl__row-detail">logged by {{ byLabel(entry) }}<span v-if="seenByPartner(entry)"> · Seen by {{ partnerFirst }}</span></p>
                <p v-if="rowError.id === entry.id" class="cl__row-error" role="alert">{{ rowError.text }}</p>
              </div>
              <div class="cl__side">
                <AppBadge v-if="!isMine(entry) && newIds.has(entry.id)" color="blue">New</AppBadge>
                <template v-if="isMine(entry)">
                  <div v-if="confirmingId === entry.id" class="cl__confirm">
                    <span class="cl__confirm-text">Delete?</span>
                    <button type="button" class="btn btn-outline btn-sm" :disabled="deletingId === entry.id" @click="confirmDelete(entry)">Delete</button>
                    <button type="button" class="btn btn-outline btn-sm" @click="confirmingId = ''">Cancel</button>
                  </div>
                  <template v-else>
                    <button type="button" class="cl__icon-btn" aria-label="Edit entry" @click="openEdit(entry, $event)"><Icon name="edit" :size="18" /></button>
                    <button type="button" class="cl__icon-btn cl__icon-btn--delete" aria-label="Delete entry" @click="askDelete(entry)"><Icon name="trash" :size="18" /></button>
                  </template>
                </template>
              </div>
            </div>
          </li>
        </TransitionGroup>
      </div>

      <p v-if="moreError" class="cl__muted" role="alert">{{ moreError }}</p>
      <div v-if="hasMore" class="cl__more"><button type="button" class="btn btn-outline" :disabled="loadingMore" @click="more">{{ loadingMore ? "Loading..." : "Load older" }}</button></div>
      <p v-else-if="groups.length" class="cl__muted">That's everything logged so far.</p>
    </template>
  </section>

  <CareLogPanel :open="panelOpen" :entry="editing" :initial-type="panelType" :lock-type="true" :saving="saving" :error="saveError" @close="closePanel" @save="onSave" />
  </template>
  </div>
</template>

<style scoped>
.cl { --navy: #243560; --navy-2: #2d3f70; --ink: #1f2a52; --cream: #fdf9f0; --sand: #e9d9b8; display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 1020px; margin: 0 auto; color: var(--ink); }
.cl__status, .cl__muted { margin: 0; font-size: 0.875rem; color: #6b7392; }
.cl__error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; border-radius: 8px; }

.cl__hero { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 32px 40px; background: var(--navy-2); border-radius: 28px; border-bottom: 5px solid #182246; color: #fff; overflow: hidden; }
.cl__hero-text { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.cl__eyebrow { margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #f2a477; }
.cl__eyebrow--rose { color: #a8473f; }
.cl__title { margin: 0; font-family: var(--nt-serif); font-size: 2.25rem; line-height: 1.05; font-weight: 700; color: #fff; }
.cl__lead { margin: 0; font-size: 1.0625rem; color: #dfe5f7; }
.cl__pill { display: inline-flex; align-items: center; align-self: flex-start; gap: 8px; margin: 6px 0 0; padding: 8px 16px; border: 1px solid rgb(255 255 255 / 35%); border-radius: 999px; background: rgb(255 255 255 / 10%); font-size: 0.9375rem; }
.cl__pill-dot { width: 10px; height: 10px; border-radius: 50%; background: #8fd19e; }
.cl__art { flex: none; width: 140px; height: auto; align-self: flex-end; margin-bottom: -32px; }

.cl__row-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.cl__row-head--wrap { flex-wrap: wrap; align-items: center; }
.cl__h2 { margin: 0; font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 700; }
.cl__h2--lg { font-size: 1.75rem; }
.cl__hint { margin: 0; font-size: 0.875rem; }
.cl__hint--rose { color: #7a4a4a; }

.cl__tiles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
.cl__tile { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; width: 100%; height: 100%; min-height: 168px; padding: 16px; background: #f6e3d0; border: 0; border-bottom: 4px solid rgb(31 42 82 / 18%); border-radius: 20px; font-family: inherit; text-align: left; color: var(--ink); cursor: pointer; transition: transform 0.15s; }
.cl__tile:hover { transform: translateY(-2px); }
.cl__tile:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
.cl__tile-icon { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; margin-bottom: auto; border-radius: 14px; background: #a8532f; color: #fff; }
.cl__tile-label { font-family: var(--nt-serif); font-size: 1.375rem; font-weight: 700; }
.cl__tile-hint { font-size: 0.8125rem; color: #5b6385; }
.cl__tile[data-type="sleep"] { background: #dfe6f6; }
.cl__tile[data-type="sleep"] .cl__tile-icon { background: #243560; }
.cl__tile[data-type="nappy"], .cl__tile[data-type="diaper"] { background: #f8e8ee; }
.cl__tile[data-type="nappy"] .cl__tile-icon, .cl__tile[data-type="diaper"] .cl__tile-icon { background: #8a3f56; }
.cl__tile[data-type="medication"] { background: #e4efdc; }
.cl__tile[data-type="medication"] .cl__tile-icon { background: #43683a; }
.cl__tile[data-type="note"] { background: #fbf0d6; }
.cl__tile[data-type="note"] .cl__tile-icon { background: #7a5a22; }

.cl__today { padding: 20px 24px 24px; background: #f9e9ee; border: 1px solid #e9b9c6; border-bottom-width: 3px; border-radius: 24px; }
.cl__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 0; }
.cl__stat { display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; background: #fff; border: 1.5px dashed #e3aab9; border-radius: 12px; }
.cl__stat-label { font-size: 0.875rem; font-weight: 400; color: #5b6385; }
.cl__big { margin: 0; font-family: var(--nt-serif); font-size: 2.25rem; font-weight: 700; line-height: 1.1; }

.cl__timeline { padding: 24px 28px 28px; background: var(--cream); border: 1px solid var(--sand); border-bottom-width: 4px; border-radius: 24px; }
.cl__filters { display: flex; flex-wrap: wrap; gap: 8px; }
.cl__chip { padding: 8px 20px; background: transparent; border: 1.5px solid var(--navy); border-radius: 999px; font-family: inherit; font-size: 0.9375rem; font-weight: 600; color: var(--navy); cursor: pointer; }
.cl__chip[aria-pressed="true"] { background: var(--navy); color: #fff; }
.cl__chip:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }

.cl__day { margin-top: 12px; }
.cl__day-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.cl__day-pill { padding: 4px 12px; background: var(--navy); border-radius: 8px; font-size: 0.8125rem; font-weight: 600; color: #fff; }
.cl__day-line { flex: 1; border-top: 2px dashed var(--sand); }
.cl__rows { margin: 0; padding: 0; list-style: none; }
.cl__item { position: relative; display: flex; gap: 16px; padding-bottom: 12px; }
.cl__item::before { content: ""; position: absolute; left: 13px; top: 40px; bottom: -4px; border-left: 2px dashed var(--sand); }
.cl__item:last-child::before { display: none; }
.cl__dot { flex: none; width: 28px; height: 28px; margin-top: 12px; border-radius: 50%; background: #fff; border: 7px solid #a8532f; box-sizing: border-box; box-shadow: 0 0 0 3px #f1d8c8; }
.cl__card { flex: 1; display: flex; align-items: flex-start; gap: 16px; min-width: 0; padding: 14px 16px; background: #fff; border: 1px solid var(--sand); border-radius: 18px; }
.cl__card-icon { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: #243560; color: #fff; }
.cl__card-icon[data-type="feed"] { background: #a8532f; }
.cl__card-icon[data-type="nappy"], .cl__card-icon[data-type="diaper"] { background: #8a3f56; }
.cl__card-icon[data-type="medication"] { background: #43683a; }
.cl__card-icon[data-type="note"] { background: #7a5a22; }
.cl__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cl__row-title { margin: 0; font-family: var(--nt-serif); font-size: 1.25rem; font-weight: 700; }
.cl__time { margin-left: 8px; font-family: inherit; font-size: 0.8125rem; font-weight: 700; color: #a8532f; }
.cl__row-detail { margin: 0; font-size: 0.9375rem; color: #4a5272; overflow-wrap: anywhere; }
.cl__row-error { margin: 4px 0 0; font-size: 0.875rem; color: var(--nt-coral); }
.cl__side { display: flex; align-items: center; gap: 8px; }
.cl__icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: #f1ead9; border: 0; border-radius: 12px; color: #5b4a2a; cursor: pointer; }
.cl__icon-btn--delete { background: #f3e1dc; color: #a8473f; }
.cl__icon-btn:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
.cl__confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 0.875rem; }
.cl__more { display: flex; justify-content: center; padding-top: 8px; }

@media (max-width: 991px) {
  .cl__tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .cl__hero { padding: 24px; }
  .cl__art { display: none; }
}
@media (max-width: 575px) {
  .cl__tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cl__stats { grid-template-columns: 1fr; }
  .cl__title { font-size: 2.25rem; }
  .cl__timeline { padding: 20px 16px; }
  .cl__card { flex-wrap: wrap; }
}
</style>