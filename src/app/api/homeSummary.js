// Pure helpers for the Home side cards: who is on duty tonight, today's totals and what is next.
// No Vue, Pinia or Firebase imports, so everything here is easy to test.
import { addDays, formatHandover, mondayOf, toIso, weekNights } from "./rotaHelpers";
import { formatTime, lastOfType, toDate, todayStats } from "./entryHelpers";
import { firstNameOf } from "./stream";
import { ownerKey } from "./sharedHelpers";

const PATTERNS = ["alternate", "split", "manual"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

// The raw rota documents turned into the { pattern, firstOnDuty, startDate, overrides, swaps }
// shape weekNights reads, with "me" and "partner" instead of uids. Mirrors the rota store's
// own `view`, so a caller that already has that view can pass it as `view` instead.
export function buildRotaView({ rotaSettings, nights, swaps, uid, now = new Date() } = {}) {
  const data = rotaSettings ?? {};
  const overrides = {};
  for (const [date, night] of Object.entries(nights ?? {})) {
    const who = ownerKey(night?.onCall, uid);
    if (who) overrides[date] = who;
  }
  return {
    pattern: PATTERNS.includes(data.pattern) ? data.pattern : "alternate",
    firstOnDuty: ownerKey(data.firstOnDuty, uid) === "partner" ? "partner" : "me",
    startDate: ISO.test(data.startDate ?? "") ? data.startDate : mondayOf(now),
    handoverTime: TIME.test(data.handoverTime ?? "") ? data.handoverTime : "07:00",
    overrides,
    swaps: (swaps ?? []).map((s) => ({ ...s, from: ownerKey(s.from, uid) ?? "me" })),
  };
}

function minutesOfDay(time) {
  const [h, m] = String(time || "07:00").split(":").map(Number);
  return (Number.isFinite(h) ? h : 7) * 60 + (Number.isFinite(m) ? m : 0);
}

// The night that matters right now. Before the handover time it is the one that started
// yesterday. Returns an ISO date.
export function tonightDate(now, handoverTime) {
  const before = now.getHours() * 60 + now.getMinutes() < minutesOfDay(handoverTime);
  const today = toIso(now);
  return before ? addDays(today, -1) : today;
}

// Who is on night duty tonight.
//
// state is one of "noRota", "noPartner", "you", "partner", "split", "open".
// Returns { state, personUid, isYou, name, fullName, handoverTime, title, line, link, tone }:
//   personUid  the person on duty (for a split night, the one who takes the first half)
//   name       the partner's first name, or "" when there is no usable name
//   title      the card title; line is the one supporting line
//   link       the text link label (it always goes to the Sleep rotation page)
//   tone       "you", "partner" or "neutral", which picks the icon tint
export function dutyTonight({ rotaSettings = null, nights = {}, swaps = [], now = new Date(), uid = "", members = [], view = null } = {}) {
  const partner = (members ?? []).find((m) => m?.uid && m.uid !== uid) ?? null;
  const fullName = String(partner?.displayName || partner?.firstName || "").trim();
  const name = firstNameOf(fullName);
  const partnerLabel = name || "Your partner";
  const rota = view ?? buildRotaView({ rotaSettings, nights, swaps, uid, now });
  const handover = formatHandover(rota.handoverTime);
  const base = { personUid: "", isYou: false, name, fullName, handoverTime: handover, link: "Sleep rotation", tone: "neutral" };

  if (!rotaSettings && !view) {
    return { ...base, state: "noRota", title: "No night rota yet", line: "Agree who covers each night.", link: "Set up your night rota" };
  }
  if (!partner) {
    return { ...base, state: "noPartner", title: "Nights are easier shared", line: "Invite your partner to share nights." };
  }

  const night = weekNights(rota, tonightDate(now, rota.handoverTime))[0];
  const partnerUid = partner.uid;

  if (night.who !== "me" && night.who !== "partner") {
    return { ...base, state: "open", title: "Tonight is open", line: `Nobody has taken it. Handover at ${handover}.` };
  }
  const firstUid = night.who === "me" ? uid : partnerUid;
  if (night.shared) {
    const sentence =
      night.who === "me"
        ? `You take the first half, ${name || "your partner"} the second.`
        : `${partnerLabel} takes the first half, you the second.`;
    return {
      ...base,
      state: "split",
      personUid: firstUid,
      isYou: night.who === "me",
      title: "Tonight is shared",
      line: `${sentence} Handover at ${handover}.`,
      tone: night.who === "me" ? "you" : "partner",
    };
  }
  if (night.who === "me") {
    return { ...base, state: "you", personUid: uid, isYou: true, title: "You're on duty tonight", line: `Handover at ${handover}.`, tone: "you" };
  }
  return {
    ...base,
    state: "partner",
    personUid: partnerUid,
    isYou: false,
    title: `${partnerLabel} is on duty tonight`,
    line: `Handover at ${handover}.`,
    tone: "partner",
  };
}

// Totals since local midnight, plus the time of the newest feed ever logged (a Date or null).
export function todaySummary({ entries = [], now = new Date() } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const stats = todayStats(list, now);
  const last = lastOfType(list, "feed");
  return { feeds: stats.feeds, sleepMinutes: stats.sleepMinutes, nappies: stats.nappies, lastFeedAt: last ? toDate(last.at) : null };
}

// "just now", "12 min ago", "2 h ago", "yesterday", "3 d ago".
export function agoText(value, now = new Date()) {
  const at = toDate(value);
  if (!at) return "";
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} d ago`;
}

function isoToDate(iso, time = "00:00") {
  if (!ISO.test(iso ?? "")) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const [h, min] = TIME.test(time ?? "") ? time.split(":").map(Number) : [0, 0];
  return new Date(y, m - 1, d, h, min);
}

function whenLabel(at, now, withTime) {
  const dayDiff = Math.round(
    (Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000,
  );
  let day;
  if (dayDiff < 0) return `Overdue, ${at.getDate()} ${MONTHS[at.getMonth()]}`;
  else if (dayDiff === 0) day = "Today";
  else if (dayDiff === 1) day = "Tomorrow";
  else day = `${WEEKDAYS[at.getDay()]} ${at.getDate()} ${MONTHS[at.getMonth()]}`;
  return withTime ? `${day}, ${formatTime(at)}` : day;
}

// The soonest of the next calendar event, the next open task with a due date and the next
// handover. Returns { kind: "event" | "task" | "handover", title, at, when } or null.
// A timed event that has already started is skipped; an all day event counts all day.
// Open tasks that are overdue come first, since they are the most urgent thing.
export function nextUp({ events = [], tasks = [], handoverTime = null, now = new Date() } = {}) {
  const today = toIso(now);
  const found = [];
  for (const event of events ?? []) {
    if (!event?.title) continue;
    const timed = !event.allDay && TIME.test(event.start ?? "");
    const at = isoToDate(event.date, timed ? event.start : "00:00");
    if (!at) continue;
    if (timed ? at.getTime() < now.getTime() : (event.endDate || event.date) < today) continue;
    found.push({ kind: "event", title: event.title, at, when: whenLabel(at, now, timed), rank: 0 });
  }
  for (const task of tasks ?? []) {
    if (!task?.title || task.done) continue;
    const at = isoToDate(task.due);
    if (!at) continue;
    found.push({ kind: "task", title: task.title, at, when: whenLabel(at, now, false), rank: 1 });
  }
  if (handoverTime && TIME.test(handoverTime)) {
    const [h, m] = handoverTime.split(":").map(Number);
    let at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    if (at.getTime() <= now.getTime()) at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m);
    found.push({ kind: "handover", title: "Handover", at, when: whenLabel(at, now, true), rank: 2 });
  }
  if (!found.length) return null;
  found.sort((a, b) => a.at - b.at || a.rank - b.rank);
  const { rank, ...best } = found[0];
  void rank;
  return best;
}
