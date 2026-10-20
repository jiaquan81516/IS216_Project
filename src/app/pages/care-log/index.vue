<script setup>
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

const groups = computed(() => groupByDay(allEntries.value, now.value));

const partnerFirst = computed(() => (partner.value ? displayName(partner.value.firstName) : ""));

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
    await closePanel();
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
      <p v-if="loading" class="cl__status">Loading the log...</p>
    </div>

    <div v-if="!loading && error" class="cl__error alert alert-danger" role="alert">
      <p class="mb-0">{{ error }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="reload">Try again</button>
    </div>

    <template v-if="!loading && !error">
      <header class="cl__head">
        <div class="cl__head-text">
          <h1 class="nt-title cl__title">Care log</h1>
          <p class="cl__sub">Everything you and your partner have logged, newest first.</p>
        </div>
        <button
          type="button"
          class="btn cl__log"
          :class="panelOpen ? 'btn-outline' : 'btn-primary'"
          @click="openPanel('feed', $event)"
        >
          <Icon name="plus" :size="18" />
          <span>Log care</span>
        </button>
      </header>

      <section class="cl__card cl__strip" aria-labelledby="cl-today">
        <h2 id="cl-today" class="cl__card-title">Today</h2>
        <dl class="cl__stats">
          <div v-for="stat in stats" :key="stat.key" class="cl__stat">
            <dd class="cl__big">{{ stat.value }}</dd>
            <dt class="cl__stat-label">{{ stat.label }}</dt>
          </div>
          <div class="cl__stat cl__stat--last">
            <template v-if="lastFeed">
              <dd class="cl__big">{{ lastFeedTitle.replace("Last feed ", "") }}</dd>
              <dt class="cl__stat-label">Last feed. {{ lastFeedLine }}</dt>
            </template>
            <template v-else>
              <dd class="cl__big cl__big--empty">None yet</dd>
              <dt class="cl__stat-label">No feeds logged yet</dt>
            </template>
          </div>
        </dl>
      </section>

      <div class="cl__cols">
        <section class="cl__card cl__timeline" aria-labelledby="cl-timeline">
          <div class="cl__tl-head">
            <h2 id="cl-timeline" class="cl__card-title cl__card-title--lg">Timeline</h2>
          </div>

          <div aria-live="polite">
            <p v-if="entriesLoading" class="cl__status">Loading the log...</p>
          </div>

          <div v-if="!entriesLoading && entriesErrorInfo" class="cl__error alert alert-danger" role="alert">
            <div>
              <p class="mb-0">{{ entriesErrorInfo.text }}</p>
              <p v-if="entriesErrorInfo.detail" class="cl__muted">{{ entriesErrorInfo.detail }}</p>
            </div>
            <button type="button" class="btn btn-outline btn-sm" @click="retry">Try again</button>
          </div>

          <template v-if="!entriesLoading && !entriesErrorInfo">
            <div v-if="!allEntries.length" class="cl__empty">
              <h3 class="cl__empty-title">No care logged yet</h3>
              <p class="cl__muted">Log the first feed or nap and your partner will see it here.</p>
            </div>

            <section v-for="group in groups" :key="group.key" class="cl__day" :aria-label="group.label">
              <h3 class="cl__day-title">{{ group.label }}</h3>
              <ul class="cl__rows">
                <li v-for="entry in group.entries" :key="entry.id" class="cl__row">
                  <span class="cl__time">{{ prefTime(entry.at) }}</span>
                  <span class="cl__icon">
                    <Icon :name="iconOf(entry)" :size="18" />
                  </span>
                  <div class="cl__body">
                    <p class="cl__row-title">{{ summary(entry).title }}</p>
                    <p v-if="summary(entry).detail" class="cl__row-detail">{{ summary(entry).detail }}</p>
                    <p v-if="summary(entry).note" class="cl__row-detail">{{ summary(entry).note }}</p>
                    <p class="cl__row-by">
                      <span>by {{ byLabel(entry) }}</span>
                      <span v-if="seenByPartner(entry)">Seen by {{ partnerFirst }}</span>
                    </p>
                    <p v-if="rowError.id === entry.id" class="cl__row-error" role="alert">{{ rowError.text }}</p>
                  </div>
                  <div class="cl__side">
                    <AppBadge v-if="!isMine(entry) && newIds.has(entry.id)" color="blue">New</AppBadge>
                    <template v-if="isMine(entry)">
                      <div v-if="confirmingId === entry.id" class="cl__confirm">
                        <span class="cl__confirm-text">Delete this entry?</span>
                        <button
                          type="button"
                          class="btn btn-outline btn-sm cl__btn-danger"
                          :disabled="deletingId === entry.id"
                          @click="confirmDelete(entry)"
                        >
                          Delete
                        </button>
                        <button type="button" class="btn btn-outline btn-sm" @click="confirmingId = ''">Cancel</button>
                      </div>
                      <div v-else class="cl__actions">
                        <button
                          type="button"
                          class="cl__icon-btn cl__icon-btn--edit"
                          aria-label="Edit entry"
                          @click="openEdit(entry, $event)"
                        >
                          <Icon name="edit" :size="18" />
                        </button>
                        <button
                          type="button"
                          class="cl__icon-btn cl__icon-btn--delete"
                          aria-label="Delete entry"
                          @click="askDelete(entry)"
                        >
                          <Icon name="trash" :size="18" />
                        </button>
                      </div>
                    </template>
                  </div>
                </li>
              </ul>
            </section>

            <p v-if="moreError" class="cl__muted" role="alert">{{ moreError }}</p>
            <div v-if="hasMore" class="cl__more">
              <button type="button" class="btn btn-outline" :disabled="loadingMore" @click="more">
                {{ loadingMore ? "Loading..." : "Load older" }}
              </button>
            </div>
          </template>
        </section>

        <aside class="cl__card cl__quick" aria-labelledby="cl-quick">
          <h2 id="cl-quick" class="cl__card-title cl__card-title--lg">Quick log</h2>
          <ul class="cl__links">
            <li v-for="t in quickTypes" :key="t.key">
              <button type="button" class="cl__link" @click="openPanel(t.key, $event)">
                <Icon :name="t.icon" :size="20" class="cl__link-icon" />
                <span class="cl__link-text">
                  <span class="cl__link-label">{{ t.label }}</span>
                  <span class="cl__link-hint">{{ t.hint }}</span>
                </span>
                <Icon name="chevron" :size="16" class="cl__link-icon" />
              </button>
            </li>
          </ul>
        </aside>
      </div>

      <CareLogPanel
        :open="panelOpen"
        :entry="editing"
        :initial-type="panelType"
        :saving="saving"
        :error="saveError"
        @close="closePanel"
        @save="onSave"
      />
    </template>
  </div>
</template>

<style scoped>
.cl { display: flex; flex-direction: column; gap: 24px; width: 100%; font-size: 1rem; }
.cl__status { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.cl__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.cl__error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin: 0; font-size: 0.875rem; border-radius: 8px; }

.cl__head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px; }
.cl__head-text { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.cl__title { font-size: 2.5rem; line-height: 1.2; }
.cl__sub { margin: 0; font-size: 1rem; color: var(--nt-muted); }
.cl__log { display: inline-flex; align-items: center; gap: 8px; }

.cl__card { background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 12px; padding: 24px; min-width: 0; }
.cl__card-title { margin: 0 0 12px; font-size: 0.9375rem; font-weight: 600; line-height: 1.3; color: var(--nt-ink); }
.cl__card-title--lg { font-size: 1.125rem; margin-bottom: 8px; }

.cl__stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px 24px; margin: 0; }
.cl__stat { display: flex; flex-direction: column-reverse; justify-content: flex-end; gap: 4px; min-width: 0; padding-left: 24px; border-left: 1px solid var(--nt-line); }
.cl__stat:first-child { padding-left: 0; border-left: 0; }
.cl__big { margin: 0; font-size: 1.75rem; font-weight: 600; line-height: 1.2; color: var(--nt-ink); }
.cl__big--empty { font-size: 1.25rem; font-weight: 500; color: var(--nt-muted); }
.cl__stat-label { font-size: 0.875rem; font-weight: 400; line-height: 1.45; color: var(--nt-muted); }

.cl__cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
.cl__quick { order: 1; }
.cl__timeline { order: 2; display: flex; flex-direction: column; gap: 8px; }

.cl__links { margin: 0; padding: 0; list-style: none; }
.cl__links li + li { border-top: 1px solid var(--nt-line); }
.cl__link { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 0; background: none; border: 0; font-family: inherit; text-align: left; color: var(--nt-ink); cursor: pointer; }
.cl__link-icon { flex: none; color: var(--nt-muted); }
.cl__link-text { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.cl__link-label { font-size: 1rem; font-weight: 600; }
.cl__link-hint { font-size: 0.875rem; color: var(--nt-muted); }
.cl__link:hover .cl__link-label { color: var(--nt-plum); text-decoration: underline; text-underline-offset: 3px; }
.cl__link:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }

.cl__empty { padding: 16px 0; border-top: 1px solid var(--nt-line); }
.cl__empty-title { margin: 0 0 4px; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }

.cl__day { margin-top: 8px; }
.cl__day-title { margin: 0 0 4px; font-size: 0.875rem; font-weight: 600; line-height: 1.3; color: var(--nt-muted); }
.cl__rows { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.cl__row { display: grid; grid-template-columns: 72px 18px minmax(0, 1fr) auto; gap: 16px; align-items: start; padding: 16px 0; border-bottom: 1px solid var(--nt-line); }
.cl__rows > .cl__row:last-child { border-bottom: 0; }
.cl__time { font-size: 0.875rem; line-height: 36px; color: var(--nt-muted); }
.cl__icon { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 36px; color: var(--nt-muted); }
.cl__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cl__row-title { margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.5; color: var(--nt-ink); }
.cl__row-detail { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); overflow-wrap: anywhere; }
.cl__row-by { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.cl__row-error { margin: 4px 0 0; font-size: 0.875rem; color: var(--nt-coral); }
.cl__side { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; min-height: 36px; }
.cl__actions { display: flex; gap: 0; }
.cl__icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: transparent; border: 0; border-radius: 8px; color: var(--nt-muted); cursor: pointer; transition: background-color 0.15s, color 0.15s; }
.cl__icon-btn:hover { background: var(--nt-gray); }
.cl__icon-btn--edit:hover { color: var(--nt-plum); }
.cl__icon-btn--delete:hover { color: var(--nt-coral); }
.cl__icon-btn:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.cl__confirm { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.cl__confirm-text { font-size: 0.875rem; color: var(--nt-ink); }
.cl__btn-danger { --bs-btn-color: var(--nt-coral); --bs-btn-hover-color: var(--nt-coral); --bs-btn-active-color: var(--nt-coral); --bs-btn-border-color: var(--nt-coral); --bs-btn-hover-border-color: var(--nt-coral); --bs-btn-active-border-color: var(--nt-coral); }
.cl__more { display: flex; justify-content: center; padding-top: 8px; }

@media (min-width: 1100px) {
  .cl__cols { grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; }
  .cl__quick { order: 2; }
  .cl__timeline { order: 1; }
}
@media (max-width: 991px) {
  .cl__title { font-size: 2rem; }
  .cl__stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .cl__stat--last { grid-column: 1 / -1; padding-left: 0; border-left: 0; padding-top: 16px; border-top: 1px solid var(--nt-line); }
}
@media (max-width: 575px) {
  .cl__card { padding: 20px; }
  .cl__stats { gap: 16px 12px; }
  .cl__stat { padding-left: 12px; }
  .cl__big { font-size: 1.375rem; }
  .cl__row { grid-template-columns: 18px minmax(0, 1fr); }
  .cl__time { grid-column: 2; grid-row: 1; line-height: 1.45; }
  .cl__icon { grid-column: 1; grid-row: 1 / span 2; }
  .cl__body { grid-column: 2; }
  .cl__side { grid-column: 2; justify-content: flex-start; }
}
</style>
