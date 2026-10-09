<script setup>
import "@/v3/v3.css";
import { computed, inject, reactive, ref } from "vue";
import CalendarDayPanel from "@/v3/components/CalendarDayPanel.vue";
import V3ChipGroup from "@/v3/components/V3ChipGroup.vue";
import V3Icon from "@/v3/components/V3Icon.vue";
import {
  agendaGroups,
  agendaHeading,
  dateRangeLabel,
  dayHeading,
  eventsOnDay,
  eventTimeLabel,
  EVENT_TYPES,
  monthGrid,
  monthLabel,
  nightOwner,
  shiftMonth,
  sortDayEvents,
  weekdayLabels,
} from "@/v3/api/calendarHelpers";
import { addDays, parseIso, toIso } from "@/v3/api/rotaHelpers";
import { displayName, V3_HOME_KEY } from "@/v3/composables/useV3Home";
import { useCalendarStore } from "@/v3/stores/calendar";
import { useRotaStore } from "@/v3/stores/rota";

defineOptions({ name: "V3CalendarPage" });

// The layout provides the household. Only names are needed, so the page falls back to
// "Me" and "Your partner" when it is used on its own.
const home = inject(V3_HOME_KEY, null);
const store = useCalendarStore();
const rota = useRotaStore();

const names = computed(() => {
  const mine = home?.me?.value?.firstName;
  const theirs = home?.partner?.value?.firstName;
  return { me: mine ? displayName(mine) : "Me", partner: theirs ? displayName(theirs) : "Your partner" };
});
const ownerName = (owner) => (owner === "both" ? "Both" : names.value[owner]);
const typeLabel = (type) => EVENT_TYPES.find((t) => t.value === type)?.label ?? "";

const todayIso = toIso(new Date());
const now = parseIso(todayIso);

const VIEWS = [
  { value: "month", label: "Month" },
  { value: "agenda", label: "Agenda" },
];
const view = ref("month");
const cursor = reactive({ year: now.getFullYear(), month: now.getMonth() });

const WEEK_START = 1;
const weekdays = weekdayLabels(WEEK_START);
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekdayNames = weekdays.map((_, i) => WEEKDAY_NAMES[(WEEK_START + i) % 7]);

const label = computed(() => monthLabel(cursor.year, cursor.month));
const grid = computed(() => monthGrid(cursor.year, cursor.month, WEEK_START));

const dayEvents = computed(() => {
  const map = {};
  for (const week of grid.value) {
    for (const day of week) map[day.iso] = sortDayEvents(eventsOnDay(store.events, day.iso));
  }
  return map;
});

// Night duty comes from the sleep rota store (local too).
const nights = computed(() => {
  const map = {};
  for (const week of grid.value) {
    for (const day of week) map[day.iso] = nightOwner(rota, day.iso);
  }
  return map;
});
function nightMarker(iso) {
  const night = nights.value[iso];
  if (!night || night.who === "open") return null;
  const first = names.value[night.who];
  const text = night.shared ? `Night duty: ${first} then ${names.value[night.second]}` : `Night duty: ${first}`;
  return { initial: first.charAt(0).toUpperCase(), text };
}

function dayLabel(day) {
  const count = dayEvents.value[day.iso].length;
  const base = dayHeading(day.iso);
  return count ? `${base}, ${count} ${count === 1 ? "event" : "events"}` : base;
}

function step(delta) {
  const next = shiftMonth(cursor.year, cursor.month, delta);
  cursor.year = next.year;
  cursor.month = next.month;
}
function goToday() {
  cursor.year = now.getFullYear();
  cursor.month = now.getMonth();
}

// Agenda
const agenda = computed(() => agendaGroups(store.events, todayIso));
const isRelative = (iso) => iso === todayIso || iso === addDays(todayIso, 1);
const agendaEmpty = computed(() => (store.events.length ? "No upcoming events." : "No events yet. Add the first one."));

// Day panel
const panelOpen = ref(false);
const panelDate = ref(todayIso);
const panelAdding = ref(false);
const selectedDay = ref(null);
const panelEvents = computed(() => sortDayEvents(eventsOnDay(store.events, panelDate.value)));
const panelNight = computed(() => nightOwner(rota, panelDate.value));

function openDay(iso, trigger = null, adding = false) {
  trigger?.focus?.();
  panelDate.value = iso;
  selectedDay.value = iso;
  panelAdding.value = adding;
  panelOpen.value = true;
}
function onCellClick(iso, event) {
  if (event.target.closest("button")) return;
  openDay(iso, event.currentTarget.querySelector(".cal__daybtn"));
}
function defaultAddDate() {
  const inView = (iso) => {
    const d = parseIso(iso);
    return d.getFullYear() === cursor.year && d.getMonth() === cursor.month;
  };
  if (selectedDay.value && inView(selectedDay.value)) return selectedDay.value;
  if (inView(todayIso)) return todayIso;
  return toIso(new Date(cursor.year, cursor.month, 1));
}
function openAdd(event) {
  openDay(view.value === "agenda" ? todayIso : defaultAddDate(), event.currentTarget, true);
}
function closePanel() {
  panelOpen.value = false;
}
function onSave(payload) {
  const { id, ...data } = payload;
  const saved = id ? store.updateEvent(id, data) : store.addEvent(data);
  if (!saved) return;
  panelDate.value = saved.date;
  selectedDay.value = saved.date;
  const d = parseIso(saved.date);
  cursor.year = d.getFullYear();
  cursor.month = d.getMonth();
}
function onDelete(id) {
  store.removeEvent(id);
}
</script>

<template>
  <div class="cal">
    <header class="cal__head">
      <h1 class="nt-title cal__title">Calendar</h1>
      <p class="cal__sub">Appointments, family plans and who is on duty.</p>
    </header>

    <section class="cal__bar" aria-label="Calendar controls">
      <div class="cal__nav">
        <template v-if="view === 'month'">
          <button type="button" class="cal__icon" aria-label="Previous month" @click="step(-1)">
            <V3Icon name="chevron-left" :size="18" />
          </button>
          <button type="button" class="cal__icon" aria-label="Next month" @click="step(1)">
            <V3Icon name="chevron" :size="18" />
          </button>
          <h2 id="cal-month" class="cal__month" aria-live="polite">{{ label }}</h2>
          <button type="button" class="btn btn-outline btn-sm" @click="goToday">Today</button>
        </template>
        <h2 v-else id="cal-month" class="cal__month">Upcoming</h2>
      </div>
      <div class="cal__tools">
        <V3ChipGroup v-model="view" :options="VIEWS" label="Calendar view" />
        <button type="button" class="btn btn-sm" :class="panelOpen ? 'btn-outline' : 'btn-primary'" @click="openAdd">
          <V3Icon name="plus" :size="16" />
          <span>Add event</span>
        </button>
      </div>
    </section>

    <ul class="cal__legend" aria-label="Legend">
      <li><span class="cal__swatch" data-owner="me" aria-hidden="true"></span>{{ names.me }}</li>
      <li><span class="cal__swatch" data-owner="partner" aria-hidden="true"></span>{{ names.partner }}</li>
      <li><span class="cal__swatch" data-owner="both" aria-hidden="true"></span>Both</li>
      <li><V3Icon name="moon" :size="14" />Night duty</li>
    </ul>

    <!-- Month -->
    <div v-if="view === 'month'" class="cal__wrap">
      <table class="cal__table" aria-labelledby="cal-month">
        <thead>
          <tr>
            <th v-for="(w, i) in weekdays" :key="w" scope="col" :abbr="weekdayNames[i]">{{ w }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="week in grid" :key="week[0].iso">
            <td
              v-for="day in week"
              :key="day.iso"
              class="cal__cell"
              :class="{
                'cal__cell--out': !day.inMonth,
                'cal__cell--selected': panelOpen && selectedDay === day.iso,
              }"
              :data-date="day.iso"
              @click="onCellClick(day.iso, $event)"
            >
              <div class="cal__top">
                <button
                  type="button"
                  class="cal__daybtn"
                  :aria-label="dayLabel(day)"
                  :aria-current="day.iso === todayIso ? 'date' : undefined"
                  @click="openDay(day.iso, $event.currentTarget)"
                >
                  <span class="cal__num" :class="{ 'cal__num--today': day.iso === todayIso }">{{ day.day }}</span>
                </button>
                <span
                  v-if="nightMarker(day.iso)"
                  class="cal__night"
                  role="img"
                  :aria-label="nightMarker(day.iso).text"
                >
                  <V3Icon name="moon" :size="12" />
                  <span aria-hidden="true">{{ nightMarker(day.iso).initial }}</span>
                </span>
              </div>

              <ul v-if="dayEvents[day.iso].length" class="cal__chips" aria-label="Events">
                <li
                  v-for="event in dayEvents[day.iso].slice(0, 2)"
                  :key="event.id"
                  class="cal__chip"
                  :data-owner="event.owner"
                  :data-event="event.id"
                >
                  <span class="visually-hidden">{{ ownerName(event.owner) }}: </span>{{ event.title }}
                </li>
              </ul>
              <button
                v-if="dayEvents[day.iso].length > 2"
                type="button"
                class="cal__more"
                :aria-label="`${dayEvents[day.iso].length - 2} more events on ${dayHeading(day.iso)}`"
                @click="openDay(day.iso, $event.currentTarget)"
              >
                +{{ dayEvents[day.iso].length - 2 }} more
              </button>
              <span v-if="dayEvents[day.iso].length" class="cal__dots" aria-hidden="true">
                <span
                  v-for="event in dayEvents[day.iso].slice(0, 4)"
                  :key="event.id"
                  class="cal__dot"
                  :data-owner="event.owner"
                ></span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Agenda -->
    <div v-else class="cal__agenda">
      <p v-if="!agenda.length" class="cal__empty">{{ agendaEmpty }}</p>
      <section v-for="group in agenda" :key="group.date" class="cal__group" :aria-labelledby="`cal-ag-${group.date}`">
        <h3 :id="`cal-ag-${group.date}`" class="cal__group-title">
          {{ agendaHeading(group.date, todayIso) }}
          <span v-if="isRelative(group.date)" class="cal__group-date">{{ dayHeading(group.date) }}</span>
        </h3>
        <ul class="cal__alist">
          <li v-for="event in group.events" :key="event.id">
            <button type="button" class="cal__arow" :data-event="event.id" @click="openDay(group.date, $event.currentTarget)">
              <span class="cal__atime">{{ eventTimeLabel(event) }}</span>
              <span class="cal__atext">
                <span class="cal__atitle">{{ event.title }}</span>
                <span class="cal__ameta">
                  <span class="cal__owner" :data-owner="event.owner">{{ ownerName(event.owner) }}</span>
                  <span>{{ typeLabel(event.type) }}</span>
                  <span v-if="event.endDate !== event.date">{{ dateRangeLabel(event.date, event.endDate) }}</span>
                </span>
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>

    <CalendarDayPanel
      :open="panelOpen"
      :date="panelDate"
      :events="panelEvents"
      :night="panelNight"
      :names="names"
      :adding="panelAdding"
      @close="closePanel"
      @save="onSave"
      @delete="onDelete"
    />
  </div>
</template>

<style scoped>
.cal { display: flex; flex-direction: column; gap: 20px; max-width: 1120px; margin: 0 auto; font-size: 1rem; }
.cal__head { display: flex; flex-direction: column; gap: 8px; }
.cal__title { font-size: 2.5rem; line-height: 1.2; }
.cal__sub { margin: 0; color: var(--nt-muted); }

.cal__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; }
.cal__nav { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.cal__month { margin: 0 8px; min-width: 9ch; font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 400; line-height: 1.3; letter-spacing: -0.01em; color: var(--nt-ink); }
.cal__tools { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; }
.cal__tools .btn { display: inline-flex; align-items: center; gap: 8px; }
.cal__icon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; background: #fff; border: 1px solid var(--nt-line); border-radius: 8px; color: var(--nt-ink); cursor: pointer; transition: background-color 0.15s; }
.cal__icon:hover { background: var(--nt-gray); }
.cal__icon:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.cal__legend { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 0; padding: 0; list-style: none; font-size: 0.875rem; color: var(--nt-muted); }
.cal__legend li { display: inline-flex; align-items: center; gap: 8px; }
.cal__swatch { width: 14px; height: 14px; border-radius: 4px; background: var(--nt-gray); border: 1px solid var(--nt-line); }
.cal__swatch[data-owner="me"] { background: var(--nt-apricot); border-color: var(--nt-apricot); }
.cal__swatch[data-owner="partner"] { background: var(--nt-powder); border-color: var(--nt-powder); }
.cal__swatch[data-owner="both"] { border-left: 2px solid var(--nt-plum); }

.cal__wrap { border: 1px solid var(--nt-line); border-radius: 12px; overflow: hidden; background: #fff; }
.cal__table { width: 100%; table-layout: fixed; border-collapse: collapse; }
.cal__table th { padding: 10px 8px; border-bottom: 1px solid var(--nt-line); font-size: 0.875rem; font-weight: 500; text-align: left; color: var(--nt-muted); }
.cal__cell { height: 104px; min-height: 104px; padding: 6px; vertical-align: top; border-right: 1px solid var(--nt-line); border-bottom: 1px solid var(--nt-line); cursor: pointer; }
.cal__cell:last-child { border-right: 0; }
.cal__table tbody tr:last-child .cal__cell { border-bottom: 0; }
.cal__cell:hover { background: var(--nt-bg); }
.cal__cell--out { background: var(--nt-bg); }
.cal__cell--out .cal__num, .cal__cell--out .cal__chip { opacity: 0.6; }
.cal__cell--selected { outline: 2px solid var(--nt-plum); outline-offset: -2px; }

.cal__top { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.cal__daybtn { display: inline-flex; align-items: center; padding: 0; background: none; border: 0; border-radius: 999px; font-family: inherit; cursor: pointer; }
.cal__daybtn:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.cal__num { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; border-radius: 999px; font-size: 0.875rem; font-weight: 500; color: var(--nt-ink); }
.cal__cell--out .cal__num { color: var(--nt-muted); }
.cal__num--today { background: var(--nt-plum); color: #fff; }
.cal__night { display: inline-flex; align-items: center; gap: 2px; font-size: 0.875rem; color: var(--nt-muted); }

.cal__chips { display: flex; flex-direction: column; gap: 3px; margin: 4px 0 0; padding: 0; list-style: none; }
.cal__chip { overflow: hidden; padding: 0 6px; border-radius: 6px; font-size: 0.875rem; line-height: 22px; white-space: nowrap; text-overflow: ellipsis; color: var(--nt-ink); background: var(--nt-gray); }
.cal__chip[data-owner="me"] { background: var(--nt-apricot); }
.cal__chip[data-owner="partner"] { background: var(--nt-powder); }
.cal__chip[data-owner="both"] { background: var(--nt-gray); border-left: 1px solid var(--nt-plum); }
.cal__more { margin-top: 2px; padding: 0 2px; background: none; border: 0; font-family: inherit; font-size: 0.875rem; font-weight: 500; line-height: 20px; color: var(--nt-plum); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.cal__more:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
.cal__dots { display: none; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
.cal__dot { width: 8px; height: 8px; border-radius: 999px; background: var(--nt-muted); }
.cal__dot[data-owner="me"] { background: var(--nt-apricot-d); }
.cal__dot[data-owner="partner"] { background: var(--nt-powder-d); }
.cal__dot[data-owner="both"] { background: var(--nt-plum); }

.cal__agenda { display: flex; flex-direction: column; gap: 24px; max-width: 720px; }
.cal__empty { margin: 0; font-size: 1rem; color: var(--nt-muted); }
.cal__group-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin: 0 0 8px; font-family: inherit; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }
.cal__group-date { font-size: 0.875rem; font-weight: 400; color: var(--nt-muted); }
.cal__alist { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.cal__arow { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 12px; width: 100%; padding: 12px 4px; background: none; border: 0; border-bottom: 1px solid var(--nt-line); font-family: inherit; text-align: left; color: var(--nt-ink); cursor: pointer; transition: background-color 0.15s; }
.cal__arow:hover { background: var(--nt-gray); }
.cal__arow:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: -2px; }
.cal__atime { font-size: 0.875rem; color: var(--nt-muted); }
.cal__atext { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.cal__atitle { font-size: 1rem; font-weight: 600; overflow-wrap: anywhere; }
.cal__ameta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 0.875rem; color: var(--nt-muted); }
.cal__owner { padding: 1px 8px; border-radius: 6px; color: var(--nt-ink); background: var(--nt-gray); border: 1px solid var(--nt-line); }
.cal__owner[data-owner="me"] { background: var(--nt-apricot); border-color: var(--nt-apricot); }
.cal__owner[data-owner="partner"] { background: var(--nt-powder); border-color: var(--nt-powder); }
.cal__owner[data-owner="both"] { border-left: 1px solid var(--nt-plum); }

@media (max-width: 767px) {
  .cal__title { font-size: 2rem; }
  .cal__cell { height: 64px; min-height: 64px; padding: 4px 2px; }
  .cal__table th { padding: 8px 2px; text-align: center; }
  .cal__top { justify-content: center; flex-direction: column; gap: 0; }
  .cal__chips, .cal__more { display: none; }
  .cal__dots { display: flex; justify-content: center; }
  .cal__arow { grid-template-columns: minmax(0, 1fr); gap: 4px; }
}
</style>
