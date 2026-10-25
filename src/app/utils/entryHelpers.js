// Pure helpers for care log entries. No Firebase imports so they are easy to test.

// Types, labels, icons and the field set each one uses.
export const ENTRY_TYPES = Object.freeze({
  feed: {
    label: "Feeding",
    icon: "feed",
    hint: "Method, time and notes",
    fields: ["method", "side", "minutes", "ml"],
  },
  sleep: { label: "Sleep", icon: "moon", hint: "Start and end time", fields: [] },
  nappy: { label: "Diaper", icon: "diaper", hint: "Type and time", fields: ["nappyType"] },
  note: { label: "Note", icon: "note", hint: "Something to remember", fields: ["text"] },
  medication: { label: "Medication", icon: "medication", hint: "Name and dose", fields: ["drug", "dose"] },
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function pad2(n) {
  return String(n).padStart(2, "0");
}

// Accepts a Firestore Timestamp, a Date, a number of milliseconds or null.
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "9:05 PM", the same on every browser.
export function formatTime(value) {
  const date = toDate(value);
  if (!date) return "";
  const h = date.getHours();
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${pad2(date.getMinutes())} ${suffix}`;
}

// "21:05" for time inputs.
export function toTimeInput(value) {
  const date = toDate(value);
  return date ? `${pad2(date.getHours())}:${pad2(date.getMinutes())}` : "";
}

export function startOfDay(value) {
  const date = new Date(toDate(value));
  date.setHours(0, 0, 0, 0);
  return date;
}

// "9 h 40 min", "45 min", "2 h".
export function formatMinutes(total) {
  const minutes = Math.max(0, Math.round(total));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function sentenceCase(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

// Returns { title, detail, note }. `note` is the optional free text on non-note entries.
export function summariseEntry(entry) {
  const type = entry?.type;
  const d = entry?.details ?? {};
  const title = ENTRY_TYPES[type]?.label ?? "Entry";
  let detail = "";
  let note = "";

  if (type === "feed") {
    const parts = [];
    if (d.method === "breast") {
      parts.push("Breastfeeding");
      if (d.side) parts.push(d.side);
      if (d.minutes) parts.push(plural(d.minutes, "minute"));
    } else if (d.method === "expressed") {
      parts.push("Expressed milk");
      if (d.ml) parts.push(`${d.ml} ml`);
    } else if (d.method === "bottle") {
      parts.push("Bottle");
      if (d.ml) parts.push(`${d.ml} ml`);
    } else {
      parts.push("Feed");
    }
    detail = parts.join(", ");
    note = d.text ?? "";
  } else if (type === "sleep") {
    const start = toDate(entry.at);
    const end = toDate(entry.endedAt);
    if (end && start) {
      detail = `${formatMinutes((end - start) / 60000)}, ${formatTime(start)} to ${formatTime(end)}`;
    } else {
      detail = `Started ${formatTime(start)}, still sleeping`;
    }
    note = d.text ?? "";
  } else if (type === "nappy") {
    detail = d.nappyType ? `${sentenceCase(d.nappyType)} nappy` : "Nappy change";
    note = d.text ?? "";
  } else if (type === "medication") {
    detail = [d.drug, d.dose].filter(Boolean).join(", ");
    note = d.text ?? "";
  } else if (type === "note") {
    detail = d.text ?? "";
  }
  return { title, detail, note };
}

export function dayLabel(value, today = new Date()) {
  const date = startOfDay(value);
  const base = startOfDay(today);
  const diff = Math.round((base - date) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// Groups entries (already newest first) by local day, keeping their order.
export function groupByDay(entries, today = new Date()) {
  const groups = [];
  for (const entry of entries) {
    const at = toDate(entry.at);
    if (!at) continue;
    const key = `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`;
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(at, today), entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

// Totals since local midnight. A sleep that is still going counts up to now.
export function todayStats(entries, now = new Date()) {
  const midnight = startOfDay(now).getTime();
  let feeds = 0;
  let nappies = 0;
  let sleepMinutes = 0;
  for (const entry of entries) {
    const at = toDate(entry.at);
    if (!at || at.getTime() < midnight) continue;
    if (entry.type === "feed") feeds += 1;
    else if (entry.type === "nappy") nappies += 1;
    else if (entry.type === "sleep") {
      const end = toDate(entry.endedAt) ?? now;
      sleepMinutes += Math.max(0, (end - at) / 60000);
    }
  }
  return { feeds, sleepMinutes: Math.round(sleepMinutes), nappies };
}

// Newest entry of a type. Works whatever the order of the list.
export function lastOfType(entries, type) {
  let best = null;
  for (const entry of entries) {
    if (entry.type !== type) continue;
    const at = toDate(entry.at);
    if (!at) continue;
    if (!best || at > toDate(best.at)) best = entry;
  }
  return best;
}

// Turns a Firestore error code into the message shown on the care log and Home.
// `detail` is a muted extra line, only used for unknown codes.
export function describeEntriesError(code) {
  const c = String(code ?? "");
  if (c === "permission-denied") {
    return {
      text: "Firebase denied access to the care log. Check that this account is a household parent or, for a caregiver, that “View care logs” is enabled. If access should be allowed, ask the administrator to verify the latest firestore.rules are published to the app’s Firebase project.",
      detail: "",
    };
  }
  if (c === "failed-precondition") {
    return { text: "The database needs an index for this view. Check the console link in the browser log.", detail: "" };
  }
  if (c === "unavailable" || c === "timeout" || c === "deadline-exceeded") {
    return { text: "We could not load the care log. Check your connection and try again.", detail: "" };
  }
  return { text: "We could not load the care log.", detail: c ? `Error code: ${c}` : "" };
}

// "Last feed 9:05 PM", or "Last feed yesterday, 9:05 PM" for older feeds.
export function lastFeedHeading(feed, now = new Date()) {
  const at = toDate(feed?.at);
  if (!at) return "";
  const time = formatTime(at);
  if (at.toDateString() === now.toDateString()) return `Last feed ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return `Last feed ${at.toDateString() === yesterday.toDateString() ? "yesterday" : "earlier"}, ${time}`;
}
