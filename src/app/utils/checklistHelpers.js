// Pure helpers for the App checklist. No Vue, Pinia, Firebase or storage imports.
//
// The checklist is the shared task list: { id, title, group, due, owner, done, doneAt,
// doneBy, notes }. `owner` is a uid or "both". The same tasks also show on the Return to work plan.
import { addDays, isIsoDate, toIso } from "./rotaHelpers";
import { dueText } from "./rtwHelpers";
import { ownerKey } from "./sharedHelpers";
import { toDate } from "./entryHelpers";

export const TABS = Object.freeze(["all", "mine", "partner"]);
export const TITLE_MAX = 120;

// "me", "partner", "both" or "open" for a task, from the signed in user's point of view.
export function taskOwner(task, meUid) {
  return ownerKey(task?.owner, meUid) ?? "open";
}

// Which tasks a tab shows. Shared tasks belong to both tabs.
export function inTab(task, tab, meUid) {
  if (tab === "all") return true;
  const who = taskOwner(task, meUid);
  if (who === "both" || who === "open") return true;
  return tab === "mine" ? who === "me" : who === "partner";
}

function dueGroup(due, todayIso) {
  if (!isIsoDate(due)) return "none";
  if (due <= todayIso) return "today";
  if (due <= addDays(todayIso, 6)) return "week";
  return "later";
}

const GROUPS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "none", label: "No date" },
];

function byDueThenTitle(a, b) {
  const ad = a.due || "9999-99-99";
  const bd = b.due || "9999-99-99";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return String(a.title).localeCompare(String(b.title));
}

// The page's view of the list: open tasks in groups (overdue ones sit under Today), empty
// groups left out, and finished tasks newest first. Returns { groups, done, openCount }.
export function checklistView(tasks, { meUid = "", tab = "all", today = new Date() } = {}) {
  const todayIso = toIso(today);
  const shown = (tasks ?? []).filter((task) => inTab(task, tab, meUid));
  const open = shown.filter((task) => !task.done);
  const done = shown
    .filter((task) => task.done)
    .sort((a, b) => (toDate(b.doneAt)?.getTime() ?? 0) - (toDate(a.doneAt)?.getTime() ?? 0));
  const groups = GROUPS.map((group) => ({
    ...group,
    tasks: open.filter((task) => dueGroup(task.due, todayIso) === group.key).sort(byDueThenTitle),
  })).filter((group) => group.tasks.length);
  return { groups, done, openCount: open.length };
}

// "Due today", "Due tomorrow", "Due in 3 days" or "Overdue by 2 days"; empty with no date.
export function dueLabel(task, today = new Date()) {
  return dueText(task?.due, today);
}

// One short line of what the owner column shows: a first initial and a name.
export function ownerChip(task, { meUid = "", meName = "Me", partnerName = "Your partner" } = {}) {
  const who = taskOwner(task, meUid);
  if (who === "both") return { initial: "B", name: "Both" };
  if (who === "me") return { initial: (meName || "M").charAt(0).toUpperCase(), name: meName || "Me" };
  if (who === "partner") return { initial: (partnerName || "P").charAt(0).toUpperCase(), name: partnerName || "Your partner" };
  return { initial: "?", name: "Not set" };
}
