// Options and helpers for the "Your baby" setup page.
export const FEEDING_OPTIONS = [
  { value: "breast", title: "Breastfeeding", short: "breast" },
  { value: "expressed", title: "Expressed milk", short: "expressed milk" },
  { value: "formula", title: "Formula", short: "bottle" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Parse "YYYY-MM-DD" as a local date. Returns null when invalid.
export function parseDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value) {
  const d = parseDate(value);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "Not set";
}

export function ageInWeeks(value, now = new Date()) {
  const d = parseDate(value);
  if (!d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today - d) / (7 * 24 * 60 * 60 * 1000)));
}

export function formatAge(value, now = new Date()) {
  const w = ageInWeeks(value, now);
  if (w === null) return "Not set";
  return `${w} ${w === 1 ? "week" : "weeks"}`;
}
