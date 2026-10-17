// The pure parts of sending a push: what the message says, whether it should wait for quiet
// hours, and which FCM errors mean a device is gone. Nothing here touches Firebase, so it can
// be tested on its own. The function that uses it is api/push/notify.js.

export const FRESH_MS = 2 * 60 * 1000; // a push is only sent for something written in the last two minutes
export const TIME_ZONE = "Asia/Singapore"; // the same zone the calendar sync uses
export const DEAD_TOKEN_CODES = Object.freeze([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export function isDeadToken(code) {
  return DEAD_TOKEN_CODES.includes(code);
}

export function firstName(name, fallback = "Your partner") {
  const first = String(name ?? "").trim().split(/\s+/)[0];
  return first || fallback;
}

// Minutes since midnight in Singapore.
export function minutesOfDay(now = new Date(), timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

// "YYYY-MM-DD" for today in Singapore.
export function todayIso(now = new Date(), timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

// quietHours is { on, start: "23:00", end: "05:00" } from the person's settings. A window that
// crosses midnight (start later than end) is handled.
export function isQuietNow(quietHours, now = new Date()) {
  if (!quietHours?.on) return false;
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  if (start === null || end === null || start === end) return false;
  const minute = minutesOfDay(now);
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

// "today", "tomorrow" or a short date, from a due date string.
export function dueLabel(due, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(due ?? ""))) return "";
  const today = todayIso(now);
  const days = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  const date = new Date(`${due}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(date);
}

// The overnight window matches the app: 8 PM to 6 AM in Singapore.
export const NIGHT_START_HOUR = 20;
export const NIGHT_END_HOUR = 6;
export const HEAVY_NIGHT_LOGS = 3;

export function isNightMinute(minute) {
  return minute >= NIGHT_START_HOUR * 60 || minute < NIGHT_END_HOUR * 60;
}

// How many of one person's entries fall in the night, within the last 24 hours.
// `entries` are plain { by, at } with `at` as milliseconds.
export function countNightLogs(entries, uid, now = new Date()) {
  const until = now.getTime();
  const since = until - 24 * 60 * 60 * 1000;
  let count = 0;
  for (const entry of entries ?? []) {
    if (!uid || entry?.by !== uid) continue;
    const at = Number(entry.at);
    if (!Number.isFinite(at) || at <= since || at > until) continue;
    if (isNightMinute(minutesOfDay(new Date(at)))) count += 1;
  }
  return count;
}

// One key per night, so a rough night sends one push and not one per log.
export function nightKey(now = new Date()) {
  return todayIso(new Date(now.getTime() - NIGHT_END_HOUR * 60 * 60 * 1000));
}

const clip = (text, max) => {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}...` : clean;
};

// The notification. Chat text is never put in it, so nothing private shows on a lock screen.
// A task shows its title, because the title is the point of the push. Every value is a string,
// which is what FCM data messages require.
export function buildPush({ type, senderName, kind = "text", title = "", due = null, count = 0, now = new Date() }) {
  const name = firstName(senderName);
  if (type === "feeling") {
    return {
      type: "feeling",
      title: `${name} is having a hard day`,
      body: "They chose to share this with you. A kind word helps.",
      url: "/home?chat=1",
      tag: "feeling",
    };
  }
  if (type === "heavy") {
    return {
      type: "heavy",
      title: `${name} has had a long night`,
      body: `${count} logs overnight. A thank you can mean a lot.`,
      url: "/home?chat=1",
      tag: "heavy",
    };
  }
  if (type === "task") {
    const when = dueLabel(due, now);
    return {
      type: "task",
      title: `${name} gave you a task`,
      body: when ? `${clip(title, 80)}, due ${when}` : clip(title, 80),
      url: "/checklist",
      tag: "task",
    };
  }
  return {
    type: "chat",
    title: kind === "thanks" ? `${name} said thank you` : `${name} sent you a message`,
    body: "Open the chat to read it.",
    url: "/home?chat=1",
    tag: "chat",
  };
}

// Firestore Timestamp, Date, number or null to milliseconds. 0 when unknown.
export function millisOf(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function isFresh(value, now = Date.now(), windowMs = FRESH_MS) {
  const at = millisOf(value);
  return at > 0 && at <= now + 5000 && now - at <= windowMs;
}
