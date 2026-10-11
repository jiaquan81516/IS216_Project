// Pure helpers for the App calendar. No Vue, Pinia or storage imports.
// An event is { id, title, date, endDate, allDay, start, end, owner, type, notes } with ISO dates.
import { addDays, isIsoDate, parseIso, toIso, weekNights } from "@/app/api/rotaHelpers";

const WEEKDAYS_SUN_FIRST = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const EVENT_TYPES = Object.freeze([
  { value: "appointment", label: "Appointment" },
  { value: "family", label: "Family" },
  { value: "work", label: "Work" },
]);
export const EVENT_OWNERS = Object.freeze(["me", "partner", "both"]);
export const NOTES_MAX = 280;

// Short weekday names starting from weekStartsOn (0 is Sunday, 1 is Monday).
export function weekdayLabels(weekStartsOn = 1) {
  return Array.from({ length: 7 }, (_, i) => WEEKDAYS_SUN_FIRST[(weekStartsOn + i) % 7]);
}

// 6 weeks of 7 days for the month. month is 0 to 11. Each day is { iso, day, inMonth }.
export function monthGrid(year, month, weekStartsOn = 1) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const d = new Date(year, month, 1 - offset + week * 7 + dayIndex);
      return { iso: toIso(d), day: d.getDate(), inMonth: d.getMonth() === month && d.getFullYear() === year };
    }),
  );
}

export function shiftMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

// "October 2026"
export function monthLabel(year, month) {
  return `${MONTHS[month]} ${year}`;
}

// "Wednesday 14 October"
export function dayHeading(iso) {
  const d = parseIso(iso);
  return `${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// "Today", "Tomorrow" or "Thu 15 October".
export function agendaHeading(iso, todayIso) {
  if (iso === todayIso) return "Today";
  if (iso === addDays(todayIso, 1)) return "Tomorrow";
  const d = parseIso(iso);
  return `${WEEKDAY_NAMES[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// "14 to 16 October" or "30 October to 2 November".
export function dateRangeLabel(a, b) {
  const x = parseIso(a);
  const y = parseIso(b);
  if (a === b) return `${x.getDate()} ${MONTHS[x.getMonth()]}`;
  if (x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear()) {
    return `${x.getDate()} to ${y.getDate()} ${MONTHS[y.getMonth()]}`;
  }
  return `${x.getDate()} ${MONTHS[x.getMonth()]} to ${y.getDate()} ${MONTHS[y.getMonth()]}`;
}

// "14:30" becomes "2:30 PM".
export function formatClock(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(time ?? ""));
  if (!match) return "";
  const h = Number(match[1]);
  if (h > 23) return "";
  return `${h % 12 === 0 ? 12 : h % 12}:${match[2]} ${h >= 12 ? "PM" : "AM"}`;
}

export const lastDay = (event) => event.endDate || event.date;

// Events that cover the day, including multi-day events.
export function eventsOnDay(events, iso) {
  return events.filter((e) => e.date <= iso && lastDay(e) >= iso);
}

// All day first, then by start time, then by title. Returns a new array.
export function sortDayEvents(list) {
  return [...list].sort((a, b) => {
    const aKey = a.allDay || !a.start ? "" : a.start;
    const bKey = b.allDay || !b.start ? "" : b.start;
    if (aKey !== bKey) return aKey < bKey ? -1 : 1;
    return String(a.title).localeCompare(String(b.title));
  });
}

// Upcoming events grouped by day, from fromIso. An event that started earlier and is still
// running is listed under fromIso. Returns [{ date, events }] in date order.
export function agendaGroups(events, fromIso) {
  const byDate = new Map();
  for (const event of events) {
    if (lastDay(event) < fromIso) continue;
    const key = event.date < fromIso ? fromIso : event.date;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(event);
  }
  return [...byDate.keys()].sort().map((date) => ({ date, events: sortDayEvents(byDate.get(date)) }));
}

// "All day", "9:00 AM" or "9:00 AM to 10:00 AM".
export function eventTimeLabel(event) {
  if (event.allDay || !event.start) return "All day";
  const start = formatClock(event.start);
  const end = formatClock(event.end);
  return end ? `${start} to ${end}` : start;
}

// Returns a message, or an empty string when the draft is fine.
export function validateEvent(draft) {
  if (!String(draft.title ?? "").trim()) return "Add a title for the event.";
  if (!isIsoDate(draft.date)) return "Choose a start date.";
  const endDate = draft.endDate || draft.date;
  if (!isIsoDate(endDate) || endDate < draft.date) return "End date must be on or after the start date.";
  if (!draft.allDay) {
    if (!draft.start) return "Add a start time.";
    if (draft.end && endDate === draft.date && draft.end <= draft.start) return "End time must be after start time.";
  }
  return "";
}

// Who is on night duty for the night that starts on iso. who is "me", "partner" or "open".
// For a shared night, who takes the first half and second the other half.
export function nightOwner(rotaStore, iso) {
  const night = weekNights(rotaStore, iso)[0];
  return { who: night.who, shared: night.shared, second: night.second };
}

// "October, 2026"
export function monthTitle(year, month) {
  return `${MONTHS[month]}, ${year}`;
}

// The first day of the week that holds iso.
export function weekStartOf(iso, weekStartsOn = 1) {
  const offset = (parseIso(iso).getDay() - weekStartsOn + 7) % 7;
  return addDays(iso, -offset);
}

// Seven ISO days starting at startIso.
export function weekDays(startIso) {
  return Array.from({ length: 7 }, (_, i) => addDays(startIso, i));
}

// "October, 2026", "September to October, 2026" or "December, 2026 to January, 2027".
export function weekTitle(days) {
  const a = parseIso(days[0]);
  const b = parseIso(days[days.length - 1]);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return monthTitle(a.getFullYear(), a.getMonth());
  if (a.getFullYear() === b.getFullYear()) return `${MONTHS[a.getMonth()]} to ${monthTitle(b.getFullYear(), b.getMonth())}`;
  return `${monthTitle(a.getFullYear(), a.getMonth())} to ${monthTitle(b.getFullYear(), b.getMonth())}`;
}

// "14:30" becomes 870. Anything else becomes 0.
export function toMinutes(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(time ?? ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

// All day and multi-day events are drawn as bars. Timed single-day events are drawn as rows.
export function isBarEvent(event) {
  return Boolean(event.allDay) || !event.start || lastDay(event) > event.date;
}

// Lays one week of events out in lanes, TimeTree style. weekIsos is 7 ISO days. Each item is
// { event, bar, start, end, span, lane, contLeft, contRight } with 0 based columns. Items in
// a lane at or beyond maxLanes are left out and counted per day in hidden (7 numbers).
export function layoutWeekEvents(events, weekIsos, maxLanes = 3) {
  const first = weekIsos[0];
  const last = weekIsos[weekIsos.length - 1];
  const items = [];
  for (const event of events) {
    if (event.date > last || lastDay(event) < first) continue;
    const start = event.date < first ? 0 : weekIsos.indexOf(event.date);
    const end = lastDay(event) > last ? weekIsos.length - 1 : weekIsos.indexOf(lastDay(event));
    if (start < 0 || end < start) continue;
    items.push({
      event,
      bar: isBarEvent(event),
      start,
      end,
      span: end - start + 1,
      contLeft: event.date < first,
      contRight: lastDay(event) > last,
    });
  }
  items.sort((a, b) => {
    if (a.bar !== b.bar) return a.bar ? -1 : 1;
    if (a.start !== b.start) return a.start - b.start;
    if (a.span !== b.span) return b.span - a.span;
    const ak = a.event.start || "";
    const bk = b.event.start || "";
    if (ak !== bk) return ak < bk ? -1 : 1;
    return String(a.event.title).localeCompare(String(b.event.title));
  });
  const lanes = [];
  for (const item of items) {
    let lane = 0;
    while (lanes[lane] && lanes[lane].slice(item.start, item.end + 1).some(Boolean)) lane += 1;
    if (!lanes[lane]) lanes[lane] = Array(weekIsos.length).fill(false);
    for (let c = item.start; c <= item.end; c += 1) lanes[lane][c] = true;
    item.lane = lane;
  }
  const hidden = Array(weekIsos.length).fill(0);
  for (const item of items) {
    if (item.lane < maxLanes) continue;
    for (let c = item.start; c <= item.end; c += 1) hidden[c] += 1;
  }
  return { items: items.filter((i) => i.lane < maxLanes), hidden, laneCount: Math.min(lanes.length, maxLanes) };
}

// Blocks for the weekly hour grid: timed single-day events on iso, with side by side columns
// for overlaps. Each block is { event, startMin, endMin, col, cols }.
export function dayBlocks(events, iso) {
  const blocks = events
    .filter((e) => !isBarEvent(e) && e.date === iso)
    .map((event) => {
      const startMin = toMinutes(event.start);
      let endMin = event.end ? toMinutes(event.end) : startMin + 60;
      endMin = Math.min(1440, Math.max(endMin, startMin + 30));
      return { event, startMin, endMin, col: 0, cols: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  let cluster = [];
  let columns = [];
  let clusterEnd = 0;
  const close = () => {
    for (const b of cluster) b.cols = columns.length || 1;
    cluster = [];
    columns = [];
    clusterEnd = 0;
  };
  for (const block of blocks) {
    if (cluster.length && block.startMin >= clusterEnd) close();
    let col = columns.findIndex((end) => end <= block.startMin);
    if (col < 0) col = columns.length;
    columns[col] = block.endMin;
    block.col = col;
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, block.endMin);
  }
  close();
  return blocks;
}
