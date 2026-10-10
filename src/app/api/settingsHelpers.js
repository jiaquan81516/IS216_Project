// Pure helpers for the user settings document (users/{uid}.settings).
// The shape follows docs/data-model.md, section 2. No Vue, Pinia or Firebase imports.

export const DEFAULT_SETTINGS = Object.freeze({
  notifications: {
    push: false,
    feedsDue: true,
    partnerLogs: true,
    handovers: true,
    swapRequests: true,
    checkInReminder: { on: false, time: "21:30" },
    quietHours: { on: false, start: "23:00", end: "05:00" },
  },
  calendar: {
    connected: false,
    calendarId: null,
    syncOn: { rota: false, appointments: true, myReminders: false },
    lastSyncedAt: null,
  },
  display: { timeFormat: "12h", weekStartsOn: "mon", reduceMotion: false },
  privacy: { shareLastSeen: true },
});

export const TIME_FORMATS = Object.freeze(["12h", "24h"]);
export const WEEK_STARTS = Object.freeze(["mon", "sun"]);

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTimeString(value) {
  return typeof value === "string" && TIME_RE.test(value);
}

function bool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
function time(value, fallback) {
  return isTimeString(value) ? value : fallback;
}
function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

// Fills in every missing field and drops anything unexpected, so the UI never reads
// undefined and a half written document still works.
export function normaliseSettings(raw) {
  const d = DEFAULT_SETTINGS;
  const s = raw && typeof raw === "object" ? raw : {};
  const n = s.notifications ?? {};
  const c = s.calendar ?? {};
  const disp = s.display ?? {};
  const p = s.privacy ?? {};
  return {
    notifications: {
      push: bool(n.push, d.notifications.push),
      feedsDue: bool(n.feedsDue, d.notifications.feedsDue),
      partnerLogs: bool(n.partnerLogs, d.notifications.partnerLogs),
      handovers: bool(n.handovers, d.notifications.handovers),
      swapRequests: bool(n.swapRequests, d.notifications.swapRequests),
      checkInReminder: {
        on: bool(n.checkInReminder?.on, d.notifications.checkInReminder.on),
        time: time(n.checkInReminder?.time, d.notifications.checkInReminder.time),
      },
      quietHours: {
        on: bool(n.quietHours?.on, d.notifications.quietHours.on),
        start: time(n.quietHours?.start, d.notifications.quietHours.start),
        end: time(n.quietHours?.end, d.notifications.quietHours.end),
      },
    },
    calendar: {
      connected: bool(c.connected, d.calendar.connected),
      calendarId: typeof c.calendarId === "string" ? c.calendarId : null,
      syncOn: {
        rota: bool(c.syncOn?.rota, d.calendar.syncOn.rota),
        appointments: bool(c.syncOn?.appointments, d.calendar.syncOn.appointments),
        myReminders: bool(c.syncOn?.myReminders, d.calendar.syncOn.myReminders),
      },
      lastSyncedAt: c.lastSyncedAt ?? null,
    },
    display: {
      timeFormat: oneOf(disp.timeFormat, TIME_FORMATS, d.display.timeFormat),
      weekStartsOn: oneOf(disp.weekStartsOn, WEEK_STARTS, d.display.weekStartsOn),
      reduceMotion: bool(disp.reduceMotion, d.display.reduceMotion),
    },
    privacy: { shareLastSeen: bool(p.shareLastSeen, d.privacy.shareLastSeen) },
  };
}

// "notifications.quietHours.start" and a value become the dotted path updateDoc wants, so
// two sections saved at the same time never overwrite each other.
export function settingsPatch(path, value) {
  return { [`settings.${path}`]: value };
}

// 1 for Monday, 0 for Sunday: the number monthGrid and weekdayLabels take.
export function weekStartIndex(weekStartsOn) {
  return weekStartsOn === "sun" ? 0 : 1;
}

// Calls `fn` at most once per `ms`, after the last call. Returns the wrapped function with
// `flush` and `cancel`, so a page can save immediately when it unmounts.
export function debounce(fn, ms = 600) {
  let timer = null;
  let pending = null;
  const run = () => {
    timer = null;
    const args = pending;
    pending = null;
    if (args) fn(...args);
  };
  const wrapped = (...args) => {
    pending = args;
    clearTimeout(timer);
    timer = setTimeout(run, ms);
  };
  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer);
      run();
    }
  };
  wrapped.cancel = () => {
    clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return wrapped;
}
