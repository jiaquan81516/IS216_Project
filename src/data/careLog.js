import { reactive } from "vue";

// Shared in-memory care log. Placeholder sample data, replaced by Firestore later.
// Dates are ISO strings, "min" is minutes since midnight, who is "D" (Daniel) or "M" (Mei).
export const TODAY = "2026-10-06";
export const NOW_MIN = 21 * 60 + 40; // 9:40 PM in the sample day

export const TABS = [
  { value: "all", label: "All" },
  { value: "feed", label: "Feeds" },
  { value: "sleep", label: "Sleep" },
  { value: "nappy", label: "Nappies" },
  { value: "medication", label: "Medication" },
  { value: "note", label: "Notes" },
];

export const TYPE_LABEL = {
  feed: "Feed",
  nappy: "Nappy",
  sleep: "Sleep",
  medication: "Medication",
  note: "Note",
};

export const TYPE_BADGE = {
  feed: { color: "blue", outlined: false },
  nappy: { color: "teal", outlined: false },
  sleep: { color: "gray", outlined: false },
  medication: { color: "gray", outlined: true },
  note: { color: "gray", outlined: true },
};

// Day headings, plus counts that happened but are not listed in the sample entries.
export const DAYS = {
  "2026-10-06": { label: "Today, Tuesday 6 October", suffix: " logged", extra: { nappies: 1 } },
  "2026-10-05": { label: "Yesterday, Monday 5 October", suffix: "", extra: { feeds: 4, nappies: 4, sleepMin: 200 } },
  "2026-10-04": { label: "Sunday 4 October", suffix: "", extra: { feeds: 5, nappies: 4, sleepMin: 150 } },
  "2026-10-03": { label: "Saturday 3 October", suffix: "", extra: { feeds: 5, nappies: 5, sleepMin: 120 } },
};

let nextId = 100;
const make = (date, min, type, who, text, rest = {}) => ({
  id: ++nextId,
  date,
  min,
  type,
  who,
  text,
  detail: "",
  seen: true,
  seenAt: "",
  sleepMin: 0,
  live: false,
  added: false,
  ...rest,
});

export const entries = reactive([
  make(TODAY, 21 * 60 + 31, "feed", "M", "Timer started 9:31 PM, 9 minutes so far.", {
    live: true,
    title: "Mei is feeding",
    detail: "You will be told when she saves it.",
  }),
  make(TODAY, 21 * 60 + 5, "feed", "M", "Left breast, 14 minutes", { seen: false }),
  make(TODAY, 20 * 60 + 40, "nappy", "M", "Wet, changed", { seen: false }),
  make(TODAY, 18 * 60 + 20, "feed", "M", "Bottle, 90 ml", { seen: false }),
  make(TODAY, 17 * 60 + 50, "note", "D", "Handover to Mei sent. She accepted at 5:54 PM.", {
    detail: "Baby was fussy after the 3 PM feed.",
    seenAt: "5:54 PM",
  }),
  make(TODAY, 15 * 60 + 5, "feed", "D", "Bottle, 110 ml", { seenAt: "3:12 PM" }),
  make(TODAY, 13 * 60 + 30, "sleep", "D", "Nap, 1 h 40 min", { seenAt: "2:00 PM", sleepMin: 100 }),
  make(TODAY, 8 * 60 + 15, "medication", "D", "Vitamin D drops, as on the label", { seenAt: "8:20 AM" }),

  make("2026-10-05", 23 * 60 + 55, "feed", "M", "Right breast, 18 minutes", { seenAt: "12:10 AM" }),
  make("2026-10-05", 20 * 60 + 20, "feed", "D", "Bottle, 100 ml", { seenAt: "8:31 PM" }),
  make("2026-10-05", 14 * 60 + 10, "nappy", "D", "Dirty, changed", { seenAt: "2:15 PM" }),

  make("2026-10-04", 22 * 60 + 40, "feed", "M", "Left breast, 16 minutes", { seenAt: "10:58 PM" }),
  make("2026-10-04", 18 * 60, "nappy", "D", "Wet, changed", { seenAt: "6:05 PM" }),
  make("2026-10-04", 12 * 60 + 15, "sleep", "M", "Nap, 1 h 10 min", { seenAt: "1:40 PM", sleepMin: 70 }),

  make("2026-10-03", 23 * 60 + 10, "feed", "D", "Bottle, 100 ml", { seenAt: "11:20 PM" }),
  make("2026-10-03", 16 * 60 + 30, "note", "M", "Fed more often from late afternoon.", { seenAt: "4:45 PM" }),
  make("2026-10-03", 9 * 60, "medication", "D", "Vitamin D drops, as on the label", { seenAt: "9:10 AM" }),
]);

export function fmtTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// Newest first. The live "Mei is feeding" row always leads its day.
export function sortEntries(list) {
  return [...list].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : Number(b.live) - Number(a.live) || b.min - a.min,
  );
}

// Tab value to entries. "all" keeps everything.
export function filterEntries(list, tab) {
  return tab === "all" ? list : list.filter((e) => e.type === tab);
}

export function groupByDay(list) {
  const groups = [];
  for (const e of sortEntries(list)) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== e.date) {
      g = { date: e.date, entries: [] };
      groups.push(g);
    }
    g.entries.push(e);
  }
  return groups;
}

export function dayStats(date, list = entries) {
  const day = list.filter((e) => e.date === date);
  const extra = DAYS[date]?.extra ?? {};
  const feeds = day.filter((e) => e.type === "feed");
  const sleepMin = day.reduce((s, e) => s + e.sleepMin, 0) + (extra.sleepMin ?? 0);
  return {
    feeds: feeds.length + (extra.feeds ?? 0),
    feedsMei: feeds.filter((e) => e.who === "M").length,
    feedsYou: feeds.filter((e) => e.who === "D").length,
    nappies: day.filter((e) => e.type === "nappy").length + (extra.nappies ?? 0),
    sleepMin,
  };
}

export function fmtSleep(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function dayLabel(date) {
  return DAYS[date]?.label ?? date;
}

export function daySummary(date, list = entries) {
  const s = dayStats(date, list);
  const feeds = `${s.feeds} ${s.feeds === 1 ? "feed" : "feeds"}`;
  const nappies = `${s.nappies} ${s.nappies === 1 ? "nappy" : "nappies"}`;
  return `${feeds}, ${nappies}, ${fmtSleep(s.sleepMin)} sleep${DAYS[date]?.suffix ?? ""}`;
}

// Second line under an entry.
export function seenLine(e) {
  if (e.who === "M") return `Mei, ${e.seen ? `seen by you ${e.seenAt}` : "not seen by you yet"}`;
  return `You, ${e.seenAt ? `seen by Mei ${e.seenAt}` : "not seen by Mei yet"}`;
}

export const isUnseen = (e) => e.who === "M" && !e.live && !e.seen;

export function markAllSeen(list = entries) {
  for (const e of list) {
    if (isUnseen(e)) {
      e.seen = true;
      e.seenAt = fmtTime(NOW_MIN);
    }
  }
}

// Adds an entry from the signed in parent (Daniel) and returns it.
export function addEntry(partial) {
  const entry = make(partial.date ?? TODAY, partial.min ?? NOW_MIN, partial.type, partial.who ?? "D", partial.text, {
    detail: partial.detail ?? "",
    sleepMin: partial.sleepMin ?? 0,
    added: true,
  });
  entries.push(entry);
  return entry;
}
