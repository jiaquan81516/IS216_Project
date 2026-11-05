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
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseIso(value);
  if (Number.isNaN(date.getTime())) return false;
  // parseIso's `new Date(y, m-1, d)` rolls an out-of-range month/day into the next one
  // instead of failing ("2026-02-30" silently becomes 2 Mar), so a mismatch here means the
  // calendar date never existed and must read as invalid, not as whatever it rolled into.
  const [y, m, d] = value.split("-").map(Number);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
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

// Monday is 0, like the day schedule.
const weekdayOf = (iso) => (parseIso(iso).getDay() + 6) % 7;

// A carer (a helper, a nanny) who takes the same nights every week: { label, days: [0..6] }.
export function carerOn(store, date) {
  const day = weekdayOf(date);
  return (store.carerNights ?? []).find((c) => Array.isArray(c?.days) && c.days.includes(day)) ?? null;
}

// Which turn of the parents this night is. Carer nights don't use up a turn, so a fixed carer night
// never takes more nights off one parent than the other.
function parentTurn(store, date) {
  const n = daysBetween(store.startDate, date);
  const taken = new Set();
  for (const c of store.carerNights ?? []) for (const d of c?.days ?? []) taken.add(d);
  if (!taken.size) return n;
  const start = weekdayOf(store.startDate);
  const free = (i) => (taken.has((((start + i) % 7) + 7) % 7) ? 0 : 1);
  let count = 0;
  if (n >= 0) for (let i = 0; i < n; i += 1) count += free(i);
  else for (let i = n; i < 0; i += 1) count -= free(i);
  return count;
}

function baseNight(store, date) {
  const override = store.overrides?.[date];
  if (override === "me" || override === "partner" || override === "open") {
    return { who: override, source: "override", shared: false };
  }
  const carer = carerOn(store, date);
  if (carer) return { who: "other", label: carer.label || "Carer", source: "carer", shared: false };
  if (store.pattern === "manual") return { who: "open", source: "pattern", shared: false };
  const even = ((parentTurn(store, date) % 2) + 2) % 2 === 0;
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
      label: night.who === "other" ? night.label || "Carer" : "",
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
    carer: nights.filter((n) => n.who === "other").length,
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
      return {
        text: `Swap ${dateLabel(best.action.date)} so ${nameOf[heavy]} has one more night off`,
        short: `Swap ${weekdayShort(best.action.date)} ${dayNumber(best.action.date)} to even out the nights.`,
        action: best.action,
      };
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
        short: `${runLength} nights in a row for ${nameOf[runner].split(" ")[0]}. Swap ${weekdayShort(best.action.date)} ${dayNumber(best.action.date)} with ${weekdayShort(best.action.withDate)} ${dayNumber(best.action.withDate)}.`,
        action: best.action,
      };
    }
  }

  if (sum.open > 0) return { text: "Some nights are still open.", action: null };
  return { text: "This week is balanced.", action: null };
}

// A fair plan for a run of nights (the "suggested plan" in setup).
//
// nights    ISO dates, one per night, in order.
// carers    [{ label, days }] fixed weekly carer nights (Monday is 0). A carer night belongs to the carer: no
//           parent is on duty, so it never uses up a parent's turn and it breaks up a run of duty nights.
// early     { me: [dates], partner: [dates] }, the mornings each parent needs extra sleep. The night before
//           such a morning must not be theirs.
// firstOnDuty  "me" or "partner": who gets the odd night when the parent nights cannot split evenly.
//
// The parent nights are searched exhaustively and ranked, in this order, by:
//   1. early-start nights broken (a parent on duty the night before their own early start),
//   2. how evenly the load is shared: nights on duty, with each early start counting as a night of rest owed,
//   3. the longest run of one parent on consecutive parent nights,
//   4. the number of back-to-back nights for the same parent,
//   5. the odd night going to firstOnDuty, then who starts.
// Returns { nights, notes, counts }. `notes` lists everything the plan could not honour, in plain words.
const EARLY_WEIGHT = 1;

export function buildFairPlan({ nights = [], carers = [], early = {}, firstOnDuty = "me" } = {}) {
  const dates = nights.filter(isIsoDate);
  const wants = { me: new Set(early.me ?? []), partner: new Set(early.partner ?? []) };
  const store = { carerNights: carers };
  const first = firstOnDuty === "partner" ? "partner" : "me";

  const slots = dates.map((date) => {
    const carer = carerOn(store, date);
    const morning = addDays(date, 1);
    return { date, carer, noMe: wants.me.has(morning), noPartner: wants.partner.has(morning) };
  });
  const free = slots.map((x, i) => (x.carer ? -1 : i)).filter((i) => i >= 0);
  const planned = new Set(dates);
  const needs = {
    me: [...wants.me].filter((m) => planned.has(addDays(m, -1))).length,
    partner: [...wants.partner].filter((m) => planned.has(addDays(m, -1))).length,
  };

  const scoreOf = (pick) => {
    let broken = 0;
    let me = 0;
    let partner = 0;
    let run = 0;
    let longest = 0;
    let backToBack = 0;
    let prev = null;
    slots.forEach((slot, i) => {
      const who = slot.carer ? null : pick[i];
      if (!who) {
        run = 0;
        prev = null;
        return;
      }
      if (who === "me") me += 1;
      else partner += 1;
      if ((who === "me" && slot.noMe) || (who === "partner" && slot.noPartner)) broken += 1;
      run = who === prev ? run + 1 : 1;
      if (who === prev) backToBack += 1;
      longest = Math.max(longest, run);
      prev = who;
    });
    const odd = me === partner ? 0 : (me > partner ? "me" : "partner") === first ? 0 : 1;
    // Fairness is about rest, not only nights. Each early start is extra rest a parent is owed, so it counts as
    // a night on their side of the scale: the parent with more early starts ends up on duty fewer nights.
    const load = Math.abs(me + EARLY_WEIGHT * needs.me - (partner + EARLY_WEIGHT * needs.partner));
    return { broken, diff: Math.round(load * 100) / 100, longest, backToBack, odd, me, partner };
  };
  const rank = (a, b) => a.broken - b.broken || a.diff - b.diff || a.longest - b.longest || a.backToBack - b.backToBack || a.odd - b.odd;

  let best = null;
  const pick = {};
  const walk = (k) => {
    if (k === free.length) {
      const sc = scoreOf(pick);
      if (!best || rank(sc, best.sc) < 0) best = { sc, pick: { ...pick } };
      return;
    }
    // Try the person who would otherwise start first, so ties settle the same way every time.
    for (const who of first === "me" ? ["me", "partner"] : ["partner", "me"]) {
      pick[free[k]] = who;
      walk(k + 1);
    }
  };
  if (free.length <= 16) walk(0);
  else {
    // Far too many nights to search: alternate, skipping carer nights, and let the early starts decide.
    let turn = first;
    for (const i of free) {
      const slot = slots[i];
      let who = turn;
      if (who === "me" && slot.noMe && !slot.noPartner) who = "partner";
      else if (who === "partner" && slot.noPartner && !slot.noMe) who = "me";
      pick[i] = who;
      turn = otherOf(who);
    }
    best = { sc: scoreOf(pick), pick: { ...pick } };
  }

  const out = slots.map((slot, i) => {
    if (slot.carer) return { date: slot.date, who: "other", label: slot.carer.label || "Carer", resting: null, shared: false, source: "smart" };
    const who = best.pick[i];
    return { date: slot.date, who, label: "", resting: otherOf(who), shared: false, source: "smart" };
  });

  const notes = [];
  const label = (iso) => `${weekdayShort(iso)} ${dayNumber(iso)}`;
  const inPlan = new Set(dates);
  for (const who of ["me", "partner"]) {
    for (const morning of [...wants[who]].sort()) {
      if (!inPlan.has(addDays(morning, -1)) && inPlan.has(morning)) {
        notes.push({ kind: "outside", who, date: morning, text: `The night before ${label(morning)} is before the plan starts, so that early start is not planned for.` });
      }
    }
  }
  out.forEach((night, i) => {
    const slot = slots[i];
    if (night.who === "other") return;
    if (slot.noMe && slot.noPartner) {
      notes.push({ kind: "clash", date: addDays(night.date, 1), text: `Both of you need an early start on ${label(addDays(night.date, 1))}, so one of you is on duty the night before.` });
    } else if ((night.who === "me" && slot.noMe) || (night.who === "partner" && slot.noPartner)) {
      notes.push({ kind: "broken", who: night.who, date: addDays(night.date, 1), text: `The night before ${label(addDays(night.date, 1))} could not be kept clear.` });
    }
  });
  const counts = { me: best?.sc.me ?? 0, partner: best?.sc.partner ?? 0, carer: out.filter((n) => n.who === "other").length };
  if (Math.abs(counts.me - counts.partner) > 1) {
    notes.push({ kind: "uneven", text: "The early starts leave the nights uneven this week." });
  }
  return { nights: out, notes, counts };
}

// Remove a pending request of mine.
export function cancelSwap(swaps, id) {
  return swaps.filter((s) => !(s.id === id && s.status === "pending" && s.from === "me"));
}

// "Tiara", "Tiara and Noah", "Tiara, Noah and Mei": every baby the plan covers.
export function joinNames(names) {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}
