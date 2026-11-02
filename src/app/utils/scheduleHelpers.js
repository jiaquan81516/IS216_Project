// Pure helpers for the weekly day schedule: who looks after the baby between 6 AM and 6 PM.
// No Vue, Pinia or storage imports. A shift is { id, day, start, end, who, label } where day is
// 0 (Monday) to 6 (Sunday), start and end are minutes from midnight, and who is "me", "partner",
// "both" or "other" (label names the other person, such as a nanny). The schedule repeats every week.

export const DAY_START = 6 * 60;
export const DAY_END = 18 * 60;
const KINDS = ["me", "partner", "both", "other"];

const pad = (n) => String(n).padStart(2, "0");

// "08:30" becomes 510. Anything else becomes null.
export function toMinutes(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm ?? ""));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

// 510 becomes "08:30".
export const toHhmm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

// Monday is 0, for a Date.
export const weekdayIndex = (date) => (date.getDay() + 6) % 7;

export function makeShiftId() {
  return `sh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Keeps only well formed shifts, sorted by day and start. `who` must already be a kind.
export function cleanShifts(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const s of list) {
    const day = Number(s?.day);
    const start = typeof s?.start === "number" ? s.start : toMinutes(s?.start);
    const end = typeof s?.end === "number" ? s.end : toMinutes(s?.end);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (start === null || end === null || end <= start) continue;
    if (!KINDS.includes(s?.who)) continue;
    out.push({
      id: typeof s.id === "string" && s.id ? s.id : makeShiftId(),
      day,
      start,
      end,
      who: s.who,
      label: s.who === "other" ? String(s.label || "Someone else").slice(0, 30) : "",
    });
  }
  return out.sort((a, b) => a.day - b.day || a.start - b.start);
}

// Adds one shift on each chosen day. Whatever it covers on those days is trimmed or removed, so
// shifts never overlap. `replaceId` is the shift being edited, which goes first.
export function applyShift(list, { days, start, end, who, label = "" }, replaceId = "") {
  let next = list.filter((s) => s.id !== replaceId).map((s) => ({ ...s }));
  for (const day of days) {
    const kept = [];
    for (const s of next) {
      if (s.day !== day || s.end <= start || s.start >= end) {
        kept.push(s);
        continue;
      }
      if (s.start < start) kept.push({ ...s, end: start });
      if (s.end > end) kept.push({ ...s, id: s.start < start ? makeShiftId() : s.id, start: end });
    }
    next = kept;
    next.push({ id: makeShiftId(), day, start, end, who, label: who === "other" ? label || "Someone else" : "" });
  }
  return cleanShifts(next);
}

export const removeShift = (list, id) => list.filter((s) => s.id !== id);

// The 24 hours of one weekday as cells: null or { who, label }. An hour belongs to the shift that
// covers its middle, so a shift that ends at half past is counted for that hour.
export function coverFor(list, day) {
  return Array.from({ length: 24 }, (_, h) => {
    const mid = h * 60 + 30;
    const hit = list.find((s) => s.day === day && s.start <= mid && s.end > mid);
    return hit ? { who: hit.who, label: hit.label } : null;
  });
}

// An earlier plan stored one list of 24 cells for every day. It becomes the same shifts on all seven days.
export function fromHourCells(cells) {
  const out = [];
  if (!Array.isArray(cells)) return out;
  for (let day = 0; day < 7; day += 1) {
    let h = 0;
    while (h < 24) {
      const cell = cells[h];
      if (!cell?.who || !KINDS.includes(cell.who)) {
        h += 1;
        continue;
      }
      let end = h + 1;
      while (end < 24 && cells[end]?.who === cell.who && (cells[end].label || "") === (cell.label || "")) end += 1;
      out.push({ id: `legacy-${day}-${h}`, day, start: h * 60, end: end * 60, who: cell.who, label: cell.label || "" });
      h = end;
    }
  }
  return cleanShifts(out);
}
