// Pure helpers for the Home side cards: who is on duty tonight, today's totals and what is next.
// No Vue, Pinia or Firebase imports, so everything here is easy to test.
import { addDays, mondayOf, toIso } from "./rotaHelpers";
import { lastOfType, toDate, todayStats } from "./entryHelpers";
import { ownerKey } from "./sharedHelpers";

const PATTERNS = ["alternate", "split", "manual"];
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
    carerNights: Array.isArray(data.carerNights) ? data.carerNights : [],
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

