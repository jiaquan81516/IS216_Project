// What a carer sees on the Care Brief: who is looking after the baby today, and tonight.
// Pure helpers, no Vue or Firebase. The carer reads the same rota documents the parents save.
import { buildRotaView, tonightDate } from "./homeSummary";
import { formatHandover, weekNights, mondayOf } from "./rotaHelpers";
import { isPrimaryParent } from "./caregiverHelpers";
import { toMinutes } from "./scheduleHelpers";

const cap = (text) => {
  const word = String(text ?? "").trim().split(/\s+/)[0] || "";
  return word.charAt(0).toUpperCase() + word.slice(1);
};

// "7:30 AM"
function clock(hhmm) {
  const mins = toMinutes(hhmm);
  const h = Math.floor(mins / 60);
  const m = String(mins % 60).padStart(2, "0");
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

// settings: the rota settings document, nights: { date: { onCall } }, members: household members.
// Returns { today: [{ start, end, name, isMe }], night: { name, isMe, handover } | null }.
export function dutyForCarer({ settings, nights = {}, members = [], meUid = "", now = new Date() } = {}) {
  if (!settings) return { today: [], night: null };
  const parents = (members ?? []).filter((m) => isPrimaryParent(m));
  const nameOfUid = (uid) => {
    if (uid && uid === meUid) return "You";
    const found = (members ?? []).find((m) => m.uid === uid);
    return cap(found?.displayName) || "A parent";
  };
  const label = (who, other) => (who === "both" ? "Both parents" : who === "other" ? other || "Someone else" : nameOfUid(who));

  const dayIndex = (now.getDay() + 6) % 7;
  const today = (Array.isArray(settings.schedule) ? settings.schedule : [])
    .filter((s) => s?.day === dayIndex && s.who && /^\d{2}:\d{2}$/.test(s.start ?? "") && /^\d{2}:\d{2}$/.test(s.end ?? ""))
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    .map((s) => ({ start: clock(s.start), end: clock(s.end), name: label(s.who, s.label), isMe: s.who === meUid }));

  // The first parent is "me" for the plan helpers, the second is "partner".
  const view = buildRotaView({ rotaSettings: settings, nights, swaps: [], uid: parents[0]?.uid ?? "", now });
  const date = tonightDate(now, view.handoverTime);
  const night = weekNights(view, mondayOf(date)).find((n) => n.date === date);
  let owner = null;
  if (night && night.who !== "open") {
    if (night.who === "other") owner = { name: night.label || "Carer", isMe: Boolean(meUid) && (settings.carerNights ?? []).some((c) => c?.uid === meUid && c.label === night.label) };
    else {
      const uid = night.who === "me" ? parents[0]?.uid : parents[1]?.uid;
      owner = { name: uid ? nameOfUid(uid) : "A parent", isMe: false };
    }
  }
  // A night set by hand to the carer's own uid.
  const set = nights?.[date]?.onCall;
  if (set === meUid && meUid) owner = { name: "You", isMe: true };
  return { today, night: owner ? { ...owner, handover: formatHandover(view.handoverTime), shared: night?.shared === true } : null };
}
