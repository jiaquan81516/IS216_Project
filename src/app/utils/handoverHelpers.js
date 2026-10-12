// Pure helpers for the App handover. No Vue, Pinia, Firebase or storage imports.
//
// A handover is the boundary between two shifts: one parent sends a short summary of what
// happened, the other reads it and accepts it. Everything here works on plain objects, so
// the window maths and the wording can be tested on their own.
import { formatMinutes, formatTime, dayLabel, startOfDay, toDate } from "./entryHelpers";
import { nightOwner } from "./calendarHelpers";

// Where the current shift starts: the previous handover's sentAt, or the start of today when
// there is none yet.
export function periodStartFrom(latestHandover, now = new Date()) {
  const sent = toDate(latestHandover?.sentAt);
  if (sent) return sent;
  return startOfDay(now);
}

// A snapshot of the care log between periodStart and now. Only entries that start inside the
// window count, the same rule todayStats uses, and a sleep that is still going counts up to
// now.
export function summariseWindow(entries, periodStart, now = new Date()) {
  const from = toDate(periodStart)?.getTime() ?? 0;
  const to = toDate(now)?.getTime() ?? Date.now();
  let feeds = 0;
  let nappies = 0;
  let sleepMinutes = 0;
  for (const entry of entries ?? []) {
    const at = toDate(entry?.at);
    if (!at) continue;
    const time = at.getTime();
    if (time < from || time > to) continue;
    if (entry.type === "feed") feeds += 1;
    else if (entry.type === "nappy") nappies += 1;
    else if (entry.type === "sleep") {
      const end = toDate(entry.endedAt)?.getTime() ?? to;
      sleepMinutes += Math.max(0, (Math.min(end, to) - time) / 60000);
    }
  }
  return { feeds, sleepMinutes: Math.round(sleepMinutes), nappies };
}

// The three stat blocks shown on the page: [{ key, label, value }].
export function summaryBlocks(summary) {
  const s = summary ?? {};
  const feeds = Number(s.feeds) || 0;
  const nappies = Number(s.nappies) || 0;
  return [
    { key: "feeds", label: feeds === 1 ? "feed" : "feeds", value: String(feeds) },
    { key: "sleep", label: "sleep", value: formatMinutes(Number(s.sleepMinutes) || 0) },
    { key: "nappies", label: nappies === 1 ? "nappy" : "nappies", value: String(nappies) },
  ];
}

// "4 feeds, 3 h 40 min sleep, 2 nappies". Used on the compact history rows and on Home.
export function summaryLine(summary) {
  return summaryBlocks(summary)
    .map((block) => `${block.value} ${block.label}`)
    .join(", ");
}

const REPEAT_WORDS = /\b(again|every|next dose|repeat|repeated|twice|daily|hours|hourly|tonight)\b/i;

// Up to three short lines to offer under "What is coming up", all built from real data. Never
// clinical advice: a medication line only says that one is due, because a repeat was logged.
// `names` is { me, partner }, used for the rota line.
export function suggestedNextUp(entries, rotaView, now = new Date(), names = {}) {
  const list = entries ?? [];
  const out = [];
  const at = (entry) => toDate(entry?.at);

  let lastFeed = null;
  let repeatMed = null;
  for (const entry of list) {
    const when = at(entry);
    if (!when) continue;
    if (entry.type === "feed" && (!lastFeed || when > at(lastFeed))) lastFeed = entry;
    if (entry.type === "medication" && REPEAT_WORDS.test(String(entry.details?.text ?? ""))) {
      if (!repeatMed || when > at(repeatMed)) repeatMed = entry;
    }
  }

  if (lastFeed) {
    const due = new Date(at(lastFeed).getTime() + 3 * 3600000);
    out.push(`Next feed due around ${formatTime(due)}`);
  }

  // A plan without a start date cannot say whose night it is, so nothing is offered.
  if (rotaView?.startDate) {
    try {
      const today = toDate(now) ?? new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const night = nightOwner(rotaView, iso);
      if (night.shared) out.push("Tonight is a split night");
      else if (night.who === "me") out.push(names.me ? `${names.me} is on duty tonight` : "You are on duty tonight");
      else if (night.who === "partner") out.push(`${names.partner || "Your partner"} is on duty tonight`);
    } catch {
      // A half saved plan should never stop the page offering the other suggestions.
    }
  }

  if (repeatMed) out.push("Medication due");

  return out.slice(0, 3);
}

// "waiting for you", "waiting for Mei" or "accepted".
export function handoverStatus(handover, meUid, toName = "") {
  if (!handover) return "";
  if (toDate(handover.acceptedAt)) return "accepted";
  if (handover.to && meUid && handover.to === meUid) return "waiting for you";
  return `waiting for ${toName || "your partner"}`;
}

// "7:10 AM to 7:10 PM", or "Yesterday 9:00 PM to 7:10 AM" when the shift crossed midnight.
export function formatWindow(periodStart, sentAt) {
  const from = toDate(periodStart);
  const to = toDate(sentAt);
  if (!from && !to) return "";
  if (!from) return formatTime(to);
  if (!to) return formatTime(from);
  const sameDay = from.toDateString() === to.toDateString();
  if (sameDay) return `${formatTime(from)} to ${formatTime(to)}`;
  return `${dayLabel(from, to)} ${formatTime(from)} to ${formatTime(to)}`;
}

// The care log timeline, with a divider row at each handover boundary. `entries` is one day's
// entries, newest first; `handovers` is whatever the shared listener already holds, so this
// costs nothing extra. A boundary only shows when there is an entry on both sides of it, so a
// divider never hangs at the top or the bottom of a day.
export function handoverRows(entries, handovers) {
  const list = entries ?? [];
  if (list.length < 2) return list.map((entry) => ({ kind: "entry", key: entry.id, entry }));

  const times = [];
  for (const handover of handovers ?? []) {
    const sent = toDate(handover?.sentAt);
    if (sent) times.push({ id: handover.id, time: sent.getTime() });
  }
  times.sort((a, b) => b.time - a.time);

  const rows = [];
  for (let i = 0; i < list.length; i += 1) {
    const current = toDate(list[i].at)?.getTime();
    const previous = i > 0 ? toDate(list[i - 1].at)?.getTime() : null;
    if (previous != null && current != null) {
      for (const boundary of times) {
        if (boundary.time <= previous && boundary.time > current) {
          rows.push({
            kind: "divider",
            key: `handover-${boundary.id}`,
            label: `Handover sent ${formatTime(new Date(boundary.time))}`,
          });
        }
      }
    }
    rows.push({ kind: "entry", key: list[i].id, entry: list[i] });
  }
  return rows;
}

// ---- Tasks handed over with a handover -----------------------------------------------------
//
// A handover carries a frozen list of the checklist tasks that were passed on: { id, text, ref },
// where ref is the id of the task on the shared checklist. Whether one is done is never copied:
// it is read from the checklist, so there is only one place to tick it.
export const TASKS_MAX = 6;
export const TASK_TEXT_MAX = 120;

// The tasks as they are stored: trimmed, one per checklist task, numbered t1, t2.
export function cleanTasks(list) {
  const seen = new Set();
  const out = [];
  for (const item of list ?? []) {
    const text = String(item?.text ?? "").replace(/\s+/g, " ").trim().slice(0, TASK_TEXT_MAX);
    const ref = typeof item?.ref === "string" ? item.ref.slice(0, 64) : "";
    const key = ref || text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `t${out.length + 1}`, text, ref });
    if (out.length >= TASKS_MAX) break;
  }
  return out;
}

// Adds `done` to each handed over task, read from the checklist tasks by ref. A task that was
// deleted from the checklist counts as not done.
export function tasksWithState(tasks, checklist) {
  const byId = new Map((checklist ?? []).map((task) => [task.id, task]));
  return (tasks ?? []).map((task) => ({ ...task, done: Boolean(byId.get(task.ref)?.done) }));
}

// { done, total, label } where label is "2 of 3 done", "All done" or "" when there are none.
export function taskProgress(tasks) {
  const list = tasks ?? [];
  const done = list.filter((task) => task?.done).length;
  const total = list.length;
  let label = "";
  if (total) label = done === total ? "All done" : `${done} of ${total} done`;
  return { done, total, label };
}
