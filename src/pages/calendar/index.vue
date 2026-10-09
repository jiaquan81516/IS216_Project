<script setup>
import { computed, ref } from "vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppCard from "@/components/ui/AppCard.vue";
import AvatarDot from "@/components/ui/AvatarDot.vue";
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue";
import YoursAlone from "@/components/ui/YoursAlone.vue";
import CalendarDay from "./components/CalendarDay.vue";
import {
  CALENDAR_TYPES,
  WEEKDAYS,
  addDays,
  buildMonth,
  buildWeek,
  formatTime,
  fromISO,
  googleCalendarUrl,
  longDayName,
  monthTitle,
  onCallFor,
  sampleEvents,
  shortDate,
  toISO,
} from "@/data/calendar";
import { SAMPLE } from "@/shared/constants/appConstants";

defineOptions({ name: "calendarPage" });

const todayISO = toISO(new Date());
const events = ref(sampleEvents.map((e) => ({ ...e })));
const mode = ref("month"); // month | week
const selected = ref(todayISO);
const view = ref({ year: fromISO(todayISO).getFullYear(), month: fromISO(todayISO).getMonth() });
const shown = ref(CALENDAR_TYPES.map((t) => t.value)); // calendar types ticked in the legend

// Sync and reminders.
const syncedAt = ref("9:10 PM");
const remindAppointments = ref(true);
const remindPartner = ref(true);
function syncNow() {
  const now = new Date();
  syncedAt.value = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Grid.
const title = computed(() => monthTitle(view.value.year, view.value.month));
const weeks = computed(() =>
  mode.value === "month" ? buildMonth(view.value.year, view.value.month) : [buildWeek(selected.value, view.value.month)],
);

const eventsByDate = computed(() => {
  const map = {};
  for (const e of events.value) {
    if (!e.private && !shown.value.includes(e.calendar)) continue;
    (map[e.date] ||= []).push(e);
  }
  for (const list of Object.values(map)) list.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  return map;
});
const eventsOn = (iso) => eventsByDate.value[iso] || [];

function select(iso) {
  selected.value = iso;
}

function showMonth(year, month) {
  const d = new Date(year, month, 1);
  view.value = { year: d.getFullYear(), month: d.getMonth() };
  const inMonth = (iso) => fromISO(iso).getFullYear() === d.getFullYear() && fromISO(iso).getMonth() === d.getMonth();
  selected.value = inMonth(todayISO) ? todayISO : toISO(d);
}

function step(dir) {
  if (mode.value === "week") {
    selected.value = addDays(selected.value, 7 * dir);
    const d = fromISO(selected.value);
    view.value = { year: d.getFullYear(), month: d.getMonth() };
  } else {
    showMonth(view.value.year, view.value.month + dir);
  }
}

function goToday() {
  const d = fromISO(todayISO);
  view.value = { year: d.getFullYear(), month: d.getMonth() };
  selected.value = todayISO;
}

function setMode(next) {
  mode.value = next;
  if (next === "week") {
    const d = fromISO(selected.value);
    view.value = { year: d.getFullYear(), month: d.getMonth() };
  }
}

// Day detail.
const dayTitle = computed(() => longDayName(selected.value));
const onCall = computed(() => {
  return onCallFor(selected.value) === "D" ? SAMPLE.me : SAMPLE.partner;
});
const dayEvents = computed(() => eventsOn(selected.value).filter((e) => !e.private));
const privateEvents = computed(() => eventsOn(selected.value).filter((e) => e.private));
const nextUp = computed(() => {
  const upcoming = events.value
    .filter((e) => !e.private && e.date > selected.value)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  return upcoming[0] || null;
});
const nextWhen = computed(() => {
  if (!nextUp.value) return "";
  const t = formatTime(nextUp.value.time);
  return `${shortDate(nextUp.value.date)}${t ? `, ${t}` : ""}.${nextUp.value.both ? " You are both listed." : ""}`;
});

// Legend.
const counts = computed(() => {
  const c = {};
  for (const e of events.value) c[e.calendar] = (c[e.calendar] || 0) + 1;
  return c;
});
const reminderCount = computed(() => events.value.filter((e) => e.private).length);

// Add event modal.
const modalEl = ref(null);
const form = ref({ title: "", date: todayISO, time: "", calendar: "appointments" });
function resetForm() {
  form.value = { title: "", date: selected.value, time: "", calendar: "appointments" };
}
function saveEvent() {
  const f = form.value;
  if (!f.title.trim() || !f.date) return;
  events.value.push({
    id: `u${Date.now()}`,
    date: f.date,
    time: f.time,
    title: f.title.trim(),
    calendar: f.calendar,
    both: f.calendar === "appointments",
  });
  if (!shown.value.includes(f.calendar)) shown.value.push(f.calendar);
  const d = fromISO(f.date);
  view.value = { year: d.getFullYear(), month: d.getMonth() };
  selected.value = f.date;
  // main.js loads the Bootstrap bundle, which exposes window.bootstrap.
  if (modalEl.value && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(modalEl.value).hide();
}
</script>

<template>
  <div class="nt-stack">
    <PageHeader :title="title">
      <AppButton variant="outline" size="md" :aria-label="mode === 'month' ? 'Previous month' : 'Previous week'" @click="step(-1)">Previous</AppButton>
      <AppButton variant="outline" size="md" :aria-label="mode === 'month' ? 'Next month' : 'Next week'" @click="step(1)">Next</AppButton>
      <AppButton variant="outline" size="md" @click="goToday">Today</AppButton>
      <div class="pill-tabs" role="group" aria-label="Calendar view">
        <button
          type="button"
          class="pill-tabs__tab"
          :class="{ 'pill-tabs__tab--on': mode === 'month' }"
          :aria-pressed="mode === 'month'"
          @click="setMode('month')"
        >Monthly</button>
        <button
          type="button"
          class="pill-tabs__tab"
          :class="{ 'pill-tabs__tab--on': mode === 'week' }"
          :aria-pressed="mode === 'week'"
          @click="setMode('week')"
        >Weekly</button>
      </div>
      <AppButton size="md" data-bs-toggle="modal" data-bs-target="#addEventModal" @click="resetForm">Add event</AppButton>
    </PageHeader>

    <div class="cal-month">
      <div class="cal-weekdays" aria-hidden="true">
        <span v-for="w in WEEKDAYS" :key="w">{{ w }}</span>
      </div>
      <div class="cal-grid" role="group" :aria-label="title">
        <template v-for="(week, wi) in weeks" :key="wi">
          <CalendarDay
            v-for="(d, di) in week"
            :key="d.iso"
            :day="d"
            :events="eventsOn(d.iso)"
            :selected="d.iso === selected"
            :today="d.iso === todayISO"
            :show-month="!d.inMonth && (d.day === 1 || (wi === 0 && di === 0))"
            :tall="mode === 'week'"
            @select="select"
          />
        </template>
      </div>
    </div>
    <p class="nt-muted mb-0">The coloured band on top of each day shows the night rota. Apricot is Daniel, blue is Mei.</p>

    <div class="cal-cards">
      <AppCard :title="dayTitle">
        <p class="cal-sub">{{ selected === todayISO ? "Today" : "Selected day" }}</p>
        <div class="cal-row">
          <span class="nt-muted">{{ onCall }} is on call</span>
          <span class="cal-row__strong">6 PM to 6 AM</span>
        </div>
        <ul v-if="dayEvents.length" class="cal-list">
          <li v-for="e in dayEvents" :key="e.id">
            <span class="cal-row__strong">{{ e.title }}</span>
            <span v-if="e.time" class="nt-muted">{{ formatTime(e.time) }}</span>
          </li>
        </ul>
        <p v-else-if="!privateEvents.length" class="nt-muted mb-0">No events this day.</p>
        <YoursAlone v-for="p in privateEvents" :key="p.id">
          <p class="mb-0 cal-row__strong">{{ p.title }} at {{ formatTime(p.time) }}</p>
        </YoursAlone>
        <hr class="nt-rule" />
        <template v-if="nextUp">
          <p class="cal-sub">Next up</p>
          <p class="cal-next">{{ nextUp.title }}</p>
          <p class="nt-muted nt-small mb-0">{{ nextWhen }}</p>
          <a class="nt-link align-self-start" :href="googleCalendarUrl(nextUp)" target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
        </template>
        <p v-else class="nt-muted mb-0">Nothing coming up.</p>
      </AppCard>

      <AppCard title="Sync and reminders">
        <div><AppBadge color="green">Google Calendar connected</AppBadge></div>
        <p class="nt-muted nt-small mb-0" role="status">Synced {{ syncedAt }}</p>
        <div><AppButton variant="outline" size="md" @click="syncNow">Sync now</AppButton></div>
        <hr class="nt-rule" />
        <div class="cal-toggle">
          <div>
            <p class="cal-row__strong mb-0">Appointment reminders</p>
            <p class="nt-muted nt-small mb-0">1 hour before.</p>
          </div>
          <ToggleSwitch v-model="remindAppointments" label="Appointment reminders" />
        </div>
        <div class="cal-toggle">
          <p class="cal-row__strong mb-0">When {{ SAMPLE.partner }} adds an event</p>
          <ToggleSwitch v-model="remindPartner" :label="`When ${SAMPLE.partner} adds an event`" />
        </div>
        <p class="nt-muted nt-small mb-0">Push reminder: sent to you and {{ SAMPLE.partner }} 1 hour before. Tomorrow at 9:30 AM.</p>
      </AppCard>

      <div class="nt-col">
        <AppCard title="Calendars">
          <fieldset class="cal-legend">
            <legend class="visually-hidden">Show calendars</legend>
            <div v-for="t in CALENDAR_TYPES" :key="t.value" class="cal-legend__row">
              <label class="cal-legend__label">
                <input v-model="shown" type="checkbox" class="cal-swatch" :class="`cal-swatch--${t.value}`" :value="t.value" />
                {{ t.label }}
              </label>
              <span class="nt-muted nt-small">{{ counts[t.value] || 0 }}</span>
            </div>
          </fieldset>
          <div class="cal-oncall">
            <AvatarDot who="D" :size="18" />
            <AvatarDot who="M" :size="18" />
            <span class="cal-row__strong">Who is on call</span>
          </div>
        </AppCard>
        <YoursAlone>
          <p class="mb-0 cal-row__strong">My reminders: {{ reminderCount }}</p>
          <p class="mb-0 nt-small">Only you see these.</p>
        </YoursAlone>
      </div>
    </div>

    <div id="addEventModal" ref="modalEl" class="modal fade" tabindex="-1" aria-labelledby="addEventTitle" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content cal-modal" @submit.prevent="saveEvent">
          <div class="modal-header border-0 pb-0">
            <h2 id="addEventTitle" class="nt-heading">Add event</h2>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
          </div>
          <div class="modal-body d-flex flex-column gap-3">
            <div>
              <label for="ev-title" class="form-label">Title</label>
              <input id="ev-title" v-model="form.title" type="text" class="form-control" required autocomplete="off" />
            </div>
            <div class="row g-3">
              <div class="col-sm-7">
                <label for="ev-date" class="form-label">Date</label>
                <input id="ev-date" v-model="form.date" type="date" class="form-control" required />
              </div>
              <div class="col-sm-5">
                <label for="ev-time" class="form-label">Time</label>
                <input id="ev-time" v-model="form.time" type="time" class="form-control" />
              </div>
            </div>
            <div>
              <label for="ev-cal" class="form-label">Calendar</label>
              <select id="ev-cal" v-model="form.calendar" class="form-select">
                <option v-for="t in CALENDAR_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
          </div>
          <div class="modal-footer border-0 pt-0">
            <AppButton variant="outline" size="md" data-bs-dismiss="modal">Cancel</AppButton>
            <button type="submit" class="btn btn-primary" :disabled="!form.title.trim() || !form.date">Save event</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pill-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: var(--nt-gray);
  border-radius: 8px;
}
.pill-tabs__tab {
  padding: 8px 14px;
  font-size: 0.875rem;
  color: var(--nt-muted);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.pill-tabs__tab--on {
  background: var(--nt-white);
  color: var(--nt-ink);
  font-weight: 500;
}
.cal-month {
  overflow: hidden;
  background: var(--nt-white);
  border: 1px solid var(--nt-line);
  border-radius: 12px;
}
.cal-weekdays,
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
.cal-weekdays span {
  padding: 10px 12px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--nt-muted);
  background: var(--nt-gray);
}
.cal-grid {
  margin: 0 -1px -1px 0;
}
.cal-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  align-items: start;
}
.cal-sub {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--nt-muted);
}
.cal-next {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}
.cal-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.9375rem;
}
.cal-row__strong {
  font-size: 0.9375rem;
  font-weight: 500;
}
.cal-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.cal-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.9375rem;
}
.cal-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cal-legend {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.cal-legend__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cal-legend__label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
}
.cal-swatch {
  appearance: none;
  flex: none;
  width: 14px;
  height: 14px;
  margin: 0;
  background: var(--nt-white);
  border: 1px solid var(--nt-muted);
  border-radius: 3px;
  cursor: pointer;
}
.cal-swatch:checked {
  border-color: var(--nt-line);
}
.cal-swatch--appointments:checked {
  background: var(--nt-blue);
}
.cal-swatch--family:checked {
  background: var(--nt-teal);
}
.cal-swatch--work:checked {
  background: var(--nt-gray);
  border-color: var(--nt-muted);
}
.cal-oncall {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cal-oncall :deep(.avatar-dot + .avatar-dot) {
  margin-left: -4px;
}
.cal-modal {
  border: 1px solid var(--nt-line);
  border-radius: 12px;
}
@media (max-width: 991px) {
  .cal-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .cal-weekdays span {
    padding: 8px 4px;
    text-align: center;
  }
}
</style>
