<script setup>
import "@/app/app.css";
import { computed, inject, nextTick, onMounted, reactive, ref, watch } from "vue";
import CalendarDayPanel from "@/app/components/CalendarDayPanel.vue";
import Icon from "@/app/components/Icon.vue";
import {
  dayBlocks,
  dayHeading,
  eventsOnDay,
  eventTimeLabel,
  formatClock,
  layoutWeekEvents,
  monthGrid,
  monthTitle,
  nightOwner,
  shiftMonth,
  sortDayEvents,
  weekdayLabels,
  weekDays,
  weekStartOf,
  weekTitle,
  isBarEvent,
} from "@/app/api/calendarHelpers";
import { addDays, parseIso, toIso } from "@/app/api/rotaHelpers";
import { describeSharedError, ownerKey, ownerLabel, ownerUid } from "@/app/api/sharedHelpers";
import { displayName, HOME_KEY } from "@/app/composables/useHome";
import { usePrefs } from "@/app/composables/usePrefs";
import { SHARED_KEY } from "@/app/composables/useShared";
import { useCalendarStore } from "@/app/stores/calendar";
import { useRotaStore } from "@/app/stores/rota";

defineOptions({ name: "CalendarPage" });

// The layout provides the household and the bound stores. Names fall back to "Me" and
// "Your partner" when the page is used on its own.
const home = inject(HOME_KEY, null);
const shared = inject(SHARED_KEY, null);
const store = useCalendarStore();
const rota = useRotaStore();

const names = computed(() => {
  const mine = home?.me?.value?.firstName;
  const theirs = home?.partner?.value?.firstName;
  return { me: mine ? displayName(mine) : "Me", partner: theirs ? displayName(theirs) : "Your partner" };
});
const myUid = computed(() => home?.me?.value?.uid || store.meUid);
// One quiet line when Google Calendar is linked, and nothing at all when it is not. The
// connecting and the syncing both live on Settings; this page only says what is true.
const googleSynced = computed(() => Boolean(home?.profile?.value?.settings?.calendar?.connected));
// An owner is a uid or "both": the name comes from the signed in uid, the colour from a key.
const ownerName = (owner) => ownerLabel(owner, myUid.value, names.value.me, names.value.partner);
const ownerTone = (owner) => ownerKey(owner, myUid.value) ?? "both";

// Shared data state. The page waits for the household id, so it never shows an error first.
const householdId = computed(() => home?.householdId?.value ?? store.householdId);
const loading = computed(() => !householdId.value || store.loading);
const errorInfo = computed(() => (store.error ? describeSharedError(store.error.code, "calendar") : null));
function retry() {
  shared?.retry();
}

const todayIso = toIso(new Date());
const now = parseIso(todayIso);

const VIEWS = [
  { value: "month", label: "Monthly" },
  { value: "week", label: "Weekly" },
];
const view = ref("month");
const cursor = reactive({ year: now.getFullYear(), month: now.getMonth() });

// The week start comes from Settings (Display), so changing it there changes these grids.
const { weekStart } = usePrefs();
const weekdays = computed(() => weekdayLabels(weekStart.value));
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekdayNames = computed(() => weekdays.value.map((_, i) => WEEKDAY_NAMES[(weekStart.value + i) % 7]));
const isSunday = (iso) => parseIso(iso).getDay() === 0;

const weekAnchor = ref(weekStartOf(todayIso, weekStart.value));
watch(weekStart, (value) => {
  weekAnchor.value = weekStartOf(weekAnchor.value, value);
});
const weekIsos = computed(() => weekDays(weekAnchor.value));

const label = computed(() => (view.value === "month" ? monthTitle(cursor.year, cursor.month) : weekTitle(weekIsos.value)));
const grid = computed(() => monthGrid(cursor.year, cursor.month, weekStart.value));

// Calendar list: which layers are shown.
const layers = reactive({ me: true, partner: true, both: true, night: true });
const allOn = computed(() => Object.values(layers).every(Boolean));
function toggleAll() {
  const next = !allOn.value;
  for (const key of Object.keys(layers)) layers[key] = next;
}
const listOpen = ref(false);

// Search
const searchOpen = ref(false);
const query = ref("");
const searchInput = ref(null);
async function toggleSearch() {
  searchOpen.value = !searchOpen.value;
  if (searchOpen.value) {
    await nextTick();
    searchInput.value?.focus();
  } else query.value = "";
}

const visibleEvents = computed(() => {
  const q = query.value.trim().toLowerCase();
  return store.events.filter((e) => layers[ownerTone(e.owner)] !== false && (!q || String(e.title).toLowerCase().includes(q)));
});

const shownIsos = computed(() => (view.value === "month" ? grid.value.flat().map((d) => d.iso) : weekIsos.value));
const dayEvents = computed(() => {
  const map = {};
  for (const iso of shownIsos.value) map[iso] = sortDayEvents(eventsOnDay(visibleEvents.value, iso));
  return map;
});

// Month: one lane layout per week row.
const MAX_LANES = 3;
const layouts = computed(() =>
  grid.value.map((week) =>
    layoutWeekEvents(
      visibleEvents.value,
      week.map((d) => d.iso),
      MAX_LANES,
    ),
  ),
);

// Night duty comes from the shared sleep rota.
const nights = computed(() => {
  const map = {};
  for (const iso of shownIsos.value) map[iso] = nightOwner(rota.view, iso);
  return map;
});
function nightMarker(iso) {
  if (!layers.night) return null;
  const night = nights.value[iso];
  if (!night || night.who === "open") return null;
  const first = names.value[night.who];
  const text = night.shared ? `Night duty: ${first} then ${names.value[night.second]}` : `Night duty: ${first}`;
  return { text, who: night.who, second: night.shared ? night.second : null };
}

function dayLabel(iso) {
  const count = dayEvents.value[iso]?.length ?? 0;
  const base = dayHeading(iso);
  return count ? `${base}, ${count} ${count === 1 ? "event" : "events"}` : base;
}
function eventLabel(event) {
  const when = event.allDay || !event.start ? "all day" : eventTimeLabel(event);
  return `${event.title}, ${when}, ${ownerName(event.owner)}`;
}
const startClock = (event) => (isBarEvent(event) ? "" : formatClock(event.start));

function step(delta) {
  if (view.value === "month") {
    const next = shiftMonth(cursor.year, cursor.month, delta);
    cursor.year = next.year;
    cursor.month = next.month;
  } else {
    weekAnchor.value = addDays(weekAnchor.value, delta * 7);
  }
}
function goToday() {
  cursor.year = now.getFullYear();
  cursor.month = now.getMonth();
  weekAnchor.value = weekStartOf(todayIso, weekStart.value);
}
function setView(next) {
  if (next === view.value) return;
  if (next === "week") {
    const pick = selectedDay.value && inMonth(selectedDay.value) ? selectedDay.value : inMonth(todayIso) ? todayIso : toIso(new Date(cursor.year, cursor.month, 1));
    weekAnchor.value = weekStartOf(pick, weekStart.value);
  } else {
    const mid = parseIso(addDays(weekAnchor.value, 3));
    cursor.year = mid.getFullYear();
    cursor.month = mid.getMonth();
  }
  view.value = next;
}
function inMonth(iso) {
  const d = parseIso(iso);
  return d.getFullYear() === cursor.year && d.getMonth() === cursor.month;
}

// Weekly: all day row, then an hour grid.
const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, h) => (h === 0 ? "" : `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`));
const allDayLayout = computed(() =>
  layoutWeekEvents(
    visibleEvents.value.filter(isBarEvent),
    weekIsos.value,
    Infinity,
  ),
);
const blocks = computed(() => {
  const map = {};
  for (const iso of weekIsos.value) map[iso] = dayBlocks(visibleEvents.value, iso);
  return map;
});
const blockStyle = (b) => ({
  top: `${(b.startMin / 60) * HOUR_PX + 1}px`,
  height: `${((b.endMin - b.startMin) / 60) * HOUR_PX - 2}px`,
  left: `calc(${(b.col / b.cols) * 100}% + 2px)`,
  width: `calc(${100 / b.cols}% - 4px)`,
});
const scroller = ref(null);
async function scrollToMorning() {
  await nextTick();
  if (scroller.value) scroller.value.scrollTop = 7 * HOUR_PX;
}
watch(view, (v) => v === "week" && scrollToMorning());
onMounted(() => view.value === "week" && scrollToMorning());

// Day panel
const panelOpen = ref(false);
const panelDate = ref(todayIso);
const panelAdding = ref(false);
const panelEditId = ref("");
const selectedDay = ref(null);
const panelEvents = computed(() => sortDayEvents(eventsOnDay(store.events, panelDate.value)));
const panelNight = computed(() => nightOwner(rota.view, panelDate.value));

function openDay(iso, trigger = null, adding = false, editId = "") {
  trigger?.focus?.();
  panelDate.value = iso;
  selectedDay.value = iso;
  panelAdding.value = adding;
  panelEditId.value = editId;
  panelOpen.value = true;
}
function openEvent(event, trigger) {
  openDay(event.date, trigger, false, event.id);
}
function onCellKey(iso, event) {
  openDay(iso, event.currentTarget);
}
function defaultAddDate() {
  if (view.value === "week") {
    if (selectedDay.value && weekIsos.value.includes(selectedDay.value)) return selectedDay.value;
    return weekIsos.value.includes(todayIso) ? todayIso : weekIsos.value[0];
  }
  if (selectedDay.value && inMonth(selectedDay.value)) return selectedDay.value;
  if (inMonth(todayIso)) return todayIso;
  return toIso(new Date(cursor.year, cursor.month, 1));
}
function openAdd(event) {
  openDay(defaultAddDate(), event.currentTarget, true);
}
function closePanel() {
  panelOpen.value = false;
}
async function onSave(payload) {
  const { id, owner, ...rest } = payload;
  const data = { ...rest, owner: ownerUid(owner, myUid.value, rota.partnerUid || store.partnerUid) ?? "both" };
  const saved = id ? await store.updateEvent(id, data) : await store.addEvent(data);
  if (!saved) return;
  panelDate.value = saved.date;
  selectedDay.value = saved.date;
  const d = parseIso(saved.date);
  cursor.year = d.getFullYear();
  cursor.month = d.getMonth();
  weekAnchor.value = weekStartOf(saved.date, weekStart.value);
}
function onDelete(id) {
  store.removeEvent(id);
}
</script>

<template>
  <div class="cal">
    <header class="cal__head">
      <h1 class="nt-title cal__title">Calendar</h1>
      <p class="cal__sub">Appointments, family plans and who is on duty. You both see the same calendar.</p>
      <p v-if="googleSynced" class="cal__synced">Synced with Google Calendar</p>
    </header>

    <section class="cal__toolbar" aria-label="Calendar controls">
      <div class="cal__nav">
        <button type="button" class="cal__today" @click="goToday">Today</button>
        <div class="cal__steps">
          <button type="button" class="cal__step" :aria-label="view === 'month' ? 'Previous month' : 'Previous week'" @click="step(-1)">
            <Icon name="chevron-left" :size="18" />
          </button>
          <button type="button" class="cal__step" :aria-label="view === 'month' ? 'Next month' : 'Next week'" @click="step(1)">
            <Icon name="chevron" :size="18" />
          </button>
        </div>
        <h2 id="cal-month" class="cal__month" aria-live="polite">{{ label }}</h2>
      </div>
      <div class="cal__tools">
        <button
          type="button"
          class="cal__listbtn"
          :aria-expanded="listOpen ? 'true' : 'false'"
          aria-controls="cal-layers"
          @click="listOpen = !listOpen"
        >
          <span>Calendars</span>
          <Icon name="chevron-down" :size="16" />
        </button>
        <div class="cal__seg" role="radiogroup" aria-label="Calendar view">
          <button
            v-for="option in VIEWS"
            :key="option.value"
            type="button"
            role="radio"
            class="cal__segbtn"
            :aria-checked="view === option.value ? 'true' : 'false'"
            @click="setView(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <input
          v-if="searchOpen"
          ref="searchInput"
          v-model="query"
          class="cal__search"
          type="search"
          placeholder="Search events"
          aria-label="Search events"
          @keydown.esc="toggleSearch"
        />
        <button
          type="button"
          class="cal__sq"
          :aria-label="searchOpen ? 'Close search' : 'Search events'"
          :aria-expanded="searchOpen ? 'true' : 'false'"
          @click="toggleSearch"
        >
          <Icon :name="searchOpen ? 'x' : 'search'" :size="18" />
        </button>
        <button type="button" class="cal__sq" aria-label="Add event" @click="openAdd">
          <Icon name="plus" :size="18" />
        </button>
      </div>
    </section>

    <ul class="cal__legend" aria-label="Legend">
      <li><span class="cal__swatch" data-owner="me" aria-hidden="true"></span>{{ names.me }}</li>
      <li><span class="cal__swatch" data-owner="partner" aria-hidden="true"></span>{{ names.partner }}</li>
      <li><span class="cal__swatch" data-owner="both" aria-hidden="true"></span>Both</li>
      <li>The thin line under a day is who is on duty at night</li>
    </ul>

    <div aria-live="polite">
      <p v-if="loading" class="cal__status">Loading the calendar...</p>
    </div>

    <div v-if="!loading && errorInfo" class="cal__error alert alert-danger" role="alert">
      <p class="mb-0">{{ errorInfo.text }}</p>
      <p v-if="errorInfo.detail" class="cal__status">{{ errorInfo.detail }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="retry">Try again</button>
    </div>

    <p v-if="store.writeError" class="app-error-text" role="alert">{{ store.writeError }}</p>

    <div class="cal__layout">
      <aside id="cal-layers" class="cal__layers" :class="{ 'cal__layers--open': listOpen }" aria-labelledby="cal-layers-h">
        <h2 id="cal-layers-h" class="cal__layers-h">Calendars</h2>
        <ul class="cal__layerlist">
          <li>
            <label class="cal__layer">
              <input type="checkbox" class="visually-hidden" :checked="allOn" @change="toggleAll" />
              <span class="cal__box" :class="{ 'cal__box--on': allOn }" style="--c: var(--nt-plum)" aria-hidden="true">
                <Icon v-if="allOn" name="check" :size="12" />
              </span>
              <span class="cal__avs" aria-hidden="true">
                <span class="cal__av" data-owner="me">{{ names.me.charAt(0).toUpperCase() }}</span>
                <span class="cal__av" data-owner="partner">{{ names.partner.charAt(0).toUpperCase() }}</span>
              </span>
              <span class="cal__lname">Everything</span>
            </label>
          </li>
          <li v-for="item in [
            { key: 'me', text: `${names.me}'s events`, tone: 'me' },
            { key: 'partner', text: `${names.partner}'s events`, tone: 'partner' },
            { key: 'both', text: 'Shared events', tone: 'both' },
            { key: 'night', text: 'Night duty', tone: 'night' },
          ]" :key="item.key">
            <label class="cal__layer">
              <input v-model="layers[item.key]" type="checkbox" class="visually-hidden" />
              <span class="cal__box" :class="{ 'cal__box--on': layers[item.key] }" :data-owner="item.tone" aria-hidden="true">
                <Icon v-if="layers[item.key]" name="check" :size="12" />
              </span>
              <span class="cal__lname">{{ item.text }}</span>
            </label>
          </li>
        </ul>
      </aside>

      <div class="cal__main">
        <!-- Month -->
        <div v-if="view === 'month' && !loading && !errorInfo" class="cal__grid" role="grid" aria-labelledby="cal-month">
          <div class="cal__dow" role="row">
            <div v-for="(w, i) in weekdays" :key="w" role="columnheader" :aria-label="weekdayNames[i]" class="cal__dowcell">{{ w }}</div>
          </div>
          <div v-for="(week, wi) in grid" :key="week[0].iso" class="cal__week" role="presentation">
            <div class="cal__row" role="row">
              <div
                v-for="day in week"
                :key="day.iso"
                role="gridcell"
                tabindex="0"
                class="cal__cell"
                :class="{
                  'cal__cell--out': !day.inMonth,
                  'cal__cell--today': day.iso === todayIso,
                  'cal__cell--selected': panelOpen && selectedDay === day.iso,
                }"
                :data-date="day.iso"
                :aria-label="dayLabel(day.iso)"
                :aria-current="day.iso === todayIso ? 'date' : undefined"
                @click="openDay(day.iso, $event.currentTarget)"
                @keydown.enter.self.prevent="onCellKey(day.iso, $event)"
                @keydown.space.self.prevent="onCellKey(day.iso, $event)"
              >
                <span v-if="nightMarker(day.iso)" class="cal__night" role="img" :aria-label="nightMarker(day.iso).text" :title="nightMarker(day.iso).text">
                  <span class="cal__nightpart" :data-who="nightMarker(day.iso).who"></span>
                  <span v-if="nightMarker(day.iso).second" class="cal__nightpart" :data-who="nightMarker(day.iso).second"></span>
                </span>
                <span v-if="dayEvents[day.iso].length" class="cal__dots" aria-hidden="true">
                  <span
                    v-for="event in dayEvents[day.iso].slice(0, 4)"
                    :key="event.id"
                    class="cal__dot"
                    :data-owner="ownerTone(event.owner)"
                  ></span>
                </span>
              </div>
            </div>
            <div class="cal__fg" role="presentation">
              <span
                v-for="(day, i) in week"
                :key="day.iso"
                class="cal__num"
                :class="{
                  'cal__num--today': day.iso === todayIso,
                  'cal__num--out': !day.inMonth,
                  'cal__num--sun': isSunday(day.iso),
                }"
                :style="{ gridColumn: i + 1, gridRow: 1 }"
                aria-hidden="true"
                >{{ day.day }}</span
              >
              <button
                v-for="item in layouts[wi].items"
                :key="item.event.id + ':' + item.start"
                type="button"
                class="cal__item"
                :class="[
                  item.bar ? 'cal__bar' : 'cal__ev',
                  { 'cal__bar--l': item.contLeft, 'cal__bar--r': item.contRight, 'cal__item--out': !week[item.start].inMonth && !week[item.end].inMonth },
                ]"
                :data-owner="ownerTone(item.event.owner)"
                :data-event="item.event.id"
                :aria-label="eventLabel(item.event)"
                :style="{ gridColumn: `${item.start + 1} / span ${item.span}`, gridRow: item.lane + 2 }"
                @click="openEvent(item.event, $event.currentTarget)"
              >
                <span v-if="!item.bar" class="cal__evdot" aria-hidden="true"></span>
                <span class="cal__evtitle">{{ item.event.title }}</span>
                <span v-if="!item.bar" class="cal__evtime">{{ startClock(item.event) }}</span>
              </button>
              <button
                v-for="(count, i) in layouts[wi].hidden"
                v-show="count > 0"
                :key="'more' + i"
                type="button"
                class="cal__more"
                :aria-label="`${count} more ${count === 1 ? 'event' : 'events'} on ${dayHeading(week[i].iso)}`"
                :style="{ gridColumn: i + 1, gridRow: MAX_LANES + 2 }"
                @click="openDay(week[i].iso, $event.currentTarget)"
              >
                +{{ count }}
              </button>
            </div>
          </div>
        </div>

        <!-- Week -->
        <div v-else-if="!loading && !errorInfo" class="cal__wk" role="grid" aria-labelledby="cal-month">
          <div class="cal__wkhead" role="row">
            <div class="cal__gutter" role="presentation"></div>
            <div
              v-for="(iso, i) in weekIsos"
              :key="iso"
              role="columnheader"
              class="cal__wkday"
              :aria-label="dayHeading(iso)"
              :aria-current="iso === todayIso ? 'date' : undefined"
            >
              <span class="cal__wkname">{{ weekdays[i] }}</span>
              <span class="cal__wknum" :class="{ 'cal__num--today': iso === todayIso, 'cal__num--sun': isSunday(iso) }">{{ parseIso(iso).getDate() }}</span>
              <span v-if="nightMarker(iso)" class="cal__night" role="img" :aria-label="nightMarker(iso).text" :title="nightMarker(iso).text">
                <span class="cal__nightpart" :data-who="nightMarker(iso).who"></span>
                <span v-if="nightMarker(iso).second" class="cal__nightpart" :data-who="nightMarker(iso).second"></span>
              </span>
            </div>
          </div>
          <div class="cal__wkall" role="row">
            <div class="cal__gutter cal__gutter--label" role="presentation">All day</div>
            <div class="cal__wkallarea" role="presentation">
              <div class="cal__wkallbg" role="presentation">
                <span v-for="iso in weekIsos" :key="iso" class="cal__wkallcol"></span>
              </div>
              <div
                class="cal__wkallfg"
                role="presentation"
                :style="{ gridTemplateRows: `repeat(${Math.max(allDayLayout.laneCount, 1)}, 22px)` }"
              >
                <button
                  v-for="item in allDayLayout.items"
                  :key="item.event.id + ':' + item.start"
                  type="button"
                  class="cal__item cal__bar"
                  :class="{ 'cal__bar--l': item.contLeft, 'cal__bar--r': item.contRight }"
                  :data-owner="ownerTone(item.event.owner)"
                  :data-event="item.event.id"
                  :aria-label="eventLabel(item.event)"
                  :style="{ gridColumn: `${item.start + 1} / span ${item.span}`, gridRow: item.lane + 1 }"
                  @click="openEvent(item.event, $event.currentTarget)"
                >
                  <span class="cal__evtitle">{{ item.event.title }}</span>
                </button>
              </div>
            </div>
          </div>
          <div ref="scroller" class="cal__wkscroll">
            <div class="cal__wkbody" :style="{ height: `${24 * HOUR_PX}px` }">
              <div class="cal__gutter cal__hours" role="presentation">
                <span v-for="(h, i) in HOURS" :key="i" class="cal__hour" :style="{ top: `${i * HOUR_PX}px` }">{{ h }}</span>
              </div>
              <div class="cal__wkgrid" role="presentation">
                <div class="cal__wklines" role="presentation">
                  <span v-for="h in 24" :key="h" class="cal__wkline" :style="{ height: `${HOUR_PX}px` }"></span>
                </div>
                <div class="cal__wkcols" role="row">
                  <div
                    v-for="iso in weekIsos"
                    :key="iso"
                    role="gridcell"
                    tabindex="0"
                    class="cal__wkcol"
                    :class="{ 'cal__wkcol--today': iso === todayIso }"
                    :data-date="iso"
                    :aria-label="dayLabel(iso)"
                    @click="openDay(iso, $event.currentTarget)"
                    @keydown.enter.self.prevent="onCellKey(iso, $event)"
                    @keydown.space.self.prevent="onCellKey(iso, $event)"
                  >
                    <button
                      v-for="b in blocks[iso]"
                      :key="b.event.id"
                      type="button"
                      class="cal__block"
                      :data-owner="ownerTone(b.event.owner)"
                      :data-event="b.event.id"
                      :aria-label="eventLabel(b.event)"
                      :style="blockStyle(b)"
                      @click.stop="openEvent(b.event, $event.currentTarget)"
                    >
                      <span class="cal__blocktitle">{{ b.event.title }}</span>
                      <span class="cal__blocktime">{{ formatClock(b.event.start) }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <CalendarDayPanel
      :open="panelOpen"
      :date="panelDate"
      :events="panelEvents"
      :night="panelNight"
      :names="names"
      :me-uid="myUid"
      :adding="panelAdding"
      :start-edit-id="panelEditId"
      @close="closePanel"
      @save="onSave"
      @delete="onDelete"
    />
  </div>
</template>

<style scoped>
.cal {
  --cal-me: var(--nt-apricot-d);
  --cal-partner: var(--nt-powder-d);
  --cal-both: #3f7d5c;
  --cal-today: #f3f4f3;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  min-height: calc(100vh - 140px);
  font-size: 1rem;
}
.cal__head { display: flex; flex-direction: column; gap: 4px; }
.cal__title { font-size: 2rem; line-height: 1.2; }
.cal__sub { margin: 0; color: var(--nt-muted); }
.cal__synced { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }

/* Toolbar */
.cal__toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; }
.cal__nav { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.cal__today { height: 32px; padding: 0 14px; background: #fff; border: 1px solid var(--nt-line); border-radius: 6px; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-ink); cursor: pointer; }
.cal__today:hover, .cal__step:hover, .cal__sq:hover, .cal__listbtn:hover { background: var(--nt-gray); }
.cal__steps { display: inline-flex; border: 1px solid var(--nt-line); border-radius: 6px; background: #fff; overflow: hidden; }
.cal__step { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 30px; padding: 0; background: #fff; border: 0; color: var(--nt-ink); cursor: pointer; }
.cal__step + .cal__step { border-left: 1px solid var(--nt-line); }
.cal__month { margin: 0; font-family: inherit; font-size: 1.5rem; font-weight: 600; line-height: 1.3; letter-spacing: -0.01em; color: var(--nt-ink); }
.cal__tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.cal__seg { display: inline-flex; padding: 2px; background: var(--nt-gray); border-radius: 8px; }
.cal__segbtn { height: 30px; padding: 0 16px; background: transparent; border: 0; border-radius: 6px; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-muted); cursor: pointer; }
.cal__segbtn[aria-checked="true"] { background: var(--nt-plum); color: #fff; }
.cal__sq { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0; background: #fff; border: 1px solid var(--nt-line); border-radius: 6px; color: var(--nt-ink); cursor: pointer; }
.cal__search { height: 34px; width: 200px; max-width: 100%; padding: 0 10px; background: #fff; border: 1px solid var(--nt-line); border-radius: 6px; font-family: inherit; font-size: 0.875rem; color: var(--nt-ink); }
.cal__listbtn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; background: #fff; border: 1px solid var(--nt-line); border-radius: 6px; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-ink); cursor: pointer; }
.cal__today:focus-visible, .cal__step:focus-visible, .cal__segbtn:focus-visible, .cal__sq:focus-visible, .cal__search:focus-visible, .cal__listbtn:focus-visible, .cal__item:focus-visible, .cal__more:focus-visible, .cal__block:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.cal__status { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.cal__error { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: 720px; }
.cal__legend { display: flex; flex-wrap: wrap; gap: 4px 20px; margin: 0; padding: 0; list-style: none; font-size: 0.875rem; color: var(--nt-muted); }
.cal__legend li { display: inline-flex; align-items: center; gap: 8px; }
.cal__swatch { width: 12px; height: 12px; border-radius: 3px; }
.cal__swatch[data-owner="me"] { background: var(--cal-me); }
.cal__swatch[data-owner="partner"] { background: var(--cal-partner); }
.cal__swatch[data-owner="both"] { background: var(--cal-both); }

/* Layout and calendar list */
.cal__layout { display: flex; flex-direction: column; flex: 1 1 auto; gap: 16px; }
.cal__main { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
.cal__layers { display: none; padding: 12px 16px; background: #fff; border: 1px solid var(--nt-line); border-radius: 8px; }
.cal__layers--open { display: block; }
.cal__layers-h { margin: 0 0 8px; font-family: inherit; font-size: 0.875rem; font-weight: 600; color: var(--nt-muted); }
.cal__layerlist { margin: 0; padding: 0; list-style: none; }
.cal__layer { position: relative; display: flex; align-items: center; gap: 10px; min-height: 40px; cursor: pointer; font-size: 0.9375rem; color: var(--nt-ink); }
.cal__layer:has(input:focus-visible) .cal__box { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.cal__box { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 18px; height: 18px; border: 1px solid var(--nt-muted); border-radius: 4px; background: #fff; color: #fff; }
.cal__box--on { background: var(--c, var(--nt-plum)); border-color: var(--c, var(--nt-plum)); }
.cal__box[data-owner="me"] { --c: var(--cal-me); color: var(--nt-ink); }
.cal__box[data-owner="partner"] { --c: var(--cal-partner); }
.cal__box[data-owner="both"] { --c: var(--cal-both); }
.cal__box[data-owner="night"] { --c: var(--nt-plum); }
.cal__avs { display: inline-flex; }
.cal__av { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; border: 2px solid #fff; font-size: 0.75rem; font-weight: 600; color: var(--nt-ink); background: var(--nt-gray); }
.cal__av + .cal__av { margin-left: -8px; }
.cal__av[data-owner="me"] { background: var(--nt-apricot); }
.cal__av[data-owner="partner"] { background: var(--nt-powder); }
.cal__lname { min-width: 0; overflow-wrap: anywhere; }

/* Month grid */
.cal__grid { display: flex; flex-direction: column; flex: 1 1 auto; min-height: calc(100vh - 260px); background: #fff; border-top: 1px solid var(--nt-line); border-left: 1px solid var(--nt-line); }
.cal__dow { flex: none; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.cal__dowcell { display: flex; align-items: center; justify-content: center; height: 44px; border-right: 1px solid var(--nt-line); border-bottom: 1px solid var(--nt-line); font-size: 0.875rem; font-weight: 500; color: var(--nt-muted); }
.cal__week { position: relative; flex: 1 1 0; min-height: 130px; }
.cal__row { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.cal__cell { position: relative; border-right: 1px solid var(--nt-line); border-bottom: 1px solid var(--nt-line); cursor: pointer; }
.cal__cell:hover { background: var(--nt-bg); }
.cal__cell--today, .cal__cell--today:hover { background: var(--cal-today); }
.cal__cell--selected { outline: 1px solid var(--nt-plum); outline-offset: -1px; }
.cal__cell:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: -2px; z-index: 1; }
.cal__night { position: absolute; left: 0; right: 0; bottom: 0; display: flex; height: 3px; }
.cal__nightpart { flex: 1; background: var(--nt-muted); }
.cal__nightpart[data-who="me"] { background: var(--cal-me); }
.cal__nightpart[data-who="partner"] { background: var(--cal-partner); }
.cal__dots { display: none; }

.cal__fg { position: relative; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-template-rows: 36px repeat(3, 22px) 22px; row-gap: 2px; min-height: 130px; padding-bottom: 8px; pointer-events: none; }
.cal__fg > * { pointer-events: auto; }
.cal__num { display: flex; align-items: center; justify-content: center; justify-self: center; align-self: center; min-width: 26px; height: 26px; border-radius: 50%; font-size: 0.875rem; font-weight: 500; color: var(--nt-ink); pointer-events: none; }
.cal__fg > .cal__num { pointer-events: none; }
.cal__num--sun { color: var(--nt-coral); }
.cal__num--out { color: var(--nt-muted); }
.cal__num--today { background: var(--nt-plum); color: #fff; }

.cal__item { min-width: 0; height: 22px; padding: 0; border: 0; font-family: inherit; font-size: 0.8125rem; line-height: 22px; text-align: left; cursor: pointer; }
.cal__item--out { opacity: 0.6; }
.cal__bar { display: flex; align-items: center; margin: 0 2px; padding: 0 6px; border-radius: 4px; background: var(--cal-both); color: #fff; font-weight: 700; }
.cal__bar[data-owner="me"] { background: var(--cal-me); color: var(--nt-ink); }
.cal__bar[data-owner="partner"] { background: var(--cal-partner); }
.cal__bar--l { margin-left: 0; border-top-left-radius: 0; border-bottom-left-radius: 0; }
.cal__bar--r { margin-right: 0; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.cal__bar .cal__evtitle { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.cal__ev { container-type: inline-size; display: flex; align-items: center; gap: 4px; margin: 0 2px; padding: 0 4px; border-radius: 4px; background: transparent; color: var(--nt-ink); }
.cal__ev:hover { background: var(--nt-gray); }
.cal__evdot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--cal-both); }
.cal__ev[data-owner="me"] .cal__evdot { background: var(--cal-me); }
.cal__ev[data-owner="partner"] .cal__evdot { background: var(--cal-partner); }
.cal__ev .cal__evtitle { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 500; }
.cal__evtime { flex: none; font-size: 0.8125rem; color: var(--nt-muted); }
@container (max-width: 119px) {
  .cal__evtime { display: none; }
}
.cal__more { justify-self: end; align-self: center; height: 20px; margin-right: 4px; padding: 0 6px; background: #fff; border: 1px solid var(--nt-line); border-radius: 4px; font-family: inherit; font-size: 0.8125rem; line-height: 18px; color: var(--nt-muted); cursor: pointer; }
.cal__more:hover { background: var(--nt-gray); }

/* Week */
.cal__wk { background: #fff; border-top: 1px solid var(--nt-line); border-left: 1px solid var(--nt-line); }
.cal__wkhead, .cal__wkall, .cal__wkbody { display: grid; grid-template-columns: 56px minmax(0, 1fr); }
.cal__wkhead { grid-template-columns: 56px repeat(7, minmax(0, 1fr)); }
.cal__gutter { border-right: 1px solid var(--nt-line); border-bottom: 1px solid var(--nt-line); }
.cal__gutter--label { display: flex; align-items: center; justify-content: center; font-size: 0.875rem; color: var(--nt-muted); }
.cal__wkday { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0 10px; border-right: 1px solid var(--nt-line); border-bottom: 1px solid var(--nt-line); }
.cal__wkname { font-size: 0.875rem; font-weight: 500; color: var(--nt-muted); }
.cal__wknum { display: flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; border-radius: 50%; font-size: 1rem; font-weight: 500; color: var(--nt-ink); }
.cal__wkall .cal__wkallarea { position: relative; border-bottom: 1px solid var(--nt-line); min-height: 26px; }
.cal__wkallbg { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.cal__wkallcol { border-right: 1px solid var(--nt-line); }
.cal__wkallfg { position: relative; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 2px; padding: 2px 0; }
.cal__wkscroll { max-height: 576px; overflow-y: auto; border-bottom: 1px solid var(--nt-line); }
.cal__wkbody { position: relative; }
.cal__hours { position: relative; border-bottom: 0; }
.cal__hour { position: absolute; right: 8px; transform: translateY(-50%); font-size: 0.875rem; color: var(--nt-muted); white-space: nowrap; }
.cal__wkgrid { position: relative; }
.cal__wklines { position: absolute; inset: 0; }
.cal__wkline { display: block; box-sizing: border-box; border-bottom: 1px solid var(--nt-line); }
.cal__wkcols { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.cal__wkcol { position: relative; border-right: 1px solid var(--nt-line); cursor: pointer; }
.cal__wkcol--today { background: var(--cal-today); }
.cal__wkcol:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: -2px; }
.cal__block { position: absolute; display: flex; flex-direction: column; align-items: flex-start; overflow: hidden; padding: 2px 6px; border: 0; border-radius: 4px; background: var(--cal-both); color: #fff; font-family: inherit; font-size: 0.8125rem; line-height: 1.3; text-align: left; cursor: pointer; }
.cal__block[data-owner="me"] { background: var(--cal-me); color: var(--nt-ink); }
.cal__block[data-owner="partner"] { background: var(--cal-partner); }
.cal__blocktitle { max-width: 100%; overflow: hidden; font-weight: 700; white-space: nowrap; text-overflow: ellipsis; }
.cal__blocktime { max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

@media (min-width: 1200px) {
  .cal__layout { flex-direction: row; align-items: stretch; gap: 24px; }
  .cal__layers { display: block; flex: none; align-self: flex-start; width: 240px; }
  .cal__listbtn { display: none; }
}
@media (max-width: 767px) {
  .cal__title { font-size: 1.75rem; }
  .cal__month { font-size: 1.25rem; }
  .cal__grid { min-height: 0; }
  .cal__week { flex: none; min-height: 64px; }
  .cal__fg { grid-template-rows: 32px; min-height: 64px; padding-bottom: 0; }
  .cal__item, .cal__more { display: none; }
  .cal__dots { position: absolute; left: 0; right: 0; bottom: 8px; display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; }
  .cal__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--cal-both); }
  .cal__dot[data-owner="me"] { background: var(--cal-me); }
  .cal__dot[data-owner="partner"] { background: var(--cal-partner); }
  .cal__wkhead, .cal__wkall, .cal__wkbody { grid-template-columns: 44px minmax(0, 1fr); }
  .cal__wkhead { grid-template-columns: 44px repeat(7, minmax(0, 1fr)); }
}
</style>
