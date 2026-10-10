// Pure helpers for the App sleep rota. No Vue, Pinia or storage imports.
// A "store" below is any object with { pattern, firstOnDuty, startDate, overrides, swaps }.

const DAY_MS = 86400000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function toIso(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function parseIso(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseIso(value).getTime());
}

export function addDays(iso, n) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function daysBetween(fromIso, toIsoDate) {
  const a = parseIso(fromIso);
  const b = parseIso(toIsoDate);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY_MS);
}

// Monday of the week that holds the given Date or ISO string.
export function mondayOf(value = new Date()) {
  const d = typeof value === "string" ? parseIso(value) : new Date(value);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toIso(d);
}

export const otherOf = (who) => (who === "me" ? "partner" : who === "partner" ? "me" : who);

// "Tue 14 October"
export function dateLabel(iso) {
  const d = parseIso(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function weekdayShort(iso) {
  return WEEKDAYS[parseIso(iso).getDay()];
}

export function dayNumber(iso) {
  return parseIso(iso).getDate();
}

// "14 to 20 October", or "28 October to 3 November" across months.
export function weekLabel(weekStart) {
  const a = parseIso(weekStart);
  const b = parseIso(addDays(weekStart, 6));
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} to ${b.getDate()} ${MONTHS[b.getMonth()]}`;
  return `${a.getDate()} ${MONTHS[a.getMonth()]} to ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

// "07:00" becomes "7:00 AM".
export function formatHandover(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time ?? ""));
  if (!match) return "7:00 AM";
  const h = Number(match[1]);
  if (h > 23) return "7:00 AM";
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${match[2]} ${suffix}`;
}

function baseNight(store, date) {
  const override = store.overrides?.[date];
  if (override === "me" || override === "partner" || override === "open") {
    return { who: override, source: "override", shared: false };
  }
  if (store.pattern === "manual") return { who: "open", source: "pattern", shared: false };
  const even = ((daysBetween(store.startDate, date) % 2) + 2) % 2 === 0;
  const first = store.firstOnDuty === "partner" ? "partner" : "me";
  return { who: even ? first : otherOf(first), source: "pattern", shared: store.pattern === "split" };
}

// Seven nights from weekStart. `who` is "me", "partner" or "open". For a split night `shared`
// is true and `who` is the person who takes the first half.
export function weekNights(store, weekStart) {
  const accepted = (store.swaps ?? []).filter((s) => s.status === "accepted");
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    let night = baseNight(store, date);
    for (const swap of accepted) {
      if (swap.date === date) night = { who: otherOf(swap.from), source: "swap", shared: false };
      else if (swap.withDate && swap.withDate === date) night = { who: swap.from, source: "swap", shared: false };
    }
    const single = night.who === "me" || night.who === "partner";
    return {
      date,
      who: night.who,
      resting: single && !night.shared ? otherOf(night.who) : null,
      second: night.shared ? otherOf(night.who) : null,
      shared: night.shared,
      source: night.source,
    };
  });
}

function personStats(nights, who) {
  let onDuty = 0;
  let run = 0;
  let longestRun = 0;
  for (const n of nights) {
    if (n.who === who && !n.shared) {
      onDuty += 1;
      run += 1;
      longestRun = Math.max(longestRun, run);
    } else {
      run = 0;
    }
  }
  const off = nights.filter((n) => !n.shared && n.who === otherOf(who)).length;
  return { onDuty, longestRun, off };
}

export function restSummary(nights) {
  return {
    me: personStats(nights, "me"),
    partner: personStats(nights, "partner"),
    shared: nights.filter((n) => n.shared).length,
    open: nights.filter((n) => n.who === "open").length,
  };
}

// Returns a copy of nights with one swap applied (used to score suggestions).
function simulate(nights, action) {
  return nights.map((n) => {
    if (n.date === action.date) return { ...n, who: otherOf(action.from), shared: false };
    if (action.withDate && n.date === action.withDate) return { ...n, who: action.from, shared: false };
    return n;
  });
}

function score(nights) {
  const s = restSummary(nights);
  return { diff: Math.abs(s.me.onDuty - s.partner.onDuty), run: Math.max(s.me.longestRun, s.partner.longestRun) };
}

function better(a, b) {
  return a.diff < b.diff || (a.diff === b.diff && a.run < b.run);
}

// At most one suggestion: { text, action }. action is { date, withDate, from } or null, where
// `from` gives away `date` and (when withDate is set) takes `withDate` in return.
export function suggest(nights, names = {}) {
  const nameOf = { me: names.me || "Me", partner: names.partner || "Your partner" };
  const sum = restSummary(nights);
  const diff = sum.me.onDuty - sum.partner.onDuty;

  if (Math.abs(diff) > 1) {
    const heavy = diff > 0 ? "me" : "partner";
    let best = null;
    for (const n of nights) {
      if (n.who !== heavy || n.shared) continue;
      const action = { date: n.date, withDate: null, from: heavy };
      const sc = score(simulate(nights, action));
      if (!best || better(sc, best.sc)) best = { action, sc };
    }
    if (best) {
      return { text: `Swap ${dateLabel(best.action.date)} so ${nameOf[heavy]} has one more night off`, action: best.action };
    }
  }

  const runner = sum.me.longestRun >= sum.partner.longestRun ? "me" : "partner";
  const runLength = sum[runner].longestRun;
  if (runLength >= 3) {
    // Locate the first longest run for that person.
    let start = -1;
    let len = 0;
    let bestStart = -1;
    nights.forEach((n, i) => {
      if (n.who === runner && !n.shared) {
        if (len === 0) start = i;
        len += 1;
        if (len === runLength && bestStart === -1) bestStart = start;
      } else {
        len = 0;
      }
    });
    const middle = nights[bestStart + Math.floor(runLength / 2)];
    const before = score(nights);
    let best = null;
    nights.forEach((n, i) => {
      if (n.who !== otherOf(runner) || n.shared) return;
      if (i >= bestStart && i < bestStart + runLength) return;
      const action = { date: middle.date, withDate: n.date, from: runner };
      const sc = score(simulate(nights, action));
      if (sc.run < before.run && (!best || better(sc, best.sc))) best = { action, sc };
    });
    if (best) {
      return {
        text: `${nameOf[runner]} is on duty ${runLength} nights in a row. Swap ${dateLabel(best.action.date)} with ${dateLabel(best.action.withDate)} to break the run`,
        action: best.action,
      };
    }
  }

  if (sum.open > 0) return { text: "Some nights are still open.", action: null };
  return { text: "This week is balanced.", action: null };
}

export function makeSwapId() {
  return `sw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Returns a new swaps array with one accepted swap added (the plan changes at once).
export function applySwap(swaps, { date, withDate = null, from, message = "", id } = {}) {
  return [...swaps, { id: id ?? makeSwapId(), date, withDate, from, status: "accepted", message }];
}

// Returns a new swaps array with a pending swap added.
export function addPendingSwap(swaps, { date, withDate = null, from = "me", message = "", id } = {}) {
  return [...swaps, { id: id ?? makeSwapId(), date, withDate, from, status: "pending", message }];
}

// Accept or decline a pending request that came from the partner. Other swaps are untouched.
export function resolveSwap(swaps, id, accept) {
  return swaps.map((s) =>
    s.id === id && s.status === "pending" && s.from === "partner"
      ? { ...s, status: accept ? "accepted" : "declined" }
      : s,
  );
}

// Remove a pending request of mine.
export function cancelSwap(swaps, id) {
  return swaps.filter((s) => !(s.id === id && s.status === "pending" && s.from === "me"));
}
