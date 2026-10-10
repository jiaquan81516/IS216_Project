// Turning a NurtureTrack event into a Google Calendar event and back, plus the conflict rule
// the two way sync uses. Pure: no Firebase, no googleapis, no process.env, so every case
// below is unit tested in calendarMap.spec.js.
//
// A NurtureTrack event (households/{hid}/events/{eventId}, see docs/data-model.md) is
//   { title, date, endDate, allDay, start, end, owner, type, notes, googleEventId }
// with ISO "YYYY-MM-DD" dates and "HH:MM" times.
//
// Time zone. The app is built for Singapore, which is +08:00 all year and has been since
// 1982, so a fixed offset is correct here and keeps these functions pure and deterministic.
// Google gets an explicit timeZone of "Asia/Singapore" on every timed event, and a Google
// event that comes back with any offset is read as the matching Singapore wall clock.

export const TIME_ZONE = "Asia/Singapore";
export const OFFSET_MINUTES = 8 * 60;
export const NOTES_MAX = 280;
export const TITLE_MAX = 80;
export const EVENT_TYPES = Object.freeze(["appointment", "family", "work"]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isIsoDate = (value) => DATE_RE.test(String(value ?? ""));
export const isTime = (value) => TIME_RE.test(String(value ?? ""));

function pad(n) {
  return String(n).padStart(2, "0");
}

// "2026-10-14" plus days, done in UTC so no local time zone can shift it.
export function addDays(iso, days) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const at = Date.UTC(y, m - 1, d) + days * 86400000;
  const out = new Date(at);
  return `${out.getUTCFullYear()}-${pad(out.getUTCMonth() + 1)}-${pad(out.getUTCDate())}`;
}

// "2026-10-14" and "09:30" become "2026-10-14T09:30:00+08:00".
export function toSingaporeIso(date, time) {
  return `${date}T${time}:00+08:00`;
}

// Any instant Google gives us, read as the Singapore wall clock.
// Returns { date: "YYYY-MM-DD", time: "HH:MM" } or null when it cannot be parsed.
export function fromSingaporeIso(dateTime) {
  const at = Date.parse(String(dateTime ?? ""));
  if (!Number.isFinite(at)) return null;
  const local = new Date(at + OFFSET_MINUTES * 60000);
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  };
}

// Adds minutes to an "HH:MM", carrying into the next day.
// Returns { time, dayShift }.
export function shiftTime(time, minutes) {
  const [h, m] = String(time).split(":").map(Number);
  const total = h * 60 + m + minutes;
  const dayShift = Math.floor(total / 1440);
  const inDay = ((total % 1440) + 1440) % 1440;
  return { time: `${pad(Math.floor(inDay / 60))}:${pad(inDay % 60)}`, dayShift };
}

export const DEFAULT_MINUTES = 60;

// A NurtureTrack event becomes the body Google's events.insert and events.patch take.
// `eventId` is the Firestore document id, kept in a private extended property so a pull can
// recognise an event we pushed instead of writing it back in as a second copy.
export function toGoogleEvent(event, eventId = "") {
  const date = event.date;
  if (!isIsoDate(date)) throw new Error("An event needs an ISO start date.");
  const endDate = isIsoDate(event.endDate) && event.endDate >= date ? event.endDate : date;
  const title = String(event.title ?? "").trim().slice(0, TITLE_MAX) || "Untitled event";
  const notes = typeof event.notes === "string" ? event.notes.slice(0, NOTES_MAX) : "";

  const body = {
    summary: title,
    description: notes,
    extendedProperties: {
      private: {
        ntEventId: String(eventId || event.id || ""),
        ntType: EVENT_TYPES.includes(event.type) ? event.type : "family",
        ntOwner: String(event.owner ?? "both"),
      },
    },
  };

  if (event.allDay || !isTime(event.start)) {
    // Google's all day end date is exclusive, so the day after the last day.
    body.start = { date };
    body.end = { date: addDays(endDate, 1) };
    return body;
  }

  const start = event.start;
  let endTime = isTime(event.end) ? event.end : null;
  let endDay = endDate;
  if (!endTime) {
    const shifted = shiftTime(start, DEFAULT_MINUTES);
    endTime = shifted.time;
    endDay = addDays(endDate, shifted.dayShift);
  } else if (endDay === date && endTime <= start) {
    // An end that is not after the start on the same day would be refused by Google.
    const shifted = shiftTime(start, DEFAULT_MINUTES);
    endTime = shifted.time;
    endDay = addDays(date, shifted.dayShift);
  }
  body.start = { dateTime: toSingaporeIso(date, start), timeZone: TIME_ZONE };
  body.end = { dateTime: toSingaporeIso(endDay, endTime), timeZone: TIME_ZONE };
  return body;
}

// A Google event becomes the NurtureTrack fields. Returns null when it cannot be read, for
// example an event with neither a date nor a dateTime.
export function fromGoogleEvent(googleEvent) {
  const g = googleEvent || {};
  const startDate = g.start?.date;
  const startTime = g.start?.dateTime;
  const title = String(g.summary ?? "").trim().slice(0, TITLE_MAX) || "Untitled event";
  const notes = typeof g.description === "string" ? g.description.slice(0, NOTES_MAX) : "";
  const type = EVENT_TYPES.includes(g.extendedProperties?.private?.ntType)
    ? g.extendedProperties.private.ntType
    : "appointment";
  const owner = g.extendedProperties?.private?.ntOwner || "both";
  const common = { title, notes, type, owner, googleEventId: g.id ?? null };

  if (startDate) {
    const endExclusive = g.end?.date;
    const last = endExclusive ? addDays(endExclusive, -1) : startDate;
    return {
      ...common,
      date: startDate,
      endDate: last < startDate ? startDate : last,
      allDay: true,
      start: null,
      end: null,
    };
  }

  if (startTime) {
    const from = fromSingaporeIso(startTime);
    if (!from) return null;
    const to = g.end?.dateTime ? fromSingaporeIso(g.end.dateTime) : null;
    return {
      ...common,
      date: from.date,
      endDate: to && to.date >= from.date ? to.date : from.date,
      allDay: false,
      start: from.time,
      end: to ? to.time : null,
    };
  }

  return null;
}

// Any of a Date, a millisecond number, an ISO string or a Firestore Timestamp becomes
// milliseconds. Returns null when there is nothing usable.
export function toMillis(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value.toMillis === "function") {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value.seconds === "number") return value.seconds * 1000 + (value.nanoseconds ?? 0) / 1e6;
  if (typeof value === "string") {
    const at = Date.parse(value);
    return Number.isFinite(at) ? at : null;
  }
  return null;
}

// The conflict rule for the two way sync: whichever side was updated later wins.
//
// Returns "local" when NurtureTrack should be pushed to Google, "remote" when Google should
// be pulled into NurtureTrack. A tie goes to "local", so a run is deterministic and a
// second run with the same data does nothing new. A side with no timestamp loses to a side
// that has one; with no timestamp on either side, "local" wins for the same reason.
export function resolveConflict(localUpdatedAt, remoteUpdatedAt) {
  const local = toMillis(localUpdatedAt);
  const remote = toMillis(remoteUpdatedAt);
  if (remote === null) return "local";
  if (local === null) return "remote";
  return remote > local ? "remote" : "local";
}

// True when the two sides already say the same thing, so the push can skip the event. Only
// the fields that cross the boundary are compared.
export function sameEvent(a, b) {
  if (!a || !b) return false;
  const keys = ["title", "date", "endDate", "allDay", "start", "end", "notes"];
  return keys.every((key) => (a[key] ?? null) === (b[key] ?? null));
}
