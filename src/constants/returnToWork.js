// Sample data for the Return to work page. All values are placeholders.
import { SAMPLE } from "@/shared/constants/appConstants";

// Demo "today" so the countdown matches the Figma frame (27 days to go).
// Replace with `new Date()` once the app is live.
export const TODAY = new Date(2026, 9, 6); // 6 Oct 2026
// Last day of leave: Sunday 1 November 2026.
export const LEAVE_END = new Date(2026, 10, 1);

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Whole days from `from` to `to`, ignoring the time of day.
export function daysBetween(from, to) {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY);
}

// Leave runs to the end of its last day, so that day counts: 6 Oct to 1 Nov is 27 days to go.
export function daysToGo(today = TODAY, leaveEnd = LEAVE_END) {
  return Math.max(0, daysBetween(today, leaveEnd) + 1);
}

export function isoDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function parseIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "20 Oct"
export function shortDate(iso) {
  const d = parseIso(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// "Tue 20 Oct"
export function longDate(iso) {
  const d = parseIso(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Due date choices from today to the first day back at work (2 Nov).
export const DUE_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + i);
  const iso = isoDate(d);
  return { value: iso, label: longDate(iso) };
});

export const REMINDER_OPTIONS = [
  { value: "none", label: "No reminder" },
  { value: "day-before", label: "The day before, 9 AM" },
  { value: "on-the-day", label: "On the day, 9 AM" },
  { value: "week-before", label: "One week before, 9 AM" },
];

export const MILESTONES = [
  { label: "Today", date: "6 Oct" },
  { label: "Manager talk", date: "20 Oct" },
  { label: "Nursery trial", date: "30 Oct" },
  { label: "Back at work", date: "2 Nov" },
];

export const GROUPS = ["Childcare", "Work", "Home", "Pumping", "Wellbeing"];

// Owners are stored as "daniel" | "mei" | "both" and labelled per viewer.
export function ownerLabel(owner, viewer) {
  if (owner === "both") return "Both of you";
  if (viewer === "you") return owner === "daniel" ? "You" : SAMPLE.partner;
  return owner === "mei" ? SAMPLE.partner : SAMPLE.me;
}

export function ownerOptions(viewer) {
  return ["daniel", "mei", "both"].map((value) => ({ value, label: ownerLabel(value, viewer) }));
}

const t = (id, group, title, due, owner, done = false, extra = {}) => ({
  id,
  group,
  title,
  due,
  owner,
  done,
  reminder: "day-before",
  notes: "",
  ...extra,
});

// Factory so tests and page reloads can start from a clean copy.
export function createPlans() {
  return {
    you: {
      id: "you",
      label: "Your plan",
      leaveText: `Your paternity leave ends Sunday 1 November.`,
      tasks: [
        t("y-nursery-place", "Childcare", "Confirm the nursery place", "2026-10-14", "daniel", true),
        t("y-nursery-trial", "Childcare", "Trial morning at the nursery", "2026-10-30", "both"),
        t("y-first-day-bag", "Childcare", "Pack the first-day bag", "2026-11-01", "mei"),
        t("y-manager", "Work", "Talk to your manager about hours", "2026-10-20", "daniel", false, {
          notes: "Ask about starting at 9:30 AM for the first two weeks.",
        }),
        t("y-phased", "Work", "Agree a phased return", "2026-10-23", "daniel"),
        t("y-handover", "Work", "Hand over open projects", "2026-10-29", "daniel"),
        t("y-nights", "Home", "Plan who does night wakings on workdays", "2026-10-18", "both", true),
        t("y-meals", "Home", "Meal plan for the first week back", "2026-10-30", "mei"),
        t("y-pump-space", "Pumping", "Ask about a pumping space at work", "2026-10-20", "mei", true),
        t("y-pump-spot", "Pumping", "Pick a pumping spot near the office", "2026-10-23", "mei", true),
        t("y-pump-times", "Pumping", "Plan pumping times for the workday", "2026-10-28", "mei"),
        t("y-cooler", "Pumping", "Set up the cooler bag and milk storage", "2026-10-30", "mei"),
        t("y-checkin", "Wellbeing", "Book a catch-up check-in after week one", "2026-11-02", "daniel"),
      ],
    },
    mei: {
      id: "mei",
      label: "Mei's plan",
      leaveText: `Mei's maternity leave ends Sunday 1 November.`,
      tasks: [
        t("m-pump-space", "Pumping", "Ask about a pumping space at work", "2026-10-20", "mei", true),
        t("m-pump-spot", "Pumping", "Pick a pumping spot near the office", "2026-10-23", "mei", true),
        t("m-pump-times", "Pumping", "Plan pumping times for the workday", "2026-10-28", "mei"),
        t("m-cooler", "Pumping", "Set up the cooler bag and milk storage", "2026-10-30", "mei"),
        t("m-nursery-trial", "Childcare", "Trial morning at the nursery", "2026-10-30", "both"),
        t("m-first-day-bag", "Childcare", "Pack the first-day bag", "2026-11-01", "mei"),
      ],
    },
  };
}
