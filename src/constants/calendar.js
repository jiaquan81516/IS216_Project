// Sample calendar data (placeholder) and the month model used by the Calendar page.

export const CALENDAR_TYPES = [
  { value: "appointments", label: "Appointments" },
  { value: "family", label: "Family" },
  { value: "work", label: "Work and leave" },
];

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Events: calendar is appointments | family | work. "private" events are only
// for the signed-in parent (butter dashed chip) and are always shown.
export const sampleEvents = [
  { id: "e1", date: "2026-10-02", time: "11:00", title: "Health visitor", calendar: "appointments", both: true },
  { id: "e2", date: "2026-10-03", time: "14:00", title: "Grandparents", calendar: "family" },
  { id: "e3", date: "2026-10-05", time: "", title: "Paternity leave, Daniel", calendar: "work" },
  { id: "e4", date: "2026-10-06", time: "21:30", title: "Check-in", calendar: "private", private: true },
  { id: "e5", date: "2026-10-08", time: "10:30", title: "3-week check", calendar: "appointments", both: true },
  { id: "e6", date: "2026-10-10", time: "15:00", title: "Lunch with Ben", calendar: "family" },
  { id: "e7", date: "2026-10-12", time: "", title: "Paternity leave continues", calendar: "work" },
  { id: "e8", date: "2026-10-14", time: "10:00", title: "Nursery call", calendar: "work" },
  { id: "e9", date: "2026-10-15", time: "", title: "1 month old", calendar: "family" },
  { id: "e10", date: "2026-10-17", time: "10:00", title: "Photo day", calendar: "family" },
  { id: "e11", date: "2026-10-19", time: "", title: "Paternity leave continues", calendar: "work" },
  { id: "e12", date: "2026-10-20", time: "15:30", title: "Manager talk", calendar: "work" },
  { id: "e13", date: "2026-10-22", time: "16:00", title: "Nursery tour", calendar: "work" },
  { id: "e14", date: "2026-10-27", time: "10:30", title: "6-week check", calendar: "appointments", both: true },
  { id: "e15", date: "2026-10-30", time: "09:00", title: "Nursery trial", calendar: "work" },
  { id: "e16", date: "2026-11-01", time: "", title: "Leave ends", calendar: "work" },
];

const pad = (n) => String(n).padStart(2, "0");

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function monthTitle(year, month) {
  return `${MONTH_NAMES[month]} ${year}`;
}

export function longDayName(iso) {
  const d = fromISO(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export function shortDate(iso) {
  const d = fromISO(iso);
  return `${DAY_NAMES[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}

// "21:30" -> "9:30 PM"
export function formatTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${pad(m)} ${suffix}`;
}

// Night rota placeholder: Daniel takes Mon, Wed, Fri, Sun; Mei takes Tue, Thu, Sat.
export function onCallFor(iso) {
  const dow = fromISO(iso).getDay(); // 0 = Sunday
  return dow === 0 || dow % 2 === 1 ? "D" : "M";
}

function dayCell(iso, month) {
  const d = fromISO(iso);
  return {
    iso,
    day: d.getDate(),
    month: d.getMonth(),
    inMonth: month === undefined ? true : d.getMonth() === month,
    who: onCallFor(iso),
  };
}

function mondayOf(iso) {
  const d = fromISO(iso);
  const back = (d.getDay() + 6) % 7;
  return addDays(iso, -back);
}

export function buildWeek(iso, month) {
  const start = mondayOf(iso);
  return Array.from({ length: 7 }, (_, i) => dayCell(addDays(start, i), month));
}

// Weeks (Mon first) covering the month, each an array of 7 day cells.
export function buildMonth(year, month) {
  const first = toISO(new Date(year, month, 1));
  const last = new Date(year, month + 1, 0);
  const weeks = [];
  let cursor = mondayOf(first);
  while (fromISO(cursor) <= last) {
    weeks.push(buildWeek(cursor, month));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

// Google Calendar "template" link for an event.
export function googleCalendarUrl(ev) {
  const compact = (iso) => iso.replaceAll("-", "");
  let dates;
  if (ev.time) {
    const [h, m] = ev.time.split(":").map(Number);
    const endH = Math.min(h + 1, 23);
    dates = `${compact(ev.date)}T${pad(h)}${pad(m)}00/${compact(ev.date)}T${pad(endH)}${pad(m)}00`;
  } else {
    dates = `${compact(ev.date)}/${compact(addDays(ev.date, 1))}`;
  }
  const params = new URLSearchParams({ action: "TEMPLATE", text: ev.title, dates });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
