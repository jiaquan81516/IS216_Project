// Pure helpers for the App Return to work page. No Vue, Pinia or storage imports.
import { addDays, daysBetween, isIsoDate, parseIso, toIso } from "@/app/api/rotaHelpers";
import { ownerKey } from "@/app/api/sharedHelpers";
import { PUMPING_TIMES, RESPONSIBILITY_AREAS, SUGGESTED_TASKS } from "@/app/data/rtw";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const asIso = (value) => (value instanceof Date ? toIso(value) : String(value));

// Whole days from today to the return date. Null when there is no valid return date.
export function daysUntil(returnDate, today = new Date()) {
  if (!isIsoDate(returnDate)) return null;
  return daysBetween(asIso(today), returnDate);
}

// "4 November", with the year added when it is not the current year.
export function formatDay(iso, today = new Date()) {
  if (!isIsoDate(iso)) return "";
  const d = parseIso(iso);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const thisYear = parseIso(asIso(today)).getFullYear();
  return d.getFullYear() === thisYear ? base : `${base} ${d.getFullYear()}`;
}

// "Back at work on 4 November. 21 days to go."
export function returnSentence(returnDate, today = new Date()) {
  const d = daysUntil(returnDate, today);
  if (d === null) return "";
  const day = formatDay(returnDate, today);
  if (d < 0) return `Back at work since ${day}.`;
  if (d === 0) return `Back at work on ${day}. That is today.`;
  return `Back at work on ${day}. ${d} ${d === 1 ? "day" : "days"} to go.`;
}

const plural = (n) => `${n} ${n === 1 ? "day" : "days"}`;

// "Due tomorrow", "Due in 5 days", "Overdue by 2 days". Empty when there is no due date.
export function dueText(due, today = new Date()) {
  if (!isIsoDate(due)) return "";
  const d = daysBetween(asIso(today), due);
  if (d < 0) return `Overdue by ${plural(-d)}`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d} days`;
}

// Sorted by due date (no date last), then title. Returns a new array.
export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const ad = a.due || "9999-99-99";
    const bd = b.due || "9999-99-99";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return String(a.title).localeCompare(String(b.title));
  });
}

export const GROUP_ORDER = Object.freeze(["Overdue", "This week", "Later", "No date", "Done"]);

// Groups tasks for the Plan tab. "This week" means today and the next six days. Empty groups
// are left out. Each group is [{ label, tasks }] sorted by due date then title.
export function groupTasks(tasks, today = new Date()) {
  const now = asIso(today);
  const weekEnd = addDays(now, 6);
  const buckets = Object.fromEntries(GROUP_ORDER.map((label) => [label, []]));
  for (const task of tasks) {
    if (task.done) buckets.Done.push(task);
    else if (!task.due) buckets["No date"].push(task);
    else if (task.due < now) buckets.Overdue.push(task);
    else if (task.due <= weekEnd) buckets["This week"].push(task);
    else buckets.Later.push(task);
  }
  return GROUP_ORDER.filter((label) => buckets[label].length).map((label) => ({
    label,
    tasks: sortTasks(buckets[label]),
  }));
}

// Open tasks per owner. Done tasks are not counted. An owner is a uid or "both", so the
// signed in user's uid decides which column a task falls into.
export function ownerCounts(tasks, meUid) {
  const counts = { me: 0, partner: 0, both: 0 };
  for (const task of tasks) {
    if (task.done) continue;
    const key = ownerKey(task.owner, meUid);
    if (counts[key] !== undefined) counts[key] += 1;
  }
  return counts;
}

const norm = (title) => String(title).trim().toLowerCase();

// Suggestions whose title is not already a task. Returns [{ title, group }].
export function suggestedTasks(existingTitles = []) {
  const taken = new Set(existingTitles.map(norm));
  return SUGGESTED_TASKS.filter((s) => !taken.has(norm(s.title))).map((s) => ({ ...s }));
}

// Counts for the Responsibilities tab. Areas with no choice count as not decided. An owner
// is a uid or "both", so the signed in user's uid decides which column an area falls into.
export function responsibilityCounts(responsibilities = {}, meUid) {
  const counts = { me: 0, partner: 0, both: 0, undecided: 0 };
  for (const area of RESPONSIBILITY_AREAS) {
    const who = ownerKey(responsibilities[area.key], meUid);
    if (who === "me" || who === "partner" || who === "both") counts[who] += 1;
    else counts.undecided += 1;
  }
  return counts;
}

// "You cover 2, Mei covers 1, shared 3, not decided 2."
export function responsibilitySummary(counts, partnerName = "Your partner") {
  return `You cover ${counts.me}, ${partnerName} covers ${counts.partner}, shared ${counts.both}, not decided ${counts.undecided}.`;
}

// Suggestion shown when one person has 2 or more extra areas. Empty string otherwise.
// The fallback names are "You" and "Your partner".
export function balanceHint(counts, names = {}) {
  const meName = names.me || "You";
  const partnerName = names.partner || "Your partner";
  const asObject = (name) => (name === "You" || name === "Your partner" ? name.toLowerCase() : name);
  const diff = counts.me - counts.partner;
  if (Math.abs(diff) < 2) return "";
  if (diff > 0) return `${meName} ${meName === "You" ? "have" : "has"} ${diff} more than ${asObject(partnerName)}. Consider moving one.`;
  return `${partnerName} has ${-diff} more than ${asObject(meName)}. Consider moving one.`;
}

// "Plan for 3 breaks: morning, midday, afternoon." Empty when nothing is chosen yet.
export function pumpingSummary(pumping) {
  const count = pumping?.sessions;
  const order = PUMPING_TIMES.map((t) => t.value);
  const times = (pumping?.times ?? []).filter((t) => order.includes(t)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (!count && !times.length) return "";
  const lead = count ? `Plan for ${count} breaks` : "Plan for breaks";
  return times.length ? `${lead}: ${times.join(", ")}.` : `${lead}.`;
}

export function pumpingProgress(items = []) {
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, text: `${done} of ${items.length} done` };
}
