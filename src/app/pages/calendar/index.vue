<script setup>
import { useToast } from "@/app/composables/useToast";
import LoadingScreen from "@/app/components/LoadingScreen.vue";
import "@/app/app.css";
import { computed, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
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
  monthLabel,
  nightOwner,
  shiftMonth,
  sortDayEvents,
  weekdayLabels,
  weekDays,
  weekStartOf,
  isBarEvent,
} from "@/app/utils/calendarHelpers";
import { addDays, parseIso, toIso } from "@/app/utils/rotaHelpers";
import { describeSharedError, ownerKey, ownerLabel, ownerUid } from "@/app/utils/sharedHelpers";
import { displayName, HOME_KEY } from "@/app/composables/useHome";
import { usePrefs } from "@/app/composables/usePrefs";
import { setGoogleToggle, useGoogleCalendarClient } from "@/app/composables/useGoogleCalendarClient";
import { SHARED_KEY } from "@/app/composables/useShared";
import { useCalendarStore } from "@/app/stores/calendar";
import { useRotaStore } from "@/app/stores/rota";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";

defineOptions({ name: "CalendarPage" });

// The layout provides the household and the bound stores. Names fall back to "Me" and
// "Your partner" when the page is used on its own.
const home = inject(HOME_KEY, null);
const shared = inject(SHARED_KEY, null);
const store = useCalendarStore();
const rota = useRotaStore();
const { selectedBaby } = useSelectedBaby();
// An event shows for this baby if it has no babyIds (older events, or "all babies")
// or if the selected baby is in its list.
const forSelectedBaby = (e) =>
  !e.babyIds?.length || e.babyIds.includes(selectedBaby.value?.id ?? "primary");

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
// Google Calendar events (browser mode) are a read only layer, never written to Firestore.
const gcal = useGoogleCalendarClient();
const isGoogle = (event) => event?.source === "google";
const tone = (event) => (isGoogle(event) ? "google" : ownerTone(event.owner));

// Shared data state. The page waits for the household id, so it never shows an error first.
const householdId = computed(() => home?.householdId?.value ?? store.householdId);
const loading = computed(() => !householdId.value || store.loading);
const errorInfo = computed(() => (store.error ? describeSharedError(store.error.code, "calendar") : null));
function retry() {
  shared?.retry();
}

const todayIso = toIso(new Date());
const todayNum = parseIso(todayIso).getDate();

const VIEWS = [
  { value: "day", label: "Day", key: "D" },
  { value: "week", label: "Week", key: "W" },
  { value: "month", label: "Month", key: "M" },
];
const view = ref("month");
// One date drives every view, like Google Calendar: the month, the week and the day
// are all worked out from it, so switching views keeps you where you were.
const focusIso = ref(todayIso);
const cursor = computed(() => {
  const d = parseIso(focusIso.value);
  return { year: d.getFullYear(), month: d.getMonth() };
});

// The week start comes from Settings (Display), so changing it there changes these grids.
const { weekStart } = usePrefs();
const weekdays = computed(() => weekdayLabels(weekStart.value));
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekdayNames = computed(() => weekdays.value.map((_, i) => WEEKDAY_NAMES[(weekStart.value + i) % 7]));
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const dowOf = (iso) => DOW[parseIso(iso).getDay()];

const weekIsos = computed(() => weekDays(weekStartOf(focusIso.value, weekStart.value)));
// The columns of the time grid: seven for a week, one for a day.
const colIsos = computed(() => (view.value === "day" ? [focusIso.value] : weekIsos.value));

const monthName = (m) => monthLabel(2000, m).split(" ")[0];
const label = computed(() => {
  if (view.value === "month") return monthLabel(cursor.value.year, cursor.value.month);
  const a = parseIso(colIsos.value[0]);
  if (view.value === "day") return `${a.getDate()} ${monthName(a.getMonth())} ${a.getFullYear()}`;
  const b = parseIso(colIsos.value[colIsos.value.length - 1]);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return monthLabel(a.getFullYear(), a.getMonth());
  const short = (d) => monthName(d.getMonth()).slice(0, 3);
  if (a.getFullYear() === b.getFullYear()) return `${short(a)} – ${short(b)} ${b.getFullYear()}`;
  return `${short(a)} ${a.getFullYear()} – ${short(b)} ${b.getFullYear()}`;
});
const stepNoun = computed(() => VIEWS.find((v) => v.value === view.value).label.toLowerCase());
const grid = computed(() => monthGrid(cursor.value.year, cursor.value.month, weekStart.value));
const dayNumber = (day) => {
  if (day.day !== 1 || day.iso === todayIso) return String(day.day);
  return `1 ${monthName(parseIso(day.iso).getMonth()).slice(0, 3)}`;
};

// Calendar list: which layers are shown.
const layers = reactive({ me: true, partner: true, both: true, night: true });

// Mini month in the sidebar. It pages on its own, and snaps back when the main view moves.
const mini = reactive({ year: cursor.value.year, month: cursor.value.month });
watch(cursor, (c) => {
  mini.year = c.year;
  mini.month = c.month;
});
const miniGrid = computed(() => monthGrid(mini.year, mini.month, weekStart.value).flat());
const miniTitle = computed(() => monthLabel(mini.year, mini.month));
function stepMini(delta) {
  const next = shiftMonth(mini.year, mini.month, delta);
  mini.year = next.year;
  mini.month = next.month;
}
function pickMini(iso) {
  focusIso.value = iso;
  selectedDay.value = iso;
}

// View menu
const viewMenu = ref(false);
const menuRoot = ref(null);
const viewLabel = computed(() => VIEWS.find((v) => v.value === view.value).label);
function onDocClick(event) {
  if (viewMenu.value && !menuRoot.value?.contains(event.target)) viewMenu.value = false;
}

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
  const own = store.events.filter(
  (e) => forSelectedBaby(e) && layers[ownerTone(e.owner)] !== false && (!q || String(e.title).toLowerCase().includes(q)),
  );
  const google = gcal.layerEvents.value.filter((e) => !q || String(e.title).toLowerCase().includes(q));
  return [...own, ...google];
});

const shownIsos = computed(() => (view.value === "month" ? grid.value.flat().map((d) => d.iso) : colIsos.value));
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
  if (isGoogle(event)) {
    const at = event.allDay || !event.start ? "all day" : eventTimeLabel(event);
    return `${event.title}, ${at}, from Google Calendar`;
  }
  const when = event.allDay || !event.start ? "all day" : eventTimeLabel(event);
  return `${event.title}, ${when}, ${ownerName(event.owner)}`;
}
const startClock = (event) => (isBarEvent(event) ? "" : formatClock(event.start));

const inMonthOf = (iso, m) => {
  const d = parseIso(iso);
  return d.getFullYear() === m.year && d.getMonth() === m.month;
};
function step(delta) {
  if (view.value === "month") {
    const next = shiftMonth(cursor.value.year, cursor.value.month, delta);
    focusIso.value = inMonthOf(todayIso, next) ? todayIso : toIso(new Date(next.year, next.month, 1));
  } else {
    focusIso.value = addDays(focusIso.value, view.value === "week" ? delta * 7 : delta);
  }
}
function goToday() {
  focusIso.value = todayIso;
}
function setView(next) {
  viewMenu.value = false;
  view.value = next;
}
function inMonth(iso) {
  return inMonthOf(iso, cursor.value);
}

// Swipe sideways to move on, like the phone app.
let touch = null;
function onTouchStart(event) {
  const t = event.touches[0];
  touch = { x: t.clientX, y: t.clientY };
}
function onTouchEnd(event) {
  if (!touch) return;
  const t = event.changedTouches[0];
  const dx = t.clientX - touch.x;
  const dy = t.clientY - touch.y;
  touch = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
}

// Weekly: all day row, then an hour grid.
const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, h) => (h === 0 ? "" : `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`));
const allDayLayout = computed(() =>
  layoutWeekEvents(
    visibleEvents.value.filter(isBarEvent),
    colIsos.value,
    Infinity,
  ),
);
const blocks = computed(() => {
  const map = {};
  for (const iso of colIsos.value) map[iso] = dayBlocks(visibleEvents.value, iso);
  return map;
});
const blockStyle = (b) => ({
  top: `${(b.startMin / 60) * HOUR_PX + 1}px`,
  height: `${((b.endMin - b.startMin) / 60) * HOUR_PX - 2}px`,
  left: `calc(${(b.col / b.cols) * 100}% + 2px)`,
  width: `calc(${100 / b.cols}% - 4px)`,
});
const scroller = ref(null);
// The hour grid keeps its scroll position when you move to another week or day.
let savedScroll = 7 * HOUR_PX;
async function restoreScroll() {
  await nextTick();
  if (scroller.value) scroller.value.scrollTop = savedScroll;
}
function onHoursScroll(event) {
  savedScroll = event.target.scrollTop;
}

// Moving on slides the grid the way you went; changing the view just fades.
const slide = ref("fade");
const stageKey = computed(() => (view.value === "month" ? `m-${cursor.value.year}-${cursor.value.month}` : `${view.value}-${colIsos.value[0]}`));
watch(focusIso, (next, prev) => {
  slide.value = next > prev ? "next" : "prev";
});
watch(view, () => {
  slide.value = "fade";
});
// The red "now" line on today's column, moved once a minute.
const minutesNow = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
const nowMin = ref(minutesNow());
const nowTop = computed(() => `${(nowMin.value / 60) * HOUR_PX}px`);
let clock = 0;
function onKey(event) {
  if (event.key === "Escape") {
      viewMenu.value = false;
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented || panelOpen.value) return;
  const t = event.target;
  if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  const k = event.key.toLowerCase();
  if (k === "t") goToday();
  else if (k === "d") setView("day");
  else if (k === "w") setView("week");
  else if (k === "m") setView("month");
  else if (k === "j" || k === "n") step(1);
  else if (k === "k" || k === "p") step(-1);
  else if (k === "c") {
    event.preventDefault();
    openDay(defaultAddDate(), null, true);
  }
}
onMounted(() => {
  if (view.value !== "month") restoreScroll();
  clock = window.setInterval(() => (nowMin.value = minutesNow()), 60000);
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  window.clearInterval(clock);
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onKey);
});

// Day panel
const panelOpen = ref(false);
const panelDate = ref(todayIso);
const panelAdding = ref(false);
const panelEditId = ref("");
const selectedDay = ref(null);
const panelEvents = computed(() =>
  sortDayEvents(eventsOnDay(store.events.filter(forSelectedBaby), panelDate.value)),
);
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
  if (isGoogle(event)) return openDay(event.date, trigger);
  openDay(event.date, trigger, false, event.id);
}
function onCellKey(iso, event) {
  openDay(iso, event.currentTarget);
}
function defaultAddDate() {
  if (view.value === "day") return focusIso.value;
  if (view.value === "week") {
    if (selectedDay.value && weekIsos.value.includes(selectedDay.value)) return selectedDay.value;
    return weekIsos.value.includes(todayIso) ? todayIso : weekIsos.value[0];
  }
  if (selectedDay.value && inMonth(selectedDay.value)) return selectedDay.value;
  if (inMonth(todayIso)) return todayIso;
  return toIso(new Date(cursor.value.year, cursor.value.month, 1));
}
function openAdd(event) {
  openDay(defaultAddDate(), event.currentTarget, true);
}
function closePanel() {
  panelOpen.value = false;
}
const { showToast } = useToast();
async function onSave(payload) {
  const { id, owner, ...rest } = payload;
  const data = { ...rest, owner: ownerUid(owner, myUid.value, rota.partnerUid || store.partnerUid) ?? "both" };
  const saved = id ? await store.updateEvent(id, data) : await store.addEvent(data);
  if (!saved) return;
  showToast({ title: id ? "Event updated" : "Event saved", text: saved.title ?? "" });
  panelDate.value = saved.date;
  selectedDay.value = saved.date;
  focusIso.value = saved.date;
}
function onDelete(id) {
  store.removeEvent(id);
}
</script>

<template>
  <div class="cal">
    <h1 class="visually-hidden">Calendar</h1>

    <section class="cal__toolbar" :class="{ 'cal__toolbar--searching': searchOpen }" aria-label="Calendar controls">
      <button type="button" class="cal__today" aria-label="Today" @click="goToday">
        <span class="cal__todaytxt">Today</span>
        <span class="cal__todaynum" aria-hidden="true">{{ todayNum }}</span>
      </button>
      <div class="cal__steps">
        <button type="button" class="cal__icon" :aria-label="`Previous ${stepNoun}`" @click="step(-1)">
          <Icon name="chevron-left" :size="20" />
        </button>
        <button type="button" class="cal__icon" :aria-label="`Next ${stepNoun}`" @click="step(1)">
          <Icon name="chevron" :size="20" />
        </button>
      </div>
      <h2 id="cal-month" class="cal__month" aria-live="polite">{{ label }}</h2>
      <div class="cal__tools">
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
          class="cal__icon"
          :aria-label="searchOpen ? 'Close search' : 'Search events'"
          :aria-expanded="searchOpen ? 'true' : 'false'"
          @click="toggleSearch"
        >
          <Icon :name="searchOpen ? 'x' : 'search'" :size="20" />
        </button>
        <div ref="menuRoot" class="cal__viewwrap">
          <button
            type="button"
            class="cal__view"
            aria-haspopup="menu"
            :aria-expanded="viewMenu ? 'true' : 'false'"
            aria-label="Calendar view"
            @click="viewMenu = !viewMenu"
          >
            <span>{{ viewLabel }}</span>
            <Icon name="chevron-down" :size="16" />
          </button>
          <ul v-if="viewMenu" class="cal__menulist" role="menu" aria-label="Calendar view">
            <li v-for="option in VIEWS" :key="option.value" role="none">
              <button
                type="button"
                role="menuitemradio"
                class="cal__menuitem"
                :aria-checked="view === option.value ? 'true' : 'false'"
                @click="setView(option.value)"
              >
                <span>{{ option.label }}</span>
                <kbd class="cal__kbd" aria-hidden="true">{{ option.key }}</kbd>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <div aria-live="polite">
      <LoadingScreen v-if="loading" variant="inline" label="Loading the calendar" />
    </div>

    <div v-if="!loading && errorInfo" class="cal__error alert alert-danger" role="alert">
      <p class="mb-0">{{ errorInfo.text }}</p>
      <p v-if="errorInfo.detail" class="cal__status">{{ errorInfo.detail }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="retry">Try again</button>
    </div>

    <p v-if="store.writeError" class="app-error-text" role="alert">{{ store.writeError }}</p>

    <div class="cal__layout">
      <aside id="cal-side" class="cal__side" aria-label="Dates and calendars">
        <button type="button" class="cal__create" @click="openAdd">
          <Icon name="plus" :size="24" />
          <span>Create</span>
        </button>

        <section class="cal__mini" aria-label="Choose a date">
          <div class="cal__minihead">
            <h2 class="cal__minititle">{{ miniTitle }}</h2>
            <button type="button" class="cal__icon cal__icon--sm" aria-label="Previous month in the date picker" @click="stepMini(-1)">
              <Icon name="chevron-left" :size="16" />
            </button>
            <button type="button" class="cal__icon cal__icon--sm" aria-label="Next month in the date picker" @click="stepMini(1)">
              <Icon name="chevron" :size="16" />
            </button>
          </div>
          <div class="cal__minigrid">
            <span v-for="w in weekdays" :key="w" class="cal__minidow" aria-hidden="true">{{ w.charAt(0) }}</span>
            <button
              v-for="d in miniGrid"
              :key="d.iso"
              type="button"
              class="cal__miniday"
              :class="{
                'cal__miniday--today': d.iso === todayIso,
                'cal__miniday--focus': d.iso === focusIso && d.iso !== todayIso && view !== 'month',
              }"
              :aria-label="dayHeading(d.iso)"
              :aria-current="d.iso === todayIso ? 'date' : undefined"
              @click="pickMini(d.iso)"
            >
              {{ d.day }}
            </button>
          </div>
        </section>

        <section class="cal__layers" aria-labelledby="cal-layers-h">
          <h2 id="cal-layers-h" class="cal__layers-h">Calendars</h2>
          <ul class="cal__layerlist">
            <li v-for="item in [
              { key: 'me', text: `${names.me}'s events`, tone: 'me' },
              { key: 'partner', text: `${names.partner}'s events`, tone: 'partner' },
              { key: 'both', text: 'Shared events', tone: 'both' },
              { key: 'night', text: 'Night duty', tone: 'night' },
            ]" :key="item.key">
              <label class="cal__layer">
                <input v-model="layers[item.key]" type="checkbox" class="visually-hidden" />
                <span class="cal__box" :class="{ 'cal__box--on': layers[item.key] }" :data-owner="item.tone" aria-hidden="true">
                  <Icon v-if="layers[item.key]" name="check" :size="14" />
                </span>
                <span class="cal__lname">{{ item.text }}</span>
              </label>
            </li>
            <li v-if="gcal.state.connected">
              <label class="cal__layer">
                <input
                  type="checkbox"
                  class="visually-hidden"
                  :checked="gcal.state.toggles.show"
                  @change="setGoogleToggle('show', $event.target.checked)"
                />
                <span class="cal__box" :class="{ 'cal__box--on': gcal.state.toggles.show }" data-owner="google" aria-hidden="true">
                  <Icon v-if="gcal.state.toggles.show" name="check" :size="14" />
                </span>
                <span class="cal__lname">Google Calendar</span>
              </label>
            </li>
          </ul>
          <p class="cal__hint">The thin line under a day shows who is on duty that night.</p>
          <p v-if="googleSynced" class="cal__hint">Synced with Google Calendar.</p>
        </section>
      </aside>

      <div class="cal__main" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
        <Transition :name="`cal-${slide}`" mode="out-in" @enter="restoreScroll">
        <div :key="stageKey" class="cal__stage">
        <!-- Month -->
        <div v-if="view === 'month' && !loading && !errorInfo" class="cal__grid" role="grid" aria-labelledby="cal-month">
          <div class="cal__dow visually-hidden" role="row">
            <div v-for="(w, i) in weekdays" :key="w" role="columnheader" :aria-label="weekdayNames[i]">{{ w }}</div>
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
                    :data-owner="tone(event)"
                  ></span>
                </span>
              </div>
            </div>
            <div class="cal__fg" :class="{ 'cal__fg--first': wi === 0 }" role="presentation">
              <span
                v-for="(day, i) in week"
                :key="day.iso"
                class="cal__d"
                :style="{ gridColumn: i + 1, gridRow: 1 }"
                aria-hidden="true"
              >
                <span v-if="wi === 0" class="cal__dname" :class="{ 'cal__dname--today': day.iso === todayIso }">{{ dowOf(day.iso) }}</span>
                <span class="cal__num" :class="{ 'cal__num--today': day.iso === todayIso }">{{ dayNumber(day) }}</span>
              </span>
              <button
                v-for="item in layouts[wi].items"
                :key="item.event.id + ':' + item.start"
                type="button"
                class="cal__item"
                :class="[
                  item.bar ? 'cal__bar' : 'cal__ev',
                  { 'cal__bar--l': item.contLeft, 'cal__bar--r': item.contRight },
                ]"
                :data-owner="tone(item.event)"
                :data-event="item.event.id"
                :aria-label="eventLabel(item.event)"
                :style="{ gridColumn: `${item.start + 1} / span ${item.span}`, gridRow: item.lane + 2 }"
                @click="openEvent(item.event, $event.currentTarget)"
              >
                <span v-if="!item.bar" class="cal__evdot" aria-hidden="true"></span>
                <span v-if="!item.bar" class="cal__evtime">{{ startClock(item.event) }}</span>
                <span class="cal__evtitle">{{ item.event.title }}</span>
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
                {{ count }} more
              </button>
            </div>
          </div>
        </div>

        <!-- Week and day -->
        <div v-else-if="!loading && !errorInfo" class="cal__wk" role="grid" aria-labelledby="cal-month" :style="{ '--cols': colIsos.length }">
          <div class="cal__wkhead" role="row">
            <div class="cal__gutter" role="presentation"></div>
            <div
              v-for="iso in colIsos"
              :key="iso"
              role="columnheader"
              class="cal__wkday"
              :aria-label="dayHeading(iso)"
              :aria-current="iso === todayIso ? 'date' : undefined"
            >
              <span class="cal__wkname" :class="{ 'cal__wkname--today': iso === todayIso }">{{ dowOf(iso) }}</span>
              <span class="cal__wknum" :class="{ 'cal__num--today': iso === todayIso }">{{ parseIso(iso).getDate() }}</span>
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
                <span v-for="iso in colIsos" :key="iso" class="cal__wkallcol"></span>
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
                  :data-owner="tone(item.event)"
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
          <div ref="scroller" class="cal__wkscroll" @scroll.passive="onHoursScroll">
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
                    v-for="iso in colIsos"
                    :key="iso"
                    role="gridcell"
                    tabindex="0"
                    class="cal__wkcol"
                    :data-date="iso"
                    :aria-label="dayLabel(iso)"
                    @click="openDay(iso, $event.currentTarget)"
                    @keydown.enter.self.prevent="onCellKey(iso, $event)"
                    @keydown.space.self.prevent="onCellKey(iso, $event)"
                  >
                    <span v-if="iso === todayIso" class="cal__now" :style="{ top: nowTop }" aria-hidden="true"></span>
                    <button
                      v-for="b in blocks[iso]"
                      :key="b.event.id"
                      type="button"
                      class="cal__block"
                      :data-owner="tone(b.event)"
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
        </Transition>
      </div>
    </div>

    <button type="button" class="cal__fab" aria-label="Create event" @click="openAdd">
      <Icon name="plus" :size="26" />
    </button>

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
/* Styled after Google Calendar so people who link their own calendar feel at home. */
.cal {
  --g-blue: #0b57d0;
  --g-blue-soft: #d3e3fd;
  --g-blue-ink: #041e49;
  --g-ink: #1f1f1f;
  --g-mute: #444746;
  --g-line: #dadce0;
  --g-hover: #f1f3f4;
  --g-red: #ea4335;
  --cal-me: var(--nt-apricot-d);
  --cal-partner: var(--nt-powder-d);
  --cal-both: #3f7d5c;
  --cal-google: #0b8043;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  font-size: 0.875rem;
  color: var(--g-ink);
}
button { font-family: inherit; }

/* Toolbar */
.cal__toolbar { display: flex; align-items: center; gap: 4px; min-height: 64px; }
.cal__icon { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; background: transparent; border: 0; border-radius: 50%; color: var(--g-mute); cursor: pointer; }
.cal__icon--sm { width: 32px; height: 32px; }
.cal__icon:hover { background: var(--g-hover); }
.cal__today { display: inline-flex; align-items: center; justify-content: center; height: 40px; margin: 0 12px 0 8px; padding: 0 20px; background: transparent; border: 1px solid #747775; border-radius: 20px; font-size: 0.875rem; font-weight: 500; color: var(--g-ink); cursor: pointer; }
.cal__today:hover { background: var(--g-hover); }
.cal__todaynum { display: none; }
.cal__steps { display: inline-flex; gap: 4px; }
.cal__month { flex: 1 1 auto; min-width: 0; margin: 0 0 0 8px; overflow: hidden; font-family: inherit; font-size: 1.375rem; font-weight: 400; line-height: 1.2; color: var(--g-ink); white-space: nowrap; text-overflow: ellipsis; }
.cal__tools { display: flex; flex: none; align-items: center; gap: 4px; }
.cal__search { width: 220px; max-width: 100%; height: 40px; padding: 0 16px; background: var(--g-hover); border: 1px solid transparent; border-radius: 20px; font-family: inherit; font-size: 0.875rem; color: var(--g-ink); }
.cal__viewwrap { position: relative; margin-left: 8px; }
.cal__view { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px 0 20px; background: transparent; border: 1px solid #747775; border-radius: 20px; font-size: 0.875rem; font-weight: 500; color: var(--g-ink); cursor: pointer; }
.cal__view:hover, .cal__view[aria-expanded="true"] { background: var(--g-hover); }
.cal__menulist { position: absolute; top: 44px; right: 0; z-index: 25; min-width: 160px; margin: 0; padding: 8px 0; list-style: none; background: #fff; border-radius: 8px; box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3), 0 2px 6px 2px rgba(60, 64, 67, 0.15); }
.cal__menuitem { display: flex; align-items: center; justify-content: space-between; gap: 24px; width: 100%; height: 36px; padding: 0 16px; background: transparent; border: 0; font-size: 0.875rem; color: var(--g-ink); text-align: left; cursor: pointer; }
.cal__menuitem:hover { background: var(--g-hover); }
.cal__menuitem[aria-checked="true"] { color: var(--g-blue); font-weight: 600; }
.cal__kbd { font-family: inherit; font-size: 0.75rem; color: var(--g-mute); }
.cal__today:focus-visible, .cal__icon:focus-visible, .cal__view:focus-visible, .cal__menuitem:focus-visible, .cal__search:focus-visible, .cal__item:focus-visible, .cal__more:focus-visible, .cal__block:focus-visible, .cal__create:focus-visible, .cal__miniday:focus-visible, .cal__fab:focus-visible { outline: 2px solid var(--g-blue); outline-offset: 2px; }

.cal__status { margin: 0; font-size: 0.875rem; color: var(--g-mute); }
.cal__error { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: 720px; }

/* Sidebar */
.cal__layout { position: relative; display: flex; align-items: flex-start; gap: 16px; }
.cal__side { display: flex; flex-direction: column; gap: 24px; flex: none; width: 256px; }
.cal__create { display: inline-flex; align-self: flex-start; align-items: center; gap: 12px; height: 56px; padding: 0 24px 0 16px; background: #fff; border: 0; border-radius: 16px; box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); font-size: 0.875rem; font-weight: 500; color: var(--g-ink); cursor: pointer; transition: box-shadow 0.2s ease, background-color 0.2s ease; }
.cal__create:hover { background: #f8f9fa; box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3), 0 6px 10px 4px rgba(60, 64, 67, 0.15); }

.cal__mini { padding: 0 4px; }
.cal__minihead { display: flex; align-items: center; margin-bottom: 4px; }
.cal__minititle { flex: 1; margin: 0; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--g-ink); }
.cal__minigrid { display: grid; grid-template-columns: repeat(7, 1fr); justify-items: center; row-gap: 2px; }
.cal__minidow { display: flex; align-items: center; justify-content: center; height: 24px; font-size: 0.6875rem; font-weight: 500; color: var(--g-mute); }
.cal__miniday { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; background: transparent; border: 0; border-radius: 50%; font-size: 0.6875rem; font-weight: 500; color: var(--g-ink); cursor: pointer; }
.cal__miniday:hover { background: var(--g-hover); }
.cal__miniday--focus, .cal__miniday--focus:hover { background: var(--g-blue-soft); color: var(--g-blue-ink); }
.cal__miniday--today, .cal__miniday--today:hover { background: var(--g-blue); color: #fff; }

.cal__layers-h { margin: 0 0 4px; padding: 0 8px; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--g-ink); }
.cal__layerlist { margin: 0; padding: 0; list-style: none; }
.cal__layer { position: relative; display: flex; align-items: center; gap: 14px; min-height: 36px; padding: 0 8px; border-radius: 8px; cursor: pointer; font-size: 0.875rem; color: var(--g-ink); }
.cal__layer:hover { background: var(--g-hover); }
.cal__layer:has(input:focus-visible) .cal__box { outline: 2px solid var(--g-blue); outline-offset: 2px; }
.cal__box { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 18px; height: 18px; border: 2px solid var(--c, var(--g-mute)); border-radius: 3px; background: #fff; color: #fff; }
.cal__box--on { background: var(--c, var(--g-blue)); border-color: var(--c, var(--g-blue)); }
.cal__box[data-owner="me"] { --c: var(--cal-me); color: var(--nt-ink); }
.cal__box[data-owner="partner"] { --c: var(--cal-partner); }
.cal__box[data-owner="both"] { --c: var(--cal-both); }
.cal__box[data-owner="night"] { --c: var(--g-mute); }
.cal__box[data-owner="google"] { --c: var(--cal-google); }
.cal__lname { min-width: 0; overflow-wrap: anywhere; }
.cal__hint { margin: 8px 8px 0; font-size: 0.75rem; line-height: 1.4; color: var(--g-mute); }

/* Main panel */
.cal__main { display: flex; flex-direction: column; flex: 1 1 0; min-width: 0; background: #fff; border: 1px solid var(--g-line); border-radius: 16px; overflow: hidden; }

/* Moving between months, weeks and days */
.cal__stage { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
.cal-next-enter-active, .cal-prev-enter-active { transition: opacity 0.22s ease, transform 0.26s cubic-bezier(0.22, 0.61, 0.36, 1); }
.cal-next-leave-active, .cal-prev-leave-active { transition: opacity 0.14s ease, transform 0.16s ease-in; }
.cal-fade-enter-active { transition: opacity 0.2s ease; }
.cal-fade-leave-active { transition: opacity 0.12s ease; }
.cal-next-enter-from { opacity: 0; transform: translateX(28px); }
.cal-next-leave-to { opacity: 0; transform: translateX(-28px); }
.cal-prev-enter-from { opacity: 0; transform: translateX(-28px); }
.cal-prev-leave-to { opacity: 0; transform: translateX(28px); }
.cal-fade-enter-from, .cal-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .cal-next-enter-active, .cal-prev-enter-active, .cal-next-leave-active, .cal-prev-leave-active, .cal-fade-enter-active, .cal-fade-leave-active { transition: none; }
}

/* Month grid */
.cal__grid { display: flex; flex-direction: column; flex: 1 1 auto; min-height: calc(100dvh - 150px); }
.cal__week { position: relative; flex: 1 1 0; min-height: 112px; }
.cal__row { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.cal__cell { position: relative; border-right: 1px solid var(--g-line); border-bottom: 1px solid var(--g-line); cursor: pointer; }
.cal__cell:nth-child(7n) { border-right: 0; }
.cal__week:first-of-type .cal__cell { border-top: 0; }
.cal__week:last-child .cal__cell { border-bottom: 0; }
.cal__cell--selected { background: #f6f9fe; }
.cal__cell:focus-visible { outline: 2px solid var(--g-blue); outline-offset: -2px; z-index: 1; }
.cal__night { position: absolute; left: 0; right: 0; bottom: 0; display: flex; height: 3px; }
.cal__nightpart { flex: 1; background: var(--g-mute); }
.cal__nightpart[data-who="me"] { background: var(--cal-me); }
.cal__nightpart[data-who="partner"] { background: var(--cal-partner); }
.cal__dots { display: none; }

.cal__fg { position: relative; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-template-rows: 28px repeat(3, 22px) 20px; row-gap: 2px; min-height: 112px; padding-bottom: 4px; pointer-events: none; }
.cal__fg--first { grid-template-rows: 46px repeat(3, 22px) 20px; }
.cal__fg > * { pointer-events: auto; }
.cal__d { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 4px; pointer-events: none; }
.cal__fg > .cal__d { pointer-events: none; }
.cal__dname { margin-bottom: 2px; font-size: 0.6875rem; font-weight: 500; letter-spacing: 0.04em; color: var(--g-mute); }
.cal__dname--today { color: var(--g-blue); }
.cal__num { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 6px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; color: var(--g-ink); }
.cal__num--today { background: var(--g-blue); color: #fff; }

.cal__item { min-width: 0; height: 22px; padding: 0; border: 0; font-family: inherit; font-size: 0.75rem; line-height: 22px; text-align: left; cursor: pointer; }
.cal__bar { display: flex; align-items: center; margin: 0 4px 0 2px; padding: 0 8px; border-radius: 4px; background: var(--cal-both); color: #fff; font-weight: 500; }
.cal__bar[data-owner="me"] { background: var(--cal-me); color: var(--nt-ink); }
.cal__bar[data-owner="partner"] { background: var(--cal-partner); }
.cal__bar[data-owner="google"], .cal__block[data-owner="google"] { background: var(--cal-google); color: #fff; }
.cal__bar--l { margin-left: 0; border-top-left-radius: 0; border-bottom-left-radius: 0; }
.cal__bar--r { margin-right: 0; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.cal__bar .cal__evtitle { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.cal__ev { container-type: inline-size; display: flex; align-items: center; gap: 4px; margin: 0 4px 0 2px; padding: 0 4px; border-radius: 4px; background: transparent; color: var(--g-ink); }
.cal__ev:hover { background: var(--g-hover); }
.cal__evdot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--cal-both); }
.cal__ev[data-owner="me"] .cal__evdot { background: var(--cal-me); }
.cal__ev[data-owner="partner"] .cal__evdot { background: var(--cal-partner); }
.cal__ev[data-owner="google"] .cal__evdot, .cal__dot[data-owner="google"] { background: var(--cal-google); }
.cal__ev .cal__evtitle { flex: 1; min-width: 0; overflow: hidden; font-weight: 500; white-space: nowrap; text-overflow: ellipsis; }
.cal__evtime { flex: none; font-size: 0.75rem; color: var(--g-ink); }
.cal__evtime:empty { display: none; }
@container (max-width: 99px) {
  .cal__evtime { display: none; }
}
.cal__more { justify-self: start; align-self: center; height: 20px; margin-left: 2px; padding: 0 6px; background: transparent; border: 0; border-radius: 4px; font-size: 0.75rem; font-weight: 500; line-height: 20px; color: var(--g-mute); white-space: nowrap; cursor: pointer; }
.cal__more:hover { background: var(--g-hover); }

/* Week and day */
.cal__wk { --cols: 7; display: flex; flex-direction: column; min-height: 0; }
.cal__wkhead, .cal__wkall, .cal__wkbody { display: grid; grid-template-columns: 56px minmax(0, 1fr); }
.cal__wkhead { grid-template-columns: 56px repeat(var(--cols), minmax(0, 1fr)); }
.cal__gutter { border-right: 1px solid var(--g-line); }
.cal__wkhead .cal__gutter { border-bottom: 1px solid var(--g-line); }
.cal__gutter--label { display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px; font-size: 0.625rem; color: var(--g-mute); }
.cal__wkday { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 0 12px; border-right: 1px solid var(--g-line); border-bottom: 1px solid var(--g-line); }
.cal__wkday:last-child { border-right: 0; }
.cal__wkname { font-size: 0.6875rem; font-weight: 500; letter-spacing: 0.06em; color: var(--g-mute); }
.cal__wkname--today { color: var(--g-blue); }
.cal__wknum { display: flex; align-items: center; justify-content: center; min-width: 44px; height: 44px; border-radius: 50%; font-size: 1.5rem; font-weight: 400; color: var(--g-ink); }
.cal__wknum.cal__num--today { color: #fff; }
.cal__wkall .cal__wkallarea { position: relative; min-height: 28px; border-bottom: 1px solid var(--g-line); }
.cal__wkallbg { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); }
.cal__wkallcol { border-right: 1px solid var(--g-line); }
.cal__wkallcol:last-child { border-right: 0; }
.cal__wkallfg { position: relative; display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); row-gap: 2px; padding: 3px 0; }
.cal__wkscroll { max-height: calc(100dvh - 330px); min-height: 320px; overflow-y: auto; }
.cal__wkbody { position: relative; }
.cal__hours { position: relative; }
.cal__hour { position: absolute; right: 8px; transform: translateY(-50%); font-size: 0.625rem; color: var(--g-mute); white-space: nowrap; }
.cal__wkgrid { position: relative; }
.cal__wklines { position: absolute; inset: 0; }
.cal__wkline { display: block; box-sizing: border-box; border-bottom: 1px solid var(--g-line); }
.cal__wkcols { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); }
.cal__wkcol { position: relative; border-right: 1px solid var(--g-line); cursor: pointer; }
.cal__wkcol:last-child { border-right: 0; }
.cal__wkcol:focus-visible { outline: 2px solid var(--g-blue); outline-offset: -2px; }
.cal__now { position: absolute; left: 0; right: 0; z-index: 2; height: 2px; margin-top: -1px; background: var(--g-red); pointer-events: none; }
.cal__now::before { content: ""; position: absolute; left: -6px; top: -5px; width: 12px; height: 12px; border-radius: 50%; background: var(--g-red); }
.cal__block { position: absolute; z-index: 1; display: flex; flex-direction: column; align-items: flex-start; overflow: hidden; padding: 2px 8px; border: 1px solid #fff; border-radius: 6px; background: var(--cal-both); color: #fff; font-family: inherit; font-size: 0.75rem; line-height: 1.3; text-align: left; cursor: pointer; }
.cal__block[data-owner="me"] { background: var(--cal-me); color: var(--nt-ink); }
.cal__block[data-owner="partner"] { background: var(--cal-partner); }
.cal__blocktitle { max-width: 100%; overflow: hidden; font-weight: 500; white-space: nowrap; text-overflow: ellipsis; }
.cal__blocktime { max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

/* The floating create button is for phones and tablets, where the sidebar is a drawer. */
.cal__fab { display: none; position: fixed; right: 24px; bottom: 96px; z-index: 29; align-items: center; justify-content: center; width: 56px; height: 56px; padding: 0; background: var(--g-blue-soft); border: 0; border-radius: 16px; box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); color: var(--g-blue-ink); cursor: pointer; }

@media (max-width: 1023px) {
  .cal__layout { display: block; }
  .cal__fab { display: inline-flex; }
  .cal__side { display: none; }
  .cal__month { font-size: 1.25rem; }
  .cal__grid { min-height: calc(100dvh - 200px); }
}
@media (min-width: 1024px) and (max-width: 1279px) {
  .cal__side { width: 220px; }
}

/* Phones: Google's compact layout. Dots instead of chips, swipe to move on. */
@media (max-width: 599px) {
  .cal__toolbar { min-height: 56px; }
  .cal__steps { display: none; }
  .cal__today { width: 36px; height: 36px; margin: 0 0 0 4px; padding: 0; border-radius: 8px; }
  .cal__todaytxt { display: none; }
  .cal__todaynum { display: inline; font-size: 0.9375rem; font-weight: 500; }
  .cal__month { margin-left: 4px; font-size: 1.0625rem; }
  .cal__view { padding: 0 8px 0 14px; }
  .cal__viewwrap { margin-left: 0; }
  .cal__toolbar--searching .cal__today,
  .cal__toolbar--searching .cal__month,
  .cal__toolbar--searching .cal__viewwrap { display: none; }
  .cal__toolbar--searching .cal__tools { flex: 1; }
  .cal__toolbar--searching .cal__search { flex: 1; width: auto; }
  .cal__main { border-radius: 12px; }
  .cal__grid { min-height: calc(100dvh - 190px); }
  .cal__week { min-height: 72px; }
  .cal__fg, .cal__fg--first { grid-template-rows: 28px; min-height: 72px; padding-bottom: 0; }
  .cal__fg--first { grid-template-rows: 46px; }
  .cal__item, .cal__more { display: none; }
  .cal__dots { position: absolute; left: 0; right: 0; bottom: 8px; display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; }
  .cal__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--cal-both); }
  .cal__dot[data-owner="me"] { background: var(--cal-me); }
  .cal__dot[data-owner="partner"] { background: var(--cal-partner); }
  .cal__num { padding: 0 4px; font-size: 0.6875rem; }
  .cal__wkhead, .cal__wkall, .cal__wkbody { grid-template-columns: 40px minmax(0, 1fr); }
  .cal__wkhead { grid-template-columns: 40px repeat(var(--cols), minmax(0, 1fr)); }
  .cal__wknum { min-width: 32px; height: 32px; font-size: 1rem; }
  .cal__wkday { padding: 8px 0 8px; }
  .cal__hour { right: 4px; }
  .cal__wkscroll { max-height: calc(100dvh - 300px); }
  .cal__fab { right: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .cal__create { transition: none; }
}
</style>
