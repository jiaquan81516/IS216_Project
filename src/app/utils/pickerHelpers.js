// Text for the rolling pickers and the buttons that open them.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "Mon, 2 Nov 2026" from "2026-11-02". Same on every browser. Empty for anything that is not a date.
export function formatIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(year, month - 1, day);
  // The Date constructor rolls an out-of-range month/day into the next one instead of
  // failing ("2026-02-30" silently becomes 2 Mar), so a mismatch here means the calendar
  // date never existed and this must read as invalid, not as whatever it rolled into.
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// "9:05 PM" (12 hour) or "21:05" (24 hour) from "21:05".
export function formatHhmm(hhmm, timeFormat = "12h") {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm ?? "");
  if (!m) return "";
  const h = Number(m[1]);
  if (timeFormat === "24h") return `${m[1]}:${m[2]}`;
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}
