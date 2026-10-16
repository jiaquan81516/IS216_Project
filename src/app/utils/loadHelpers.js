// Pure helpers for gentle prompts between partners. No Vue, Pinia or Firebase imports.
//
// Everything here reads data the household already shares (the care log, the rota, tasks,
// the chat, and a feeling a person chose to share). A private check-in is only ever read on the
// device that saved it, to decide whether to prompt that same person.
//
// The thresholds are starting guesses to tune with real parents. They are not clinical values.
import { toDate, formatTime } from "./entryHelpers";
import { addDays, mondayOf, toIso, weekNights } from "./rotaHelpers";
import { localKey } from "./stream";

export const NIGHT_START_HOUR = 20; // from 8 PM
export const NIGHT_END_HOUR = 6; // until 6 AM
export const HEAVY_NIGHT_LOGS = 3; // logs in the night that make it a rough one
export const HEAVY_RUN_NIGHTS = 3; // nights in a row on duty
export const BUSY_DAY_LOGS = 8; // logs in 24 hours
export const HEAVY_SCORE = 2; // score at which the day counts as heavy
export const PARTNER_WINDOW_MS = 3 * 60 * 60 * 1000;
export const HARD_STREAK = 3; // hard check-ins in a row before support is offered
export const MAX_NUDGES = 4;

const HOUR_MS = 60 * 60 * 1000;

export function isNightHour(hour) {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

// Evening and night, when a partner logging something is a sign the baby is settling.
function isEveningHour(hour) {
  return hour >= 18 || hour < NIGHT_END_HOUR;
}

function capitalise(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

// How many nights in a row, ending at `upTo` (an ISO date), this person was on solo duty.
// `view` is the rota view from the point of view of the signed in user; `who` is "me" or
// "partner". A shared (split) night does not count as a night on duty.
export function onDutyRun({ view = null, upTo = "", who = "me", max = 7 } = {}) {
  if (!view || !upTo) return 0;
  const weeks = new Map();
  let run = 0;
  for (let i = 0; i < max; i += 1) {
    const date = addDays(upTo, -i);
    const weekStart = mondayOf(date);
    if (!weeks.has(weekStart)) {
      const nights = {};
      for (const night of weekNights(view, weekStart)) nights[night.date] = night;
      weeks.set(weekStart, nights);
    }
    const night = weeks.get(weekStart)[date];
    if (night && night.who === who && !night.shared) run += 1;
    else break;
  }
  return run;
}

// How heavy the last 24 hours look for one person.
// Returns { uid, logs, nightLogs, run, score, heavy, reasons }.
export function loadSignals({ entries = [], uid = "", now = new Date(), run = 0 } = {}) {
  const until = now.getTime();
  const since = until - 24 * HOUR_MS;
  let logs = 0;
  let nightLogs = 0;
  for (const entry of entries ?? []) {
    if (!uid || entry?.by !== uid) continue;
    const at = toDate(entry.at);
    if (!at || at.getTime() <= since || at.getTime() > until) continue;
    logs += 1;
    if (isNightHour(at.getHours())) nightLogs += 1;
  }
  let score = 0;
  const reasons = [];
  if (nightLogs >= HEAVY_NIGHT_LOGS) score += 2;
  else if (nightLogs === HEAVY_NIGHT_LOGS - 1) score += 1;
  if (nightLogs >= HEAVY_NIGHT_LOGS - 1) reasons.push(`${nightLogs} logs in the night`);
  if (run >= HEAVY_RUN_NIGHTS + 1) score += 2;
  else if (run === HEAVY_RUN_NIGHTS) score += 1;
  if (run >= HEAVY_RUN_NIGHTS) reasons.push(`${run} nights in a row on duty`);
  if (logs >= BUSY_DAY_LOGS) {
    score += 1;
    reasons.push(`a busy day with ${logs} logs`);
  }
  return { uid, logs, nightLogs, run, score, heavy: score >= HEAVY_SCORE, reasons };
}

// "3 logs in the night and 4 nights in a row on duty."
function reasonLine(reasons) {
  if (!reasons.length) return "";
  const text = reasons.length === 1 ? reasons[0] : `${reasons.slice(0, -1).join(", ")} and ${reasons[reasons.length - 1]}`;
  return `${capitalise(text)}.`;
}

const LOGGED_VERB = {
  sleep: "put the baby down",
  feed: "logged a feed",
  nappy: "changed a nappy",
  medication: "logged medicine",
  note: "added a note",
};

// The partner's newest log from the last few hours, when it was in the evening or at night.
// Returns { type, at, verb } or null.
export function partnerRecentLog({ entries = [], partnerUid = "", now = new Date() } = {}) {
  if (!partnerUid) return null;
  const until = now.getTime();
  let best = null;
  for (const entry of entries ?? []) {
    if (entry?.by !== partnerUid) continue;
    const at = toDate(entry.at);
    if (!at) continue;
    const t = at.getTime();
    if (t > until || until - t > PARTNER_WINDOW_MS) continue;
    if (!isEveningHour(at.getHours())) continue;
    if (!best || t > best.at.getTime()) best = { type: entry.type, at };
  }
  return best ? { ...best, verb: LOGGED_VERB[best.type] ?? "logged something" } : null;
}

export function isHardCheckin(entry) {
  return Boolean(entry) && (entry.mood <= 2 || entry.stress >= 5);
}

// The word that is shared with a partner, and only when the person chose to share.
export function feelingLevel(entry) {
  if (!entry) return null;
  if (isHardCheckin(entry)) return "hard";
  return entry.mood >= 4 && entry.stress <= 3 ? "good" : "okay";
}

export const FEELING_LABELS = Object.freeze({
  hard: "having a hard day",
  okay: "doing okay",
  good: "doing well",
});

// True when the last few private check-ins in a row were all hard and the newest is recent.
// `days` is store.lastSeven(): [{ date, entry }], oldest first.
export function needsSupport(days = [], now = new Date()) {
  const entries = (days ?? []).map((d) => d?.entry).filter(Boolean);
  if (entries.length < HARD_STREAK) return false;
  const recent = entries.slice(-HARD_STREAK);
  if (!recent.every(isHardCheckin)) return false;
  const newest = recent[recent.length - 1].date;
  return newest >= localKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2));
}

// A long stretch for your partner always comes first.
const NUDGE_ORDER = ["partner-heavy", "support", "heavy-self", "partner-feeling", "partner-logged"];

function nudgeRank(nudge) {
  const i = NUDGE_ORDER.indexOf(nudge.kind);
  return i === -1 ? NUDGE_ORDER.length : i;
}

// Hidden for the rest of the day once dismissed.
export function isDismissed(nudge, dismissed = {}, dayKey = "") {
  return Boolean(dismissed?.[nudge.id]) && dismissed[nudge.id] === dayKey;
}

// The prompts to show in the chat now, most useful first, at most MAX_NUDGES. Each is a quiet
// line in the thread. The one tap replies come from suggestionsFor() in chatHelpers.
//   me / partner   loadSignals() results (partner may be null)
//   checkedInToday true when this person already saved a private check-in today
//   partnerFeeling { level, date } the partner chose to share, or null
//   settings       the user's settings (notifications.partnerLogs)
export function buildNudges({
  now = new Date(),
  partnerName = "Your partner",
  me = null,
  partner = null,
  recentLog = null,
  checkedInToday = false,
  partnerFeeling = null,
  supportNeeded = false,
  settings = null,
  dismissed = {},
} = {}) {
  const dayKey = localKey(now);
  const list = [];

  if (supportNeeded) {
    list.push({
      id: "support",
      kind: "support",
      title: "It looks like a hard few days",
      text: "You do not have to carry this alone. Support is one tap away.",
      action: { label: "See support", to: "support" },
    });
  }
  if (me?.heavy && !checkedInToday) {
    const why = reasonLine(me.reasons);
    list.push({
      id: "heavy-self",
      kind: "heavy-self",
      title: "Rough stretch?",
      text: `${why} A quick check-in takes about 20 seconds.`.trim(),
      action: { label: "Check in", to: "wellness" },
    });
  }
  if (partnerFeeling?.level === "hard" && partnerFeeling.date === dayKey) {
    list.push({
      id: "partner-feeling",
      kind: "partner-feeling",
      title: `${partnerName} is ${FEELING_LABELS.hard}`,
      text: "They chose to share this with you. A kind word helps.",
    });
  }
  const partnerLogsOn = settings?.notifications?.partnerLogs !== false;
  if (recentLog && partnerLogsOn && !checkedInToday) {
    list.push({
      id: "partner-logged",
      kind: "partner-logged",
      title: `${partnerName} ${recentLog.verb}`,
      text: `That was at ${formatTime(recentLog.at)}. How are you holding up?`,
      action: { label: "Check in", to: "wellness" },
    });
  }
  if (partner?.heavy) {
    list.push({
      id: "partner-heavy",
      kind: "partner-heavy",
      title: `${partnerName} has had a long stretch`,
      text: `${reasonLine(partner.reasons)} A thank you can mean a lot.`.trim(),
    });
  }

  return list
    .filter((nudge) => !isDismissed(nudge, dismissed, dayKey))
    .sort((a, b) => nudgeRank(a) - nudgeRank(b))
    .slice(0, MAX_NUDGES);
}

const PROMPTS = Object.freeze([
  "What did your partner do this week that helped you?",
  "What is one thing that would make next week easier?",
  "When did you feel most supported this week?",
  "Is there a task you would like to hand over or share?",
  "What do you want more of next week: rest, time together, or help?",
  "What are you proud of as a team this week?",
]);

// One conversation prompt per week, the same for both parents.
export function weeklyPrompt(now = new Date()) {
  const monday = mondayOf(now);
  const [y, m, d] = monday.split("-").map(Number);
  const weeks = Math.floor(Date.UTC(y, m - 1, d) / (7 * 86400000));
  return PROMPTS[weeks % PROMPTS.length];
}

// The last seven days at a glance: who covered what. Framed as teamwork, never a score.
// `view` is the rota view as the signed in user sees it ("me" and "partner").
// Returns { me, partner, sharedNights, line, prompt } where each person has
// { nights, logs, nightLogs, tasks, thanks }.
export function weeklyTogether({
  entries = [],
  tasks = [],
  chat = [],
  view = null,
  uid = "",
  partnerUid = "",
  partnerName = "Your partner",
  tonight = "",
  now = new Date(),
} = {}) {
  const until = now.getTime();
  const since = until - 7 * 24 * HOUR_MS;
  const inWindow = (value) => {
    const at = toDate(value);
    return Boolean(at) && at.getTime() > since && at.getTime() <= until;
  };
  const blank = () => ({ nights: 0, logs: 0, nightLogs: 0, tasks: 0, thanks: 0 });
  const people = { me: blank(), partner: blank() };
  const keyOf = (id) => (id === uid ? "me" : id === partnerUid ? "partner" : null);

  for (const entry of entries ?? []) {
    const key = keyOf(entry?.by);
    const at = toDate(entry?.at);
    if (!key || !inWindow(at)) continue;
    people[key].logs += 1;
    if (isNightHour(at.getHours())) people[key].nightLogs += 1;
  }
  for (const task of tasks ?? []) {
    const key = keyOf(task?.doneBy);
    if (key && task.done && inWindow(task.doneAt)) people[key].tasks += 1;
  }
  for (const message of chat ?? []) {
    const key = keyOf(message?.from);
    if (key && message.kind === "thanks" && inWindow(message.createdAt)) people[key].thanks += 1;
  }

  let sharedNights = 0;
  if (view) {
    const last = tonight || toIso(now);
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(last, -i);
      const night = weekNights(view, mondayOf(date)).find((n) => n.date === date);
      if (!night) continue;
      if (night.shared) sharedNights += 1;
      else if (night.who === "me") people.me.nights += 1;
      else if (night.who === "partner") people.partner.nights += 1;
    }
  }

  let line = "";
  const gap = people.me.nights - people.partner.nights;
  if (people.me.nights + people.partner.nights > 0) {
    if (Math.abs(gap) >= 2) {
      const heavier = gap > 0 ? "You" : partnerName;
      line = `${heavier} covered more of the nights this week. Worth a thank you.`;
    } else {
      line = "The nights were shared fairly evenly this week.";
    }
  }

  return { me: people.me, partner: people.partner, sharedNights, line, prompt: weeklyPrompt(now) };
}
