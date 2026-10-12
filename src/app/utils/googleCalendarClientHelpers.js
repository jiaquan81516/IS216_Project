// Pure helpers for the browser only Google Calendar mode. No Vue, no fetch, no window, so
// every function here is unit tested without a network. The calls themselves live in
// googleCalendarClient.js and googleCalendarSync.js.
import { weekNights } from "@/app/utils/rotaHelpers";

export const TIME_ZONE = "Asia/Singapore";
const OFFSET_MINUTES = 8 * 60;
export const KEY_PROP = "nurturetrackKey";
// Every event we write also carries this, because Google can only filter private properties
// by an exact key=value pair and the keys themselves are all different.
export const APP_PROP = "nurturetrackApp";
export const APP_VALUE = "1";
export const NIGHT_TITLE = "Night duty (NurtureTrack)";
// The plan only stores a morning handover time. The evening start is fixed.
export const NIGHT_START = "19:00";
export const NIGHT_COUNT = 14;
export const TITLE_MAX = 80;
export const NOTES_MAX = 280;
const DEFAULT_MINUTES = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const pad = (n) => String(n).padStart(2, "0");

// True when a real looking OAuth client id is set. Placeholders do not count.
export function isClientModeAvailable(id = import.meta.env?.VITE_GOOGLE_OAUTH_CLIENT_ID) {
  const value = typeof id === "string" ? id.trim() : "";
  if (!value) return false;
  if (/^paste/i.test(value) || /your-/i.test(value)) return false;
  return true;
}

export const rotaKey = (householdId, date, uid) => `rota:${householdId}:${date}:${uid}`;
export const eventKey = (householdId, eventId) => `event:${householdId}:${eventId}`;

export function parseRotaKey(key) {
  const match = /^rota:(.+):(\d{4}-\d{2}-\d{2}):([^:]+)$/.exec(String(key ?? ""));
  return match ? { householdId: match[1], date: match[2], uid: match[3] } : null;
}

// UTC based, so no local time zone can shift a calendar date.
export function addDaysIso(iso, days) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const out = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  return `${out.getUTCFullYear()}-${pad(out.getUTCMonth() + 1)}-${pad(out.getUTCDate())}`;
}

// Today's date on the Singapore wall clock.
export function singaporeToday(now = new Date()) {
  const local = new Date(now.getTime() + OFFSET_MINUTES * 60000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

const sgDateTime = (date, time) => ({ dateTime: `${date}T${time}:00+08:00`, timeZone: TIME_ZONE });

export function fromSingaporeIso(dateTime) {
  const at = Date.parse(String(dateTime ?? ""));
  if (!Number.isFinite(at)) return null;
  const local = new Date(at + OFFSET_MINUTES * 60000);
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  };
}

function bodyOf({ summary, description = "", start, end, key }) {
  return {
    summary,
    description,
    start,
    end,
    extendedProperties: { private: { [KEY_PROP]: key, [APP_PROP]: APP_VALUE } },
  };
}

// One night duty event. The night that starts on `date` runs to the handover next morning.
export function nightBody(date, handoverTime, key) {
  const morning = TIME_RE.test(String(handoverTime ?? "")) ? handoverTime : "07:00";
  return bodyOf({
    summary: NIGHT_TITLE,
    description: "Added by NurtureTrack from the shared sleep rota.",
    start: sgDateTime(date, NIGHT_START),
    end: sgDateTime(addDaysIso(date, 1), morning),
    key,
  });
}

// The next `count` nights where I am on duty, as [{ key, date, body }]. `rotaView` is the
// "me" and "partner" shaped plan from the rota store. A split night counts for both parents.
export function desiredNights({ householdId, uid, rotaView, handoverTime, today, count = NIGHT_COUNT }) {
  if (!householdId || !uid || !rotaView || !DATE_RE.test(String(today))) return [];
  const out = [];
  for (let offset = 0; offset < count; offset += 7) {
    for (const night of weekNights(rotaView, addDaysIso(today, offset))) {
      if (night.date >= addDaysIso(today, count)) continue;
      if (night.who !== "me" && night.second !== "me") continue;
      const key = rotaKey(householdId, night.date, uid);
      out.push({ key, date: night.date, body: nightBody(night.date, handoverTime, key) });
    }
  }
  return out;
}

// One in-app event as a Google event body. Returns null when it has no usable date.
export function appointmentBody(event, householdId) {
  if (!event || !DATE_RE.test(String(event.date ?? ""))) return null;
  const key = eventKey(householdId, event.id);
  const date = event.date;
  const lastDate = DATE_RE.test(String(event.endDate ?? "")) && event.endDate >= date ? event.endDate : date;
  const summary = String(event.title ?? "").trim().slice(0, TITLE_MAX) || "Untitled event";
  const description = typeof event.notes === "string" ? event.notes.slice(0, NOTES_MAX) : "";
  if (event.allDay || !TIME_RE.test(String(event.start ?? ""))) {
    // Google's all day end date is exclusive.
    return bodyOf({ summary, description, start: { date }, end: { date: addDaysIso(lastDate, 1) }, key });
  }
  let endDate = lastDate;
  let endTime = TIME_RE.test(String(event.end ?? "")) ? event.end : null;
  if (!endTime || (endDate === date && endTime <= event.start)) {
    const [h, m] = event.start.split(":").map(Number);
    const total = h * 60 + m + DEFAULT_MINUTES;
    endDate = addDaysIso(date, Math.floor(total / 1440));
    endTime = `${pad(Math.floor((total % 1440) / 60))}:${pad(total % 60)}`;
  }
  return bodyOf({ summary, description, start: sgDateTime(date, event.start), end: sgDateTime(endDate, endTime), key });
}

// In-app events that overlap [from, to] (ISO dates), as [{ key, body }].
export function desiredAppointments({ householdId, events, from, to }) {
  const out = [];
  for (const event of events ?? []) {
    if (!event?.id) continue;
    const last = event.endDate && event.endDate >= event.date ? event.endDate : event.date;
    if (last < from || event.date > to) continue;
    const body = appointmentBody(event, householdId);
    if (body) out.push({ key: body.extendedProperties.private[KEY_PROP], body });
  }
  return out;
}

const moment = (part) => (part?.dateTime ? new Date(part.dateTime).getTime() : part?.date ?? null);

// True when the Google event already says what the body says.
export function sameBody(existing, body) {
  if (!existing || !body) return false;
  if ((existing.summary ?? "") !== (body.summary ?? "")) return false;
  if ((existing.description ?? "") !== (body.description ?? "")) return false;
  return moment(existing.start) === moment(body.start) && moment(existing.end) === moment(body.end);
}

export function keyOf(googleEvent) {
  return googleEvent?.extendedProperties?.private?.[KEY_PROP] ?? null;
}

// The pure heart of the sync.
//   desired:   [{ key, body }]  what Google should hold
//   existing:  [{ id, key, event }]  what our events on Google hold now
//   isManaged: (key) => boolean  true when a key not in desired may be deleted
// Returns { inserts, patches, deletes, unchanged }. A key that appears twice on Google keeps
// its first copy and the other copies go to deletes, so a past double insert heals itself.
export function planSync({ desired = [], existing = [], isManaged = () => true }) {
  const byKey = new Map();
  const deletes = [];
  for (const item of existing) {
    if (!item?.key) continue;
    if (byKey.has(item.key)) deletes.push({ id: item.id, key: item.key });
    else byKey.set(item.key, item);
  }
  const wanted = new Set();
  const inserts = [];
  const patches = [];
  let unchanged = 0;
  for (const want of desired) {
    if (wanted.has(want.key)) continue;
    wanted.add(want.key);
    const have = byKey.get(want.key);
    if (!have) inserts.push({ key: want.key, body: want.body });
    else if (sameBody(have.event, want.body)) unchanged += 1;
    else patches.push({ id: have.id, key: want.key, body: want.body });
  }
  for (const [key, item] of byKey) {
    if (!wanted.has(key) && isManaged(key)) deletes.push({ id: item.id, key });
  }
  return { inserts, patches, deletes, unchanged };
}

// A Google event for the read only layer, shaped like an app calendar event. Our own events
// (they carry the key) return null, so nothing shows twice. Cancelled events return null.
export function fromGoogleListEvent(g) {
  if (!g || g.status === "cancelled" || keyOf(g)) return null;
  const title = String(g.summary ?? "").trim().slice(0, TITLE_MAX) || "Busy";
  const base = { id: `google:${g.id}`, title, source: "google", owner: "google", type: "google", notes: "" };
  if (g.start?.date) {
    const last = g.end?.date ? addDaysIso(g.end.date, -1) : g.start.date;
    return { ...base, date: g.start.date, endDate: last < g.start.date ? g.start.date : last, allDay: true, start: null, end: null };
  }
  const from = fromSingaporeIso(g.start?.dateTime);
  if (!from) return null;
  const to = g.end?.dateTime ? fromSingaporeIso(g.end.dateTime) : null;
  return {
    ...base,
    date: from.date,
    endDate: to && to.date >= from.date ? to.date : from.date,
    allDay: false,
    start: from.time,
    end: to ? to.time : null,
  };
}

export function mapGoogleEvents(items) {
  return (items ?? []).map(fromGoogleListEvent).filter(Boolean);
}

export class GoogleCalendarError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = "GoogleCalendarError";
    this.code = code;
    this.status = status;
  }
}

export const ERROR_TEXT = Object.freeze({
  reconnect: "Google sign in has expired. Select Connect Google Calendar to reconnect.",
  forbidden:
    "Google refused the request. In Google Cloud project is216-821c0, enable the Google Calendar API and add the calendar.events scope to the consent screen, then select Connect Google Calendar again.",
  rate: "Google asked us to slow down. Wait a minute, then select Sync now.",
  network: "We could not reach Google. Check your connection, then try again.",
  timeout: "Google took too long to load. Check your connection, then select Connect Google Calendar again.",
  script: "Google sign in could not be loaded. Turn off any ad blocker for this page, then try again.",
  denied: "Google Calendar was not connected, because access was not granted. Select Connect Google Calendar and allow calendar events.",
  scope: "Calendar access was not granted. Select Connect Google Calendar and tick the box for calendar events.",
  config: "Google Calendar is not set up. Add VITE_GOOGLE_OAUTH_CLIENT_ID to .env and restart pnpm dev.",
  notconnected: "Google Calendar is not connected. Select Connect Google Calendar first.",
  unknown: "Google Calendar returned an error. Select Sync now to try again.",
});

export function errorOf(code, status = 0) {
  return new GoogleCalendarError(code, ERROR_TEXT[code] ?? ERROR_TEXT.unknown, status);
}

// A short "reason: message" taken from Google's error body, trimmed so it fits in the card.
export function googleSaid(body) {
  const reason = String(body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? "").trim();
  const message = String(body?.error?.message ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
  return [reason, message].filter(Boolean).join(": ");
}

// An HTTP status (and Google's error body, when there is one) becomes a GoogleCalendarError.
export function mapHttpError(status, body) {
  const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? "";
  if (status === 401) return errorOf("reconnect", status);
  if (status === 429 || /rateLimit/i.test(reason)) return errorOf("rate", status);
  if (status === 403) {
    const base = errorOf("forbidden", status);
    const said = googleSaid(body);
    if (said) base.message = `${base.message} Google said: ${said}`;
    return base;
  }
  return errorOf("unknown", status);
}

// "Added 7, updated 2, removed 0"
export function describeCounts({ added = 0, updated = 0, removed = 0 } = {}) {
  return `Added ${added}, updated ${updated}, removed ${removed}`;
}
