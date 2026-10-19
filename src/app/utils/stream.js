// Pure helpers for the Home stream. No Vue, Pinia or Firebase imports.
//
// The stream is one newest-first list that merges four sources: plain messages (posts),
// care log entries and tasks. Every source is turned into the same item shape so
// the page can draw them with one template.
//
//   { id, rawId, kind, at, authorUid, authorName, isMine, text, kindLabel, meta,
//     needsAck, acked, ackedBy, ackedByNames, pending, done }
import { toDate } from "./entryHelpers";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86400000;
export const TASK_WINDOW_DAYS = 7;
export const DONE_VISIBLE_MS = DAY_MS;

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Local calendar day as yyyy-mm-dd. Day boundaries always follow the device's time zone.
export function localKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Whole calendar days from a to b, counted on local dates so a 23 or 25 hour day still
// counts as one.
function dayDiff(a, b) {
  return Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      DAY_MS,
  );
}

function parseIso(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

// "Mei Lin" gives "Mei", "daniel tan" gives "Daniel". Empty when there is nothing to use.
export function firstNameOf(value) {
  const first = String(value ?? "").trim().split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

function nameMap(members) {
  const map = new Map();
  for (const member of members ?? []) {
    if (!member?.uid) continue;
    const name = firstNameOf(member.displayName || member.firstName);
    if (name) map.set(member.uid, name);
  }
  return map;
}

// ackedBy may be an array of uids or a map of uid to timestamp. Both give a list of uids.
export function ackList(value) {
  if (Array.isArray(value)) return [...new Set(value.filter((u) => typeof u === "string" && u))];
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

function dueLabel(dueIso, now) {
  const due = parseIso(dueIso);
  if (!due) return "";
  const diff = dayDiff(now, due);
  if (diff < 0) return "overdue";
  if (diff === 0) return "due today";
  if (diff === 1) return "due tomorrow";
  if (diff <= 6) return `due ${WEEKDAYS[due.getDay()]}`;
  return `due ${due.getDate()} ${MONTHS[due.getMonth()]}`;
}


// One line for a care entry, such as "Fed 120 ml" or "Diaper, wet nappy".
export function careLine(entry) {
  const d = entry?.details ?? {};
  const tail = (text) => (d.text ? `${text}, ${d.text}` : text);
  switch (entry?.type) {
    case "feed": {
      if (d.method === "breast") {
        const parts = ["Breastfed"];
        if (d.side) parts.push(d.side);
        if (d.minutes) parts.push(`${d.minutes} minutes`);
        return tail(parts.join(", "));
      }
      if (d.method === "expressed") return tail(d.ml ? `Fed ${d.ml} ml expressed milk` : "Fed expressed milk");
      return tail(d.ml ? `Fed ${d.ml} ml` : "Fed");
    }
    case "sleep": {
      const start = toDate(entry.at);
      const end = toDate(entry.endedAt);
      if (start && end && end > start) {
        const minutes = Math.round((end - start) / 60000);
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const span = h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
        return tail(`Slept ${span}`);
      }
      return tail("Sleeping");
    }
    case "nappy":
      return tail(d.nappyType ? `Diaper, ${d.nappyType} nappy` : "Diaper change");
    case "medication":
      return tail(["Medicine", [d.drug, d.dose].filter(Boolean).join(" ")].filter(Boolean).join(", "));
    case "note":
      return d.text || "Note";
    default:
      return "Care entry";
  }
}

function ackState({ uid, authorUid, ackedBy }) {
  const mine = authorUid === uid;
  const others = ackedBy.filter((u) => u !== authorUid);
  return {
    needsAck: !mine,
    // Someone else's post is acknowledged when I did it; my own once anyone else did.
    acked: mine ? others.length > 0 : ackedBy.includes(uid),
  };
}

function base({ id, kind, at, authorUid, uid, names, text, kindLabel = "", meta = {}, pending = false }) {
  const isMine = Boolean(uid) && authorUid === uid;
  return {
    id: `${kind}:${id}`,
    rawId: id,
    kind,
    at,
    authorUid: authorUid ?? "",
    authorName: isMine ? "You" : names.get(authorUid) || "Your partner",
    isMine,
    text,
    kindLabel,
    meta,
    needsAck: false,
    acked: false,
    ackedBy: [],
    ackedByNames: [],
    pending,
    done: false,
  };
}

function withAck(item, ackedBy, uid, names, needs = true) {
  const state = ackState({ uid, authorUid: item.authorUid, ackedBy });
  item.ackedBy = ackedBy;
  item.ackedByNames = ackedBy.map((u) => (u === uid ? "you" : names.get(u) || "your partner"));
  item.needsAck = needs && state.needsAck;
  item.acked = state.acked;
  return item;
}

function messageItem(post, { uid, names, now }) {
  if (!post || typeof post.text !== "string" || !post.text.trim()) return null;
  // serverTimestamp() is null until the server answers. The message is brand new, so it
  // belongs at the top.
  const created = toDate(post.createdAt);
  const item = base({
    id: post.id,
    kind: "message",
    at: created ?? now,
    authorUid: post.authorUid,
    uid,
    names,
    text: post.text.trim(),
    pending: !created,
  });
  return withAck(item, ackList(post.ackedBy), uid, names);
}

function careItem(entry, { uid, names }) {
  const at = toDate(entry?.at);
  if (!entry || !at) return null;
  if (entry.by && entry.byName && !names.has(entry.by)) names.set(entry.by, firstNameOf(entry.byName));
  return base({ id: entry.id, kind: "care", at, authorUid: entry.by, uid, names, text: careLine(entry), kindLabel: "Care" });
}

function taskItem(task, { uid, names, now }) {
  if (!task || typeof task.title !== "string" || !task.title.trim()) return null;
  const done = Boolean(task.done);
  const due = parseIso(task.due) ? task.due : null;
  if (done) {
    const doneAt = toDate(task.doneAt);
    if (doneAt && now.getTime() - doneAt.getTime() > DONE_VISIBLE_MS) return null;
  } else {
    const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + TASK_WINDOW_DAYS);
    const dueSoon = due ? parseIso(due) <= limit : false;
    const assigned = Boolean(task.owner) && task.owner !== "open";
    if (!dueSoon && !assigned) return null;
  }
  const created = toDate(task.createdAt);
  const label = due ? dueLabel(due, now) : "";
  const item = base({
    id: task.id,
    kind: "task",
    at: created ?? now,
    authorUid: task.createdBy,
    uid,
    names,
    text: task.title.trim(),
    kindLabel: label ? `Task, ${label}` : "Task",
    meta: { due, dueLabel: label, owner: task.owner ?? "", ownerName: ownerName(task.owner, uid, names) },
    pending: !created,
  });
  item.done = done;
  return item;
}

function ownerName(owner, uid, names) {
  if (!owner) return "";
  if (owner === "both") return "Both";
  if (owner === uid) return "You";
  return names.get(owner) || "Your partner";
}

// Newest first. Equal times fall back to the id, so the order never flickers between
// two snapshots.
function compare(a, b) {
  const diff = b.at.getTime() - a.at.getTime();
  if (diff) return diff;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

export function buildStream({ posts = [], entries = [], tasks = [], uid = "", members = [], now = new Date() } = {}) {
  const names = nameMap(members);
  const context = { uid, names, now };
  const items = [];
  const push = (list, make) => {
    for (const source of list ?? []) {
      const item = make(source, context);
      if (item) items.push(item);
    }
  };
  push(posts, messageItem);
  push(entries, careItem);
  push(tasks, taskItem);
  return items.sort(compare);
}

export function dayLabelFor(date, now) {
  const diff = dayDiff(date, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// Groups by local day, keeping the order of the items. Returns [{ key, label, items }].
export function groupByDay(items, now = new Date()) {
  const groups = [];
  const index = new Map();
  for (const item of items ?? []) {
    const at = toDate(item?.at);
    if (!at) continue;
    const key = localKey(at);
    let group = index.get(key);
    if (!group) {
      group = { key, label: dayLabelFor(at, now), items: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

// Posts from your partner that you have not acknowledged yet.
export function unreadCount(items, uid) {
  if (!uid) return 0;
  return (items ?? []).filter(
    (item) => item.kind === "message" && item.needsAck && !item.acked && item.authorUid !== uid,
  ).length;
}

