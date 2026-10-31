<script setup>
import "@/app/app.css";
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { CHAT_TEXT_MAX } from "@/api/chat";
import AppButton from "@/components/ui/AppButton.vue";
import AppLink from "@/components/ui/AppLink.vue";
import CarryIcon from "@/app/components/CarryIcon.vue";
import BabyScene from "@/app/components/BabyScene.vue";
import Icon from "@/app/components/Icon.vue";
import SlideArt from "@/app/components/SlideArt.vue";
import { ownerKey, ownerLabel } from "@/app/utils/sharedHelpers";
import { agendaGroups, agendaHeading, eventTimeLabel } from "@/app/utils/calendarHelpers";
import { buildStream } from "@/app/utils/stream";
import { agoText, dutyTonight, nextUp, todaySummary, tonightDate } from "@/app/utils/homeSummary";
import { addDays, mondayOf, toIso, weekNights } from "@/app/utils/rotaHelpers";
import { isStruggling, moodStageFor } from "@/app/utils/moodStage";
import { formatMinutes, formatTime as clockTime, lastOfType, toDate } from "@/app/utils/entryHelpers";
import { babySentence, displayName, useHome, HOME_KEY } from "@/app/composables/useHome";
import { NUDGES_KEY } from "@/app/composables/useNudges";
import { useCheckinsStore } from "@/app/stores/checkins";
import { encouragementFor } from "@/app/data/encouragement";
import { MOODS } from "@/app/data/wellness";
import { SLIDES } from "@/app/data/slides";
import { useEntries, ENTRIES_KEY } from "@/app/composables/useEntries";
import { usePrefs } from "@/app/composables/usePrefs";
import { useShared, SHARED_KEY } from "@/app/composables/useShared";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "HomePage" });

// The layout loads the household, the care log and the shared stores once and provides them.
// Fall back to loading here so the page also works when rendered on its own.
const home = inject(HOME_KEY, null) ?? useHome();
const { loading, error, reload, me, partner, inviteCode, householdId } = home;
const myUid = computed(() => me.value.uid);
const partnerUid = computed(() => partner.value?.uid ?? "");
const entriesShared = inject(ENTRIES_KEY, null) ?? useEntries(householdId);
const shared = inject(SHARED_KEY, null) ?? useShared(householdId, myUid, partnerUid);
const posts = shared.posts;
const rtw = shared.rtw;
const nudgeState = inject(NUDGES_KEY, null);
const checkins = useCheckinsStore();

const router = useRouter();
const { formatTime } = usePrefs();

const now = ref(new Date());
let clock = null;
const reduceMotion = typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
const slideIndex = ref(0);
const slidesPlaying = ref(!reduceMotion);
const slidesHeld = ref(false); // the pointer or keyboard focus is on the carousel
const SLIDE_SECONDS = 7;
function goSlide(index) {
  slideIndex.value = (index + SLIDES.length) % SLIDES.length;
}
let touchX = null;
function onTouchStart(event) {
  touchX = event.touches[0]?.clientX ?? null;
}
function onTouchEnd(event) {
  if (touchX === null) return;
  const dx = (event.changedTouches[0]?.clientX ?? touchX) - touchX;
  touchX = null;
  if (Math.abs(dx) > 40) goSlide(slideIndex.value + (dx < 0 ? 1 : -1));
}
onMounted(() => {
  clock = setInterval(() => {
    now.value = new Date();
  }, 60000);
});
onBeforeUnmount(() => {
  clearInterval(clock);
});

// Names
const greeting = computed(() => {
  const hour = now.value.getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
});
const dateText = computed(() => {
  const weekday = now.value.toLocaleDateString("en-GB", { weekday: "long" });
  const month = now.value.toLocaleDateString("en-GB", { month: "long" });
  return `${weekday}, ${now.value.getDate()} ${month}`;
});
const myName = computed(() => displayName(me.value.firstName));
const partnerFirst = computed(() => (partner.value ? displayName(partner.value.firstName) : ""));
const showInvite = computed(() => !partner.value && Boolean(inviteCode.value));
const babyLine = computed(() => babySentence(home.baby.value));

// ---- How each of you is doing, from the shared check-ins ----
const latestOf = (map) => {
  let best = null;
  for (const entry of Object.values(map ?? {})) {
    const at = new Date(entry.savedAt).getTime();
    if (Number.isNaN(at)) continue;
    if (!best || at > new Date(best.savedAt).getTime()) best = entry;
  }
  return best;
};
const moodWord = (value) => MOODS.find((m) => m.value === value)?.label.toLowerCase() ?? "";

function describePerson(entry, who) {
  if (!entry) {
    return { stage: "budding", need: null, status: "No check-in yet", detail: who === "me" ? "A minute is enough." : "Nothing to read yet.", hard: false, fresh: false };
  }
  const at = new Date(entry.savedAt);
  const fresh = now.value.getTime() - at.getTime() < 24 * 3600 * 1000;
  const worked = moodStageFor(entry);
  const stage = fresh ? entry.moodStage ?? worked : "budding";
  // A check-in that was hard, and has since settled back to a bud because support was arranged.
  const settled = fresh && isStruggling(worked) && stage === "budding";
  const hard = fresh && isStruggling(stage);
  const status = !fresh ? "No check-in today" : settled ? "Support is arranged" : hard ? "Having a hard time" : `Feeling ${moodWord(entry.mood)}`;
  const load = fresh && entry.stress >= 4 ? "Carrying a lot" : fresh && entry.stress <= 2 ? "Carrying very little" : "";
  const when = fresh ? `Checked in ${agoText(at, now.value)}` : `Last check-in ${at.toLocaleDateString("en-GB", { weekday: "long" })}`;
  return { stage, need: entry.need ?? null, status, detail: [load, when].filter(Boolean).join(". ") + ".", hard, fresh };
}
const mine = computed(() => describePerson(latestOf(checkins.items), "me"));
const theirs = computed(() => describePerson(latestOf(checkins.partnerItems), "partner"));

// Tonight, 6 PM to 6 AM: who is on duty for which hours (from the sleep rota), a tick for every
// feed, and where "now" sits. Before 6 AM it is still last night's shift.
const shift = computed(() => {
  const n = now.value;
  const hour = n.getHours();
  const start = new Date(n);
  start.setHours(18, 0, 0, 0);
  if (hour < 6) start.setDate(start.getDate() - 1);
  const span = 12 * 3600 * 1000;
  const at = (date) => Math.min(100, Math.max(0, ((date.getTime() - start.getTime()) / span) * 100));
  const inNight = hour >= 18 || hour < 6;

  const nameOf = (who) => (who === "me" ? "You" : partnerFirst.value || "Your partner");
  let segments = [{ who: "open", label: "Not planned yet", from: 0, to: 100 }];
  if (rotaView.value) {
    const date = tonightDate(n, rotaView.value.handoverTime);
    const night = weekNights(rotaView.value, mondayOf(date)).find((x) => x.date === date);
    if (night && (night.who === "me" || night.who === "partner")) {
      const other = night.who === "me" ? "partner" : "me";
      segments = night.shared
        ? [
            { who: night.who, label: nameOf(night.who), from: 0, to: 50 },
            { who: other, label: nameOf(other), from: 50, to: 100 },
          ]
        : [{ who: night.who, label: `${nameOf(night.who)} on duty`, from: 0, to: 100 }];
    }
  }
  const ticks = (entriesShared.entries.value ?? [])
    .filter((e) => e.type === "feed")
    .map((e) => toDate(e.at))
    .filter((d) => d && d.getTime() >= start.getTime() && d.getTime() <= start.getTime() + span)
    .map((d) => ({ pos: at(d) }));
  const summary = segments.map((x) => x.label).join(", then ");
  return { segments, ticks, now: inNight ? at(n) : null, summary };
});

// A heads up strip, only when something deserves a word.
const strip = computed(() => {
  if (partner.value && theirs.value.hard && theirs.value.fresh) {
    return { label: "Heads up", text: `${partnerFirst.value} is having a hard time today. A short message can help.`, cta: `Reach out to ${partnerFirst.value}`, act: openChat };
  }
  if (mine.value.hard && mine.value.fresh) {
    return { label: "Be gentle", text: "You have had a hard time. You do not need to be fine, or to do it alone.", cta: "See support options", act: () => router.push(ROUTES.SUPPORT) };
  }
  if (partner.value && !mine.value.fresh && !theirs.value.fresh) {
    return { label: "Check in", text: "Neither of you has checked in yet today. A minute each is enough.", cta: "Check in now", act: () => router.push(ROUTES.WELLNESS) };
  }
  return null;
});
const quote = computed(() => encouragementFor(now.value));
const partnerAlert = computed(() => Boolean(partner.value) && theirs.value.hard && theirs.value.fresh);

// ---- Baby, today: kept small and calm, with quick ways to log ----
const QUICK_LOG = [
  { key: "feed", label: "Feed", icon: "feed" },
  { key: "nappy", label: "Nappy", icon: "diaper" },
  { key: "sleep", label: "Sleep", icon: "moon" },
];
// What the baby is doing right now, read from the care log: asleep (a sleep with no end yet), just
// fed (within 40 minutes), getting hungry (three hours since the last feed), or simply awake.
const babyName = computed(() => home.baby.value.name || "Baby");
const babyNow = computed(() => {
  const name = babyName.value;
  const list = entriesShared.entries.value ?? [];
  const sleep = lastOfType(list, "sleep");
  const sleepStart = sleep ? toDate(sleep.at) : null;
  const sleepMinutes = sleepStart ? (now.value.getTime() - sleepStart.getTime()) / 60000 : 0;
  if (sleep && sleepStart && !toDate(sleep.endedAt) && sleepMinutes >= 0 && sleepMinutes < 16 * 60) {
    return { state: "sleeping", title: `${name} is sleeping`, detail: `Since ${clockTime(sleepStart)}, ${formatMinutes(sleepMinutes)} so far` };
  }
  const fedAt = summary.value.lastFeedAt;
  const fedMinutes = fedAt ? (now.value.getTime() - fedAt.getTime()) / 60000 : null;
  if (fedMinutes !== null && fedMinutes >= 0 && fedMinutes < 40) {
    return { state: "fed", title: `${name} has just been fed`, detail: `Fed ${agoText(fedAt, now.value)}` };
  }
  if (fedMinutes !== null && fedMinutes >= 180) {
    return { state: "hungry", title: `${name} may be getting hungry`, detail: `Last fed ${agoText(fedAt, now.value)}` };
  }
  return { state: "awake", title: `${name} is awake`, detail: fedAt ? `Last fed ${agoText(fedAt, now.value)}` : "No feeds logged yet" };
});
const sleepToday = computed(() => (summary.value.sleepMinutes ? formatMinutes(summary.value.sleepMinutes) : "0 m"));

// ---- Covering tonight, through the real sleep rota ----
const fmtHour = (hour) => {
  const h24 = Math.round(hour) % 24;
  return `${h24 % 12 || 12} ${h24 >= 12 ? "PM" : "AM"}`;
};
// The hours your partner is on tonight (6 PM to 6 AM is the window), or "" when they are not on.
const coverRange = computed(() => {
  const seg = shift.value.segments.find((x) => x.who === "partner");
  return seg ? `${fmtHour(18 + seg.from * 0.12)} to ${fmtHour(18 + seg.to * 0.12)}` : "";
});
const coverOffered = computed(() => (rotaStore.value?.pending ?? []).some((x) => x.from === myUid.value && !x.date));
async function offerShift() {
  if (!rotaStore.value || !rotaView.value || coverOffered.value) return;
  sendProblem.value = "";
  const date = tonightDate(now.value, rotaView.value.handoverTime);
  const ok = await rotaStore.value.requestSwap({ date: null, withDate: date, message: "" });
  if (!ok) sendProblem.value = "That did not send. Try again in a moment.";
}
// The whole day, 6 AM to 6 AM: morning, afternoon, evening and late night, and who looks after the baby.
// Nights come from the sleep rota. The morning and afternoon come from the "Daytime cover" choice on
// the rota page, which can be a parent, both, or someone else such as a nanny or grandparent.
// Painting the day: pick who, then drag across the hours. Every hour of the 24 can be someone different.
const editorOpen = ref(false);
const CARER_LABELS = ["Nanny", "Grandma", "Grandpa", "Childcare", "Helper"];
const hourPlan = computed(() => rotaStore.value?.view.hourCover ?? Array(24).fill(null));
const paintDraft = ref(null);
const brush = ref("me");
const paintStrip = ref(null);
const brushes = computed(() => [
  { value: "me", label: "You" },
  ...(partner.value ? [{ value: "partner", label: partnerFirst.value }] : []),
  { value: "both", label: "Both of us" },
  ...CARER_LABELS.map((name) => ({ value: `other:${name}`, label: name })),
  { value: "clear", label: "Clear" },
]);
const hourName = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`;
const periodFor = (h) => (h >= 6 && h < 12 ? "Morning" : h >= 12 && h < 17 ? "Afternoon" : h >= 17 && h < 21 ? "Evening" : "Night");
const brushCell = () => {
  if (brush.value === "clear") return null;
  if (brush.value.startsWith("other:")) return { who: "other", label: brush.value.slice(6) };
  return { who: brush.value, label: "" };
};
let painting = false;
let lastIndex = null;
const indexAt = (event) => {
  const box = paintStrip.value.getBoundingClientRect();
  return Math.min(23, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * 24)));
};
function paintTo(index) {
  const from = lastIndex === null ? index : Math.min(lastIndex, index);
  const to = lastIndex === null ? index : Math.max(lastIndex, index);
  for (let i = from; i <= to; i += 1) paintDraft.value[(6 + i) % 24] = brushCell();
  lastIndex = index;
}
function startPaint(event) {
  if (event.button > 0 || !paintStrip.value) return;
  paintDraft.value = hourPlan.value.map((cell) => (cell ? { ...cell } : null));
  paintStrip.value.setPointerCapture?.(event.pointerId);
  painting = true;
  lastIndex = null;
  paintTo(indexAt(event));
}
function movePaint(event) {
  if (painting) paintTo(indexAt(event));
}
async function endPaint() {
  if (!painting) return;
  painting = false;
  lastIndex = null;
  const draft = paintDraft.value;
  await rotaStore.value?.setHourCover(draft);
  paintDraft.value = null;
}
// Start over: every painted hour goes back to the default. Asks for a second tap first.
const confirmClear = ref(false);
async function clearAllHours() {
  if (!confirmClear.value) {
    confirmClear.value = true;
    return;
  }
  confirmClear.value = false;
  await rotaStore.value?.setHourCover(Array(24).fill(null));
}
// One hour at a time from the keyboard.
async function paintOneHour(index) {
  const draft = hourPlan.value.map((cell) => (cell ? { ...cell } : null));
  draft[(6 + index) % 24] = brushCell();
  await rotaStore.value?.setHourCover(draft);
}
const roleFor = (who) => (who === "me" ? me.value.role : who === "partner" ? partner.value?.role : null) ?? null;
const dayPlan = computed(() => {
  const n = now.value;
  const anchor = new Date(n);
  if (n.getHours() < 6) anchor.setDate(anchor.getDate() - 1);
  const anchorIso = toIso(anchor);
  const start = new Date(anchor);
  start.setHours(6, 0, 0, 0);
  const span = 24 * 3600 * 1000;
  const pct = (date) => Math.min(100, Math.max(0, ((date.getTime() - start.getTime()) / span) * 100));
  const nameOf = (who) => (who === "me" ? myName.value : partnerFirst.value || "Your partner");
  const nightOf = (iso) => (rotaView.value ? weekNights(rotaView.value, mondayOf(iso)).find((x) => x.date === iso) : null);
  
  const tonight = nightOf(anchorIso);
  const nightFirst = tonight && (tonight.who === "me" || tonight.who === "partner") ? tonight.who : "open";
  const nightSecond = tonight?.shared ? (tonight.who === "me" ? "partner" : "me") : nightFirst;
  const painted = paintDraft.value ?? hourPlan.value;
  // One cell for each hour from 6 AM to 6 AM. A painted hour wins; otherwise the evening and night
  // follow the sleep rota and the day is open.
  const grid = Array.from({ length: 24 }, (_, i) => {
    const hour = (6 + i) % 24;
    const set = painted[hour];
    if (set?.who) return { who: set.who, label: set.label, hour };
    if (i >= 18) return { who: nightSecond, label: "", hour };
    if (i >= 12) return { who: nightFirst, label: "", hour };
    return { who: "open", label: "", hour };
  });
  const nameFor = (cell) => (cell.who === "open" ? "Not planned yet" : cell.who === "both" ? "Together" : cell.who === "other" ? cell.label : nameOf(cell.who));
  const parts = [];
  for (let i = 0; i < 24; i += 1) {
    const cell = grid[i];
    const prev = parts[parts.length - 1];
    if (prev && prev.who === cell.who && prev.label === cell.label) {
      prev.length += 1;
      continue;
    }
    parts.push({ who: cell.who, label: cell.label, startIndex: i, length: 1, startHour: cell.hour });
  }
  for (const x of parts) {
    const endHour = (x.startHour + x.length) % 24;
    x.key = "slot";
    x.from = (x.startIndex / 24) * 100;
    x.to = ((x.startIndex + x.length) / 24) * 100;
    x.period = periodFor(x.startHour);
    x.name = nameFor(x);
    x.initial = x.who === "open" ? "?" : x.who === "both" ? "&" : x.name.charAt(0).toUpperCase();
    x.start = hourName(x.startHour);
    x.end = hourName(endHour);
    x.time = `${x.start} to ${x.end}`;
  }
  const nowPos = pct(n);
  const current = parts.find((x) => nowPos >= x.from && nowPos < x.to) ?? parts[parts.length - 1];
  const ticks = (entriesShared.entries.value ?? [])
    .filter((e) => e.type === "feed")
    .map((e) => toDate(e.at))
    .filter((d) => d && d.getTime() >= start.getTime() && d.getTime() <= start.getTime() + span)
    .map((d) => ({ pos: pct(d) }));
  const summary = parts.map((x) => `${x.period}, ${x.name}`).join("; ");
  // Neighbouring parts with the same person become one block, so the morning and afternoon read as one stretch.
  const blocks = [];
  for (const x of parts) {
    const prev = blocks[blocks.length - 1];
    if (prev && prev.who === x.who) {
      prev.to = x.to;
      prev.end = x.end;
    } else blocks.push({ who: x.who, name: x.name, from: x.from, to: x.to, start: x.start, end: x.end });
  }
  const nowText = n.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" }).toUpperCase();
  return { parts, blocks, ticks, now: nowPos, nowText, current, summary, dayOpen: grid.slice(0, 12).every((cell) => cell.who === "open"), grid };
});
// Offers your partner has made that need your answer.
const listOpen = ref(false);
const smallThings = computed(() => incomingSwaps.value.length + waiting.value.length);
const cheerLine = computed(() => (smallThings.value === 1 ? "No rush. You've got this." : "One at a time, no rush. You've got this."));
const incomingSwaps = computed(() => (rotaStore.value?.pending ?? []).filter((x) => x.from !== myUid.value && (!x.to || x.to === myUid.value)));
function swapLine(swap) {
  const who = partnerFirst.value || "Your partner";
  if (!swap.date && swap.withDate) {
    const tonight = rotaView.value && swap.withDate === tonightDate(now.value, rotaView.value.handoverTime);
    return `${who} offers to take ${tonight ? "tonight's shift" : `the night of ${swap.withDate}`}.`;
  }
  return `${who} asked to swap nights.`;
}
async function answerSwap(swap, accept) {
  actionError.value = "";
  const ok = await rotaStore.value.respondSwap(swap.id, accept);
  if (!ok) {
    actionError.value = rotaStore.value.writeError || "That did not send. Try again in a moment.";
    return;
  }
  // Cover is arranged, so the flower settles back to a bud (never straight to a bloom).
  if (accept && !swap.date) checkins.resetStage(now.value);
}
const lede = computed(() => strip.value?.text ?? quote.value);

// ---- Who has the nights ----
const rotaStore = computed(() => shared.rota ?? null);
const rotaView = computed(() => (rotaStore.value?.settings ? rotaStore.value.view : null));
const dutyReady = computed(() => !rotaStore.value || (!rotaStore.value.loading && !rotaStore.value.error));
const members = computed(() => {
  const list = [{ uid: me.value.uid, displayName: me.value.displayName || me.value.firstName }];
  if (partner.value) list.push({ uid: partner.value.uid, displayName: partner.value.displayName || partner.value.firstName });
  return list;
});
const duty = computed(() => {
  const rota = rotaStore.value;
  const hasRota = Boolean(rota?.settings);
  return dutyTonight({
    rotaSettings: hasRota ? rota.settings : null,
    view: hasRota ? rota.view : null,
    now: now.value,
    uid: myUid.value,
    members: members.value,
  });
});
// ---- Reaching your partner, in one tap ----
const sent = ref({});
const sendProblem = ref("");
async function sendToPartner(key, text, kind = "text") {
  if (!nudgeState || sent.value[key]) return;
  sendProblem.value = "";
  const ok = await nudgeState.send(text, kind);
  if (ok) sent.value = { ...sent.value, [key]: true };
  else sendProblem.value = "That did not send. Try again in a moment.";
}
const openChat = () => nudgeState?.openChat();

// ---- A letter to your partner. It goes into the chat, and the chat opens so you see it arrive. ----
// Until your partner has joined there is nobody to send it to, so it is kept as a draft on this
// device and is waiting in the box when they arrive.
const DRAFT_KEY = "nt.app.letter-draft";
const draftKey = computed(() => `${DRAFT_KEY}:${myUid.value || "anon"}`);
function readDraft() {
  try {
    return localStorage.getItem(draftKey.value) ?? "";
  } catch {
    return "";
  }
}
function writeDraft(value) {
  try {
    if (value) localStorage.setItem(draftKey.value, value);
    else localStorage.removeItem(draftKey.value);
  } catch {
    // Storage can be blocked. The letter then only lasts for this page view.
  }
}
const letter = ref(readDraft());
const letterSending = ref(false);
const letterSent = ref(false);
const draftSaved = ref(false);
const letterBox = ref(null);
const STARTERS = ["Thank you for", "I am proud of you for", "I could use"];
function startLetter(starter) {
  letterSent.value = false;
  draftSaved.value = false;
  const current = letter.value.trim();
  letter.value = current ? `${current} ${starter} ` : `${starter} `;
  writeDraft(letter.value);
  nextTick(() => letterBox.value?.focus());
}
function onLetterInput() {
  letterSent.value = false;
  draftSaved.value = false;
  writeDraft(letter.value);
}
async function sendLetter() {
  const body = letter.value.trim();
  if (!body || letterSending.value) return;
  if (!partner.value || !nudgeState) {
    writeDraft(body);
    draftSaved.value = true;
    return;
  }
  letterSending.value = true;
  sendProblem.value = "";
  const ok = await nudgeState.send(body, "text");
  letterSending.value = false;
  if (ok) {
    letter.value = "";
    writeDraft("");
    letterSent.value = true;
    nudgeState.openChat();
  } else {
    sendProblem.value = "That did not send. Try again in a moment.";
  }
}

// ---- The baby, kept small ----
const entriesFailed = computed(() => Boolean(entriesShared.error?.value));
const summary = computed(() => todaySummary({ entries: entriesShared.entries.value, now: now.value }));
const lastFeed = computed(() =>
  summary.value.lastFeedAt ? `${clockTime(summary.value.lastFeedAt)}, ${agoText(summary.value.lastFeedAt, now.value)}` : "",
);
const upNext = computed(() =>
  nextUp({
    events: shared.calendar?.events ?? [],
    tasks: rtw.tasks,
    handoverTime: rotaStore.value?.settings ? rotaStore.value.view.handoverTime : null,
    now: now.value,
  }),
);

// The next few things on the shared calendar and open tasks with a due date, soonest first.
const KIND_LABEL = { appointment: "Appointment", family: "Family", work: "Work", task: "Task" };
const kindClass = (kind) => `hp__kind--${String(kind).toLowerCase()}`;
const coming = computed(() => {
  const todayIso = toIso(now.value);
  const rows = [];
  for (const group of agendaGroups(shared.calendar?.events ?? [], todayIso)) {
    for (const event of group.events) {
      rows.push({ key: `e${group.date}${event.id ?? event.title}`, iso: group.date, title: event.title, time: eventTimeLabel(event), owner: ownerLabel(event.owner, myUid.value, myName.value, partnerFirst.value), who: ownerKey(event.owner, myUid.value), kind: KIND_LABEL[event.type] ?? "Plan" });
    }
  }
  for (const task of rtw.tasks ?? []) {
    if (task.done || !/^\d{4}-\d{2}-\d{2}$/.test(task.due ?? "") || task.due < todayIso) continue;
    rows.push({ key: `t${task.id ?? task.title}`, iso: task.due, title: task.title, time: "", owner: ownerLabel(task.owner, myUid.value, myName.value, partnerFirst.value), who: ownerKey(task.owner, myUid.value), kind: KIND_LABEL.task });
  }
  rows.sort((x, y) => (x.iso < y.iso ? -1 : x.iso > y.iso ? 1 : 0));
  // Placeholder plans, shown only while nothing real is planned, so the layout can be judged.
  const sample = rows.length === 0;
  if (sample) {
    const named = partnerFirst.value || "Your partner";
    rows.push(
      { key: "s1", iso: todayIso, title: "Health visitor home check", time: "2:30 PM", owner: "Both", who: "both", kind: KIND_LABEL.appointment },
      { key: "s2", iso: addDays(todayIso, 1), title: "Pick up the car seat", time: "", owner: named, who: "partner", kind: KIND_LABEL.task },
      { key: "s3", iso: addDays(todayIso, 3), title: "Dinner at grandma's", time: "6:00 PM", owner: "Both", who: "both", kind: KIND_LABEL.family },
      { key: "s4", iso: addDays(todayIso, 6), title: "Six week check-up", time: "10:30 AM", owner: myName.value, who: "me", kind: KIND_LABEL.appointment },
    );
  }
  return rows.slice(0, 4).map((row) => {
    const date = new Date(`${row.iso}T00:00:00`);
    const heading = agendaHeading(row.iso, todayIso);
    return { ...row, sample, month: date.toLocaleDateString("en-GB", { month: "short" }), weekday: date.toLocaleDateString("en-GB", { weekday: "short" }), day: date.getDate(), when: heading === "Today" || heading === "Tomorrow" ? heading : date.toLocaleDateString("en-GB", { day: "numeric", month: "long" }), soon: heading === "Today" };
  });
});

// Setup messages about database rules are for the team, never for a parent. Anything that mentions them
// is replaced with a neutral line before it reaches the screen.
const friendly = (text) => (/firestore\.rules|database rules/i.test(text ?? "") ? "That is not available right now. Please try again later." : text);

// ---- The stream, tucked away ----
const items = computed(() =>
  buildStream({
    posts: posts.posts,
    entries: entriesShared.entries.value,
    tasks: rtw.tasks,
    uid: myUid.value,
    members: members.value,
    now: now.value,
  }),
);
const streamLoading = computed(() => !householdId.value || posts.loading || entriesShared.loading.value);
const streamError = computed(() => posts.errorInfo);
const recent = computed(() => items.value.slice(0, 3));
// What needs an answer from you: partner notes to acknowledge, and open tasks that are yours.
const waiting = computed(() =>
  items.value.filter(
    (item) =>
      (item.kind === "message" && item.needsAck && !item.acked) ||
      (item.kind === "task" && !item.done && (item.meta?.owner === myUid.value || item.meta?.owner === "both")),
  ),
);

function metaLine(item) {
  const who = `${item.authorName}, ${formatTime(item.at)}`;
  return item.kindLabel ? `${who} · ${item.kindLabel}` : who;
}
function seenLine(item) {
  return item.ackedByNames.length ? `Seen by ${item.ackedByNames.join(" and ")}` : "";
}

// ---- Notes and tasks ----
const announcement = ref("");

function announce(message) {
  announcement.value = "";
  nextTick(() => {
    announcement.value = message;
  });
}

const actionError = ref("");
async function gotIt(item) {
  actionError.value = "";
  if (!(await posts.ack(item.rawId))) actionError.value = posts.writeError;
}
async function markDone(item) {
  actionError.value = "";
  if (!(await rtw.toggleTask(item.rawId))) actionError.value = rtw.writeError;
}
async function removePost(item) {
  actionError.value = "";
  if (await posts.remove(item.rawId)) announce("Message deleted");
  else actionError.value = posts.writeError;
}

const copied = ref(false);
let copiedTimer = null;
async function copyCode() {
  try {
    await navigator.clipboard.writeText(inviteCode.value);
    copied.value = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Clipboard can be blocked; the code stays visible to copy by hand.
  }
}
onBeforeUnmount(() => clearTimeout(copiedTimer));
</script>

<template>
  <div class="hp">
    <div class="hp__live" aria-live="polite">
      <p v-if="loading" class="hp__status">Loading your household...</p>
    </div>

    <div v-if="!loading && error" class="hp__error" role="alert">
      <p>{{ error }}</p>
      <AppButton variant="outline" size="sm" @click="reload">Try again</AppButton>
    </div>

    <template v-if="!loading && !error">
      <!-- Words for new parents: one full-bleed photograph at a time, with the quote laid over it -->
      <section
        class="hp__car"
        aria-roledescription="carousel"
        aria-label="Words for new parents"
        @mouseenter="slidesHeld = true"
        @mouseleave="slidesHeld = false"
        @focusin="slidesHeld = true"
        @focusout="slidesHeld = false"
        @keydown.left.prevent="goSlide(slideIndex - 1)"
        @keydown.right.prevent="goSlide(slideIndex + 1)"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <div class="hp__car-stage" :aria-live="slidesPlaying ? 'off' : 'polite'">
          <div
            v-for="(slide, i) in SLIDES"
            :key="slide.id"
            class="hp__car-slide"
            :class="{ 'is-active': i === slideIndex }"
            role="group"
            aria-roledescription="slide"
            :aria-label="`${i + 1} of ${SLIDES.length}`"
            :aria-hidden="i === slideIndex ? 'false' : 'true'"
          >
            <img v-if="slide.image" class="hp__car-photo" :src="slide.image" :alt="slide.alt" :style="{ objectPosition: slide.pos }" :loading="i === 0 ? 'eager' : 'lazy'" />
            <SlideArt v-else :art="slide.art" />
            <div class="hp__car-copy">
              <p class="hp__car-label">{{ slide.label }}</p>
              <blockquote class="hp__car-text">{{ slide.text }}</blockquote>
            </div>
            <a v-if="slide.credit" class="hp__car-credit" :href="slide.credit.url" target="_blank" rel="noopener noreferrer" :tabindex="i === slideIndex ? 0 : -1">Photo: {{ slide.credit.by }} · {{ slide.credit.license }}</a>
          </div>
        </div>

        <!-- Progress along the bottom edge: one thin line per slide, and a quiet pause button -->
        <div class="hp__car-nav">
          <div class="hp__car-ticks" role="group" aria-label="Choose a slide">
            <button v-for="(slide, i) in SLIDES" :key="slide.id" type="button" class="hp__tick-btn" :class="{ 'is-active': i === slideIndex }" :aria-label="`Go to slide ${i + 1}`" :aria-current="i === slideIndex ? 'true' : undefined" @click="goSlide(i)">
              <span class="hp__tick-line">
                <span
                  v-if="i === slideIndex"
                  :key="slideIndex"
                  class="hp__tick-fill"
                  :class="{ 'is-held': slidesHeld || !slidesPlaying }"
                  :style="{ animationDuration: `${SLIDE_SECONDS}s` }"
                  @animationend="goSlide(slideIndex + 1)"
                ></span>
              </span>
            </button>
          </div>
          <button type="button" class="hp__car-pause" :aria-label="slidesPlaying ? 'Pause the slideshow' : 'Play the slideshow'" :aria-pressed="slidesPlaying ? 'false' : 'true'" @click="slidesPlaying = !slidesPlaying">
            <svg v-if="slidesPlaying" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="2.5" y="1.5" width="3" height="11" rx="1" /><rect x="8.5" y="1.5" width="3" height="11" rx="1" /></svg>
            <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M3.5 1.8v10.4L12 7z" /></svg>
          </button>
        </div>
      </section>
      <header class="hp__head">
        <div class="hp__head-text">
          <h1 class="hp__title">Good {{ greeting }}, {{ partnerFirst ? `${myName} and ${partnerFirst}` : myName }}.</h1>
          <p class="hp__lead">{{ lede }}</p>
        </div>
        <!-- Top right: your checklist, and the bell for messages and prompts -->
        <div class="hp__head-tools">
          <!-- Your list: a house with a speech bubble. Tap the bubble to open the to-dos. -->
          <article v-if="smallThings" class="hp__open hp__list" aria-labelledby="hp-wait-title">
            <div class="hp__house-row">
              <svg class="hp__house" viewBox="0 0 120 112" fill="none" aria-hidden="true" focusable="false">
                <rect x="8" y="104" width="104" height="4" rx="2" fill="#1f3a68" opacity="0.18" />
                <rect x="22" y="48" width="76" height="56" rx="3" fill="#fbf3e6" stroke="#1f3a68" stroke-width="2.5" />
                <path d="M12 52 L60 10 L108 52 Z" fill="#1f3a68" stroke="#1f3a68" stroke-width="2.5" stroke-linejoin="round" />
                <rect x="84" y="20" width="11" height="22" fill="#1f3a68" stroke="#1f3a68" stroke-width="2" />
                <rect x="49" y="70" width="22" height="34" rx="3" fill="#b5532f" stroke="#1f3a68" stroke-width="2.5" />
                <circle cx="66" cy="88" r="1.8" fill="#fbf3e6" />
                <rect x="30" y="62" width="14" height="14" rx="2" fill="#cfe0f3" stroke="#1f3a68" stroke-width="2" />
                <rect x="76" y="62" width="14" height="14" rx="2" fill="#cfe0f3" stroke="#1f3a68" stroke-width="2" />
                <path d="M37 62 V76 M30 69 H44 M83 62 V76 M76 69 H90" stroke="#1f3a68" stroke-width="1.4" />
              </svg>
              <button type="button" class="hp__bubble" :aria-expanded="listOpen ? 'true' : 'false'" aria-controls="hp-list-panel" @click="listOpen = !listOpen">
                <span class="hp__bubble-count" aria-hidden="true">{{ smallThings }}</span>
                <span class="hp__bubble-text">
                  <span class="hp__label">Your checklist</span>
                  <span id="hp-wait-title" class="hp__bubble-title">Important things on my checklist</span>
                  <span class="visually-hidden">{{ smallThings }} {{ smallThings === 1 ? "item" : "items" }}.</span>
                </span>
                <svg class="hp__bubble-chev" :class="{ 'is-open': listOpen }" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7l5 5 5-5" /></svg>
              </button>
            </div>
            <div v-if="listOpen" id="hp-list-panel" class="hp__list-panel">
              <p class="hp__small">{{ cheerLine }}</p>
              <ul class="hp__todo-list">
                <li v-for="swap in incomingSwaps" :key="swap.id" class="hp__todo">
                  <div class="hp__todo-text">
                    <p class="hp__text">{{ swapLine(swap) }}</p>
                    <p class="hp__small">Sleep rota</p>
                  </div>
                  <div class="hp__action">
                    <button type="button" class="hp__btn hp__btn--primary" @click="answerSwap(swap, true)">Say yes</button>
                    <button type="button" class="hp__link hp__link--sm" @click="answerSwap(swap, false)">Not tonight</button>
                  </div>
                </li>
                <li v-for="item in waiting" :key="item.id" class="hp__todo">
                  <button type="button" class="hp__check" :aria-label="item.kind === 'message' ? `Got it: ${item.text}` : `Done: ${item.text}`" @click="item.kind === 'message' ? gotIt(item) : markDone(item)">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>
                  </button>
                  <div class="hp__todo-text">
                    <p class="hp__text">{{ item.text }}</p>
                    <p class="hp__small">{{ metaLine(item) }}</p>
                  </div>
                  <span class="hp__todo-hint">{{ item.kind === "message" ? "Tap to say got it" : "Tap when done" }}</span>
                </li>
              </ul>
            </div>
          </article>
          <button type="button" class="hp__bell" :aria-label="nudgeState?.unread ? `Notifications, ${nudgeState.unread} new` : 'Notifications'" @click="openChat">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
            <span v-if="nudgeState?.unread" class="hp__bell-badge" aria-hidden="true">{{ nudgeState.unread > 9 ? "9+" : nudgeState.unread }}</span>
          </button>
        </div>
      </header>

      <!-- The next thing coming up, kept short and near the top -->
      <section v-if="coming.length" class="hp__remind" aria-label="Next up">
        <span class="hp__remind-bell" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
        </span>
        <p class="hp__remind-text">
          <span class="hp__label">Next up</span>
          <strong>{{ coming[0].when }}<template v-if="coming[0].time">, {{ coming[0].time }}</template></strong>
          <span class="hp__remind-title">{{ coming[0].title }}</span>
        </p>
        <span class="hp__kind" :class="kindClass(coming[0].kind)">{{ coming[0].kind }}</span>
        <span class="hp__who2"><i class="hp__who2-dots" :class="`hp__who2-dots--${coming[0].who}`" aria-hidden="true"></i>{{ coming[0].owner }}</span>
        <span v-if="coming[0].sample" class="hp__remind-sample">Sample</span>
        <AppLink class="hp__link hp__link--sm hp__remind-link" :to="ROUTES.CALENDAR">Open the calendar</AppLink>
      </section>

      <!-- Row one: the daily check-in on the left, the carousel and tonight on the right -->
      <section class="hp__layout" aria-label="Today">
        <div class="hp__lcol">
          <!-- The two of you -->
          <article class="hp__open hp__us" aria-labelledby="hp-us-title">
            <!-- Section two: a note on cream paper -->
                    <form class="hp__noteform" aria-labelledby="hp-letter-title" @submit.prevent="sendLetter">
              <span class="hp__stamp" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" /></svg></span>
            <header class="hp__card-head">
              <div>
                <p class="hp__label">A note for {{ partnerFirst || "your partner" }}</p>
                <h2 id="hp-letter-title" class="hp__card-title">Dear {{ partnerFirst || "my love" }},</h2>
              </div>
            </header>
            <p class="visually-hidden">{{ dateText }}</p>
            <label class="visually-hidden" for="hp-letter-box">A note for {{ partnerFirst || "your partner" }}</label>
            <textarea
              id="hp-letter-box"
              ref="letterBox"
              v-model="letter"
              class="hp__note-box"
              rows="3"
              :maxlength="CHAT_TEXT_MAX"
              placeholder="Say something kind, or something you need."
              @input="onLetterInput"
            ></textarea>
            <p class="hp__starts">
              <span>Start with:</span>
              <button v-for="st in STARTERS" :key="st" type="button" class="hp__starter" @click="startLetter(st)">{{ st }}</button>
            </p>
            <footer class="hp__note-foot">
              <button type="submit" class="hp__btn hp__btn--primary" :disabled="!letter.trim() || letterSending">
                {{ letterSending ? "Sending..." : partner ? `Send to ${partnerFirst}` : "Save my draft" }}
              </button>
              <span class="hp__count" :class="{ 'is-near': letter.length > CHAT_TEXT_MAX - 20 }">{{ letter.length }} / {{ CHAT_TEXT_MAX }}</span>
            </footer>
            <p class="hp__small" role="status" aria-live="polite">
              <template v-if="partner">
                <template v-if="letterSent">Sent. It is waiting for {{ partnerFirst }} in the chat. </template>
                <button type="button" class="hp__link" @click="openChat">{{ letterSent ? "Open the chat" : "Replies arrive in the chat" }}</button>
              </template>
              <template v-else>
                {{ draftSaved ? "Draft saved on this device." : "Your partner has not joined yet." }}
                <template v-if="showInvite"> Invite them with code <strong>{{ inviteCode }}</strong> and you can send this.</template>
              </template>
            </p>
          </form>
            <!-- Section one: how each of you is doing -->
            <div class="hp__window">
            <div class="hp__two">
              <div class="hp__two-body">
                <header class="hp__card-head">
                  <div>
                    <p class="hp__label">Daily check-in</p>
                    <h2 id="hp-us-title" class="hp__card-title">{{ partnerAlert ? `${partnerFirst} is having a hard time` : "How you are both doing" }}</h2>
                  </div>
                </header>
                <div class="hp__garden">
                  <section class="hp__plant" :class="[`hp__plant--${mine.stage}`, { 'is-attention': mine.hard }]" aria-label="You">
                    <p class="hp__plant-name">You</p>
                    <span class="hp__avatar" :class="`hp__avatar--${mine.stage}`" aria-hidden="true">{{ (myName || "Y").charAt(0).toUpperCase() }}</span>
                    <div class="hp__plant-text">
                      <p class="hp__name">{{ mine.status }}</p>
                      <p class="hp__small">{{ mine.detail }}</p>
                      <AppLink v-if="!mine.fresh" class="hp__link hp__link--sm" :to="ROUTES.WELLNESS">Check in now</AppLink>
                      <AppLink v-else-if="mine.hard" class="hp__link hp__link--sm" :to="ROUTES.SUPPORT">Support options</AppLink>
                    </div>
                  </section>
                  <section v-if="partner" class="hp__plant" :class="[`hp__plant--${theirs.stage}`, { 'is-attention': theirs.hard }]" :aria-label="partnerFirst">
                    <p class="hp__plant-name">{{ partnerFirst }}</p>
                    <span class="hp__avatar hp__avatar--partner" :class="`hp__avatar--${theirs.stage}`" aria-hidden="true">{{ (partnerFirst || "P").charAt(0).toUpperCase() }}</span>
                    <div class="hp__plant-text">
                      <p class="hp__name">{{ theirs.status }}</p>
                      <p class="hp__small">{{ theirs.detail }}</p>
                    </div>
                  </section>
                  <section v-else class="hp__plant" aria-label="Your partner">
                    <p class="hp__plant-name">Your partner</p>
                    <span class="hp__avatar hp__avatar--empty" aria-hidden="true">?</span>
                    <div class="hp__plant-text">
                      <p class="hp__name">Not here yet</p>
                      <p class="hp__small"><template v-if="showInvite">Share this code: <strong>{{ inviteCode }}</strong></template></p>
                    </div>
                  </section>
                </div>
                <p v-if="sendProblem" class="hp__problem" role="alert">{{ sendProblem }}</p>
                <!-- The action follows how your partner is, and its weight follows the stakes: a plain link, an outline, a warm thank you, or the main button -->
                <div class="hp__action">
                  <template v-if="partner">
                    <button v-if="theirs.hard && theirs.need === 'coverTonight' && coverRange" type="button" class="hp__btn hp__btn--primary" :disabled="coverOffered" @click="offerShift">
                      {{ coverOffered ? `Offer sent. Waiting for ${partnerFirst}` : `Offer to take tonight's shift, ${coverRange}` }}
                    </button>
                    <button v-else-if="theirs.hard" type="button" class="hp__btn hp__btn--outline" @click="openChat">Send a note to {{ partnerFirst }}</button>
                    <button v-else-if="theirs.fresh" type="button" class="hp__btn hp__btn--warm" :disabled="sent.thanks" @click="sendToPartner('thanks', 'Thank you for everything you did today.', 'thanks')">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                      {{ sent.thanks ? "Thank you sent" : `Say thank you to ${partnerFirst}` }}
                    </button>
                    <button v-else type="button" class="hp__link" :disabled="sent.nudge" @click="sendToPartner('nudge', 'Whenever you have a minute, could you check in? It only takes a moment.')">
                      {{ sent.nudge ? "Nudge sent" : `Nudge ${partnerFirst} to check in` }}
                    </button>
                  </template>
                  <button v-else-if="showInvite" type="button" class="hp__btn hp__btn--primary" @click="copyCode">{{ copied ? "Copied" : "Copy invite code" }}</button>
                </div>
              </div>
            </div>
            </div>
</article>
        </div>
        <div class="hp__rcol">
          <div class="hp__rtop">
            <!-- Tonight: who is on, hour by hour -->
            <article v-if="dutyReady" class="hp__card hp__tonight" aria-labelledby="hp-tonight-title">
              <header class="hp__card-head">
                <div>
                  <p class="hp__label">Today</p>
                  <h2 id="hp-tonight-title" class="hp__card-title">{{ duty.title }}</h2>
                </div>
                <div class="hp__tonight-actions">
                  <button type="button" class="hp__chip hp__chip--plan" :aria-expanded="editorOpen ? 'true' : 'false'" @click="editorOpen = !editorOpen">{{ editorOpen ? "Close" : "Plan the hours" }}</button>
                  <AppLink class="hp__link hp__link--sm" :to="ROUTES.ROTA">Open the sleep rota</AppLink>
                </div>
              </header>
              <p class="hp__incharge">Right now, <strong>{{ dayPlan.current.who === "open" ? "no one is planned yet" : dayPlan.current.who === "both" ? "you are both in charge" : `${dayPlan.current.name} is in charge` }}</strong>.</p>
              <ol class="hp__slots" :style="{ '--n': dayPlan.parts.length }" :aria-label="`Today, 6 AM to 6 AM: ${dayPlan.summary}.`">
                <li v-for="(part, i) in dayPlan.parts" :key="i" class="hp__slot" :class="[`hp__slot--${part.who}`, { 'is-current': part === dayPlan.current }]">
                  <span class="hp__slot-pic" aria-hidden="true">
                    <CarryIcon v-if="part.who === 'me' || part.who === 'partner' || part.who === 'other'" :role="part.who === 'other' ? 'carer' : roleFor(part.who)" :who="part.who" :size="38" />
                    <i v-else>{{ part.who === "both" ? "&" : "?" }}</i>
                  </span>
                  <span class="hp__slot-period">{{ part.period }}</span>
                  <span class="hp__slot-name">{{ part.name }}</span>
                  <span class="hp__slot-time">{{ part.time }}</span>
                  <span v-if="part === dayPlan.current" class="hp__slot-now">Now, {{ dayPlan.nowText }}</span>
                  <button v-if="part.key" type="button" class="hp__slot-edit" :aria-expanded="editorOpen ? 'true' : 'false'" @click="editorOpen = !editorOpen">{{ part.who === "open" ? "Set who" : "Change" }}</button>
                </li>
              </ol>
              <div v-if="editorOpen" class="hp__cover" role="group" aria-label="Plan who looks after the baby, hour by hour">
                <p class="hp__cover-title">Pick who, then drag across the hours.</p>
                <div class="hp__chips" role="radiogroup" aria-label="Who">
                  <button v-for="b in brushes" :key="b.value" type="button" role="radio" class="hp__chip" :class="[{ 'is-on': brush === b.value }, `hp__chip--${b.value.split(':')[0]}`]" :aria-checked="brush === b.value ? 'true' : 'false'" @click="brush = b.value">{{ b.label }}</button>
                </div>
                <div class="hp__paint">
                  <div ref="paintStrip" class="hp__strip2" role="group" aria-label="Hours of the day, 6 AM to 6 AM. Drag to paint, or press Enter on an hour." @pointerdown.prevent="startPaint" @pointermove="movePaint" @pointerup="endPaint" @pointercancel="endPaint">
                    <button v-for="(cell, i) in dayPlan.grid" :key="i" type="button" class="hp__hour" :class="`hp__hour--${cell.who}`" :aria-label="`${hourName(cell.hour)}, ${cell.who === 'open' ? 'not planned' : cell.who === 'both' ? 'both of you' : cell.who === 'other' ? cell.label : cell.who === 'me' ? 'you' : partnerFirst}`" @keydown.enter.prevent="paintOneHour(i)" @keydown.space.prevent="paintOneHour(i)"></button>
                    <span class="hp__paint-now" :style="{ left: `${dayPlan.now}%` }" aria-hidden="true"></span>
                  </div>
                  <div class="hp__paint-hours" aria-hidden="true"><span v-for="(label, i) in ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM', '3 AM', '6 AM']" :key="i" :style="{ left: `${i * 12.5}%` }">{{ label }}</span></div>
                </div>
                <div class="hp__cover-foot">
                  <p class="hp__small">Evening and night follow the sleep rota until you paint over them.</p>
                  <span class="hp__cover-actions">
                    <button type="button" class="hp__link hp__link--sm" @click="clearAllHours">{{ confirmClear ? "Tap again to clear every hour" : "Clear all hours" }}</button>
                    <button type="button" class="hp__link hp__link--sm" @click="editorOpen = false; confirmClear = false">Done</button>
                  </span>
                </div>
                <p v-if="rotaStore?.writeError" class="hp__problem" role="alert">{{ friendly(rotaStore.writeError) }}</p>
              </div>
              <p v-else-if="dayPlan.dayOpen" class="hp__rule">Tap "Set who" to say who looks after the baby, and when.</p>
              <p class="hp__small">{{ duty.line }}</p>
            </article>
          <!-- Lately -->
          <article class="hp__card hp__trio-card hp__trio-card--log" aria-labelledby="hp-recent-title">
            <header class="hp__card-head">
              <div>
                <p class="hp__label">Activity</p>
                <h2 id="hp-recent-title" class="hp__card-title">Lately</h2>
              </div>
              <AppLink class="hp__link hp__link--sm" :to="ROUTES.CARE_LOG">Care log</AppLink>
            </header>
            <p v-if="streamLoading" class="hp__small">Loading...</p>
            <div v-else-if="streamError" role="alert">
              <p class="hp__small">{{ friendly(streamError.text) }}</p>
              <p v-if="streamError.detail && !/firestore\.rules|database rules/i.test(streamError.detail)" class="hp__small">{{ streamError.detail }}</p>
            </div>
            <p v-else-if="!recent.length" class="hp__small">Nothing here yet. Leave a note or log something.</p>
            <ul v-else class="hp__lines">
              <li v-for="item in recent" :key="item.id" class="hp__line hp__line--time">
                <p class="hp__small">{{ formatTime(item.at) }}</p>
                <p class="hp__text"><strong>{{ item.isMine ? "You" : item.authorName }}</strong> {{ item.text }}<template v-if="seenLine(item)"> <span class="hp__small">· {{ seenLine(item) }}</span></template></p>
                <button v-if="item.kind === 'message' && item.isMine" type="button" class="hp__link hp__link--quiet" @click="removePost(item)">Delete</button>
              </li>
            </ul>
          </article>
          </div>
          <!-- Coming up: the next few things on the shared calendar and task list -->
          <section v-if="coming.length > 1" class="hp__coming" aria-labelledby="hp-coming-title">
            <header class="hp__card-head hp__coming-head">
              <div>
                <p class="hp__label">Coming up</p>
                <h2 id="hp-coming-title" class="hp__card-title">After that</h2>
              </div>
              <AppLink class="hp__link hp__link--sm" :to="ROUTES.CALENDAR">Open the calendar</AppLink>
            </header>
            <div class="hp__coming-grid">
              <ol class="hp__after" aria-label="After that">
                <li v-for="row in coming.slice(1)" :key="row.key" class="hp__after-row">
                  <span class="hp__leaf" aria-hidden="true"><i>{{ row.month }}</i><b>{{ row.day }}</b><small>{{ row.weekday }}</small></span>
                  <span class="visually-hidden">{{ row.when }}, {{ row.weekday }}<template v-if="row.time">, {{ row.time }}</template>.</span>
                  <span class="hp__after-body">
                    <span class="hp__after-title">{{ row.title }}</span>
                    <span class="hp__after-meta"><span v-if="row.time" class="hp__after-time">{{ row.time }}</span><span class="hp__kind" :class="kindClass(row.kind)">{{ row.kind }}</span><span class="hp__who2"><i class="hp__who2-dots" :class="`hp__who2-dots--${row.who}`" aria-hidden="true"></i>{{ row.owner }}</span></span>
                  </span>
                </li>
              </ol>
            </div>
          </section>
        </div>
      </section>

      <section class="hp__trio" aria-label="Everyday">
        <!-- Baby, today -->
        <article class="hp__card hp__trio-card hp__trio-card--baby" aria-labelledby="hp-baby-title">
          <BabyScene on-dark :state="babyNow.state" :title="babyNow.title" :detail="babyNow.detail" title-id="hp-baby-title" />
          <ul v-if="!entriesFailed" class="hp__tally">
            <li><b>{{ summary.feeds }}</b><span>feeds</span></li>
            <li><b>{{ summary.nappies }}</b><span>nappies</span></li>
            <li><b>{{ sleepToday }}</b><span>sleep</span></li>
          </ul>
          <div class="hp__quicklog">
            <AppLink v-for="q in QUICK_LOG" :key="q.key" class="hp__qbtn" :to="{ path: ROUTES.CARE_LOG, query: { log: q.key } }">
              <Icon :name="q.icon" :size="18" />{{ q.label }}
            </AppLink>
          </div>
        </article>

      </section>

      <footer class="hp__baby">
        <strong v-if="babyLine">{{ babyLine }}.</strong>
        <template v-if="!entriesFailed && lastFeed"> Last feed {{ lastFeed }}.</template>
        <template v-if="upNext"> Next: {{ upNext.title }}, {{ upNext.when }}.</template>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.hp {
  /* Colour: navy leads, terracotta marks what needs you, and each card has its own soft colour field
     (sage, powder, peach, butter, rose, lilac, mint) so the page has life. Space is one scale: 8 16 24 32
     48 64 96. Type is two faces on one scale: Young Serif for headlines and feeling, Inter for the rest. */
  --ink: #16233b;
  --muted: #55627a;
  --navy: #1f3a68;
  --navy-soft: rgb(31 58 104 / 14%);
  --warm: #b5532f;
  --warm-soft: #f6d8c6;
  --card: #fbfcff;
  --line: rgb(31 58 104 / 14%);
  --s1: 8px; --s2: 16px; --s3: 24px; --s4: 32px; --s5: 48px; --s6: 64px; --s7: 96px;
  --serif: "Literata", Georgia, serif;
  display: flex; flex-direction: column; gap: var(--s5); width: 100%; max-width: 1320px; margin: 0 auto; font-size: 1rem; line-height: 1.5; color: var(--ink);
}
.hp__live { position: absolute; }
.hp__status { margin: 0; font-size: 0.875rem; color: #c3cfe4; }
.hp__error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s2); padding: var(--s2) var(--s3); background: #fbe3da; border-radius: 16px; font-size: 0.875rem; color: #6e2a14; }
.hp__error p { margin: 0; }
.hp__problem { margin: 0; font-size: 0.875rem; color: var(--warm); }

/* Type. Inside a card the colours come from the card, so every colour field stays readable. */
.hp__label { margin: 0; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; line-height: 1.4; text-transform: uppercase; color: var(--fg-muted, var(--muted)); }
.hp__label--attention { color: var(--warm); }
.hp__title { margin: 0; font-family: var(--serif); font-size: clamp(2rem, 3.8vw, 3rem); font-weight: 500; line-height: 1.1; letter-spacing: -0.02em; text-wrap: balance; color: #fbf3e6; }
.hp__lead { margin: 0; max-width: 28em; font-family: var(--serif); font-size: 1.25rem; line-height: 1.5; color: #c3cfe4; }
.hp__card-title { margin: 0; font-family: var(--serif); font-size: 1.25rem; font-weight: 500; line-height: 1.35; color: var(--fg, var(--ink)); text-wrap: balance; }
.hp__focus { margin: 0; max-width: 24em; font-family: var(--serif); font-size: 1.5rem; font-weight: 500; line-height: 1.3; letter-spacing: -0.01em; color: var(--fg, var(--ink)); }
.hp__small { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--fg-muted, var(--muted)); }
.hp__text { margin: 0; font-size: 1rem; line-height: 1.5; overflow-wrap: anywhere; color: var(--fg, var(--ink)); }
.hp__name { margin: 0; font-size: 1rem; font-weight: 600; color: var(--fg, var(--ink)); }

/* The one card system, in colour fields */
.hp__card { --fg: var(--ink); --fg-muted: var(--muted); --link: var(--navy); display: flex; flex-direction: column; gap: var(--s2); min-width: 0; padding: 20px 24px; background: #ebf2fa url("/bg-paper.jpg") 0 0 / 1472px 2616px; border: 1px solid rgb(251 243 230 / 14%); border-radius: 12px; }
.hp__card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s2); }
.hp__card-head > div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
/* Your list: a calm card with a small spark, and rows you tick off, so it feels like progress */
/* The house and its speech bubble */
.hp__house-row { display: flex; align-items: center; gap: 22px; }
.hp__house { flex: none; width: 104px; height: auto; }
.hp__bubble { position: relative; flex: 1; display: flex; align-items: center; gap: 14px; min-width: 0; padding: 14px 18px; background: #fff; border: 1.5px solid var(--navy); border-radius: 18px; font-family: inherit; text-align: left; color: var(--ink); cursor: pointer; transition: transform 0.15s, background-color 0.15s; }
.hp__bubble::before { content: ""; position: absolute; top: 50%; left: -9px; width: 16px; height: 16px; background: #fff; border-bottom: 1.5px solid var(--navy); border-left: 1.5px solid var(--navy); transform: translateY(-50%) rotate(45deg); transition: background-color 0.15s; }
.hp__bubble:hover { transform: translateY(-2px); background: #fffdf8; }
.hp__bubble:hover::before { background: #fffdf8; }
.hp__bubble:focus-visible { outline: 2px solid var(--navy); outline-offset: 3px; }
.hp__bubble-count { display: grid; flex: none; place-items: center; min-width: 34px; height: 34px; border-radius: 50%; background: var(--warm); font-size: 1rem; font-weight: 600; color: #fff; }
.hp__bubble-text { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.hp__bubble-title { font-family: var(--serif); font-size: 1.125rem; line-height: 1.3; color: var(--ink); }
.hp__bubble-chev { flex: none; color: var(--navy); transition: transform 0.2s; }
.hp__bubble-chev.is-open { transform: rotate(180deg); }
.hp__list-panel { display: flex; flex-direction: column; gap: var(--s1); padding-top: var(--s2); border-top: 1px solid var(--line); }
.hp__todo-list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.hp__todo { display: flex; align-items: center; gap: var(--s2); padding: 12px 0; border-top: 1px solid var(--line); }
.hp__todo:first-child { border-top: 0; }
.hp__todo-text { flex: 1; min-width: 0; }
.hp__todo-text .hp__small { margin-top: 2px; }
.hp__todo-hint { flex: none; font-size: 0.875rem; color: var(--muted); }
.hp__check { display: grid; place-items: center; flex: none; width: 32px; height: 32px; padding: 0; background: rgb(255 255 255 / 60%); border: 2px solid var(--navy); border-radius: 50%; color: transparent; cursor: pointer; transition: background-color 0.15s, color 0.15s; }
.hp__check:hover { background: var(--navy); color: #fff; }
.hp__check:focus-visible { outline: 2px solid var(--navy); outline-offset: 3px; }
/* Two accent cards only: navy for the night, and one warm card for the day's idea. Every other card is plain. */
.hp__card--warm { background: #fbeadf; border-color: rgb(181 83 47 / 18%); --fg-muted: #7a4a35; }
.hp__card--navy { background: #1f3a68; border-color: rgb(251 243 230 / 20%); --fg: #fbf3e6; --fg-muted: #c3cfe4; --link: #fbf3e6; }
.hp__icon { flex: none; color: var(--navy); }
.hp__card--navy .hp__icon { color: #fbf3e6; }

/* Layout */
/* Two columns, as in the reference: the daily check-in on the left, the carousel and tonight on the right */
.hp__head { display: flex; flex-direction: column; gap: var(--s2); }
.hp__layout { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 8fr); gap: var(--s4); align-items: start; }
.hp__lcol, .hp__rcol { display: flex; flex-direction: column; gap: var(--s4); min-width: 0; }
.hp__car.hp__car--framed { --pad: 28px; width: 100%; margin: 0; border-radius: 18px; }
.hp__lcol .hp__list, .hp__rcol .hp__tonight { max-width: none; }
.hp__layout + .hp__layout { margin-top: calc(-1 * var(--s2)); }
/* The note lives inside the daily check-in, under the flowers, in the same dark glass */
.hp__noteform { display: flex; flex-direction: column; gap: var(--s1); margin-top: var(--s3); padding-top: var(--s3); border-top: 1px solid rgb(251 243 230 / 18%); }
.hp__noteform .hp__card-title { font-size: 1.125rem; }
.hp__us .hp__note-box { min-height: 4.5rem; background: rgb(251 243 230 / 8%); border-color: rgb(251 243 230 / 26%); color: #fbf3e6; }
.hp__us .hp__note-box::placeholder { color: #9fb0cc; }
.hp__us .hp__note-box:focus { border-color: #fbf3e6; box-shadow: 0 0 0 3px rgb(251 243 230 / 16%); }
.hp__us .hp__starter, .hp__us .hp__starter:visited { color: #cfdcf2; }
.hp__us .hp__small, .hp__us .hp__starts { color: #9fb0cc; }
/* Shift tiles, like the reference's shift rotation: who is on, and when */
.hp__tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); gap: var(--s1); margin: 0; padding: 0; list-style: none; }
.hp__tile { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; background: rgb(251 243 230 / 10%); border: 1px solid rgb(251 243 230 / 16%); border-radius: 12px; }
.hp__tile--me { background: rgb(251 243 230 / 16%); }
.hp__tile-initial { display: grid; place-items: center; width: 28px; height: 28px; margin-bottom: 6px; background: #fbf3e6; border-radius: 50%; font-size: 0.875rem; font-weight: 600; color: var(--navy); }
.hp__tile--partner .hp__tile-initial { background: #f6d8c6; color: #5a2a14; }
.hp__tile--open .hp__tile-initial { background: transparent; border: 1.5px dashed rgb(251 243 230 / 50%); color: #c3cfe4; }
.hp__tile-name { font-size: 1rem; font-weight: 600; color: #fbf3e6; }
.hp__tile-time { font-size: 0.875rem; color: #c3cfe4; }
.hp__pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 17rem); gap: var(--s4); align-items: start; }
.hp__lcol .fp { max-width: 100%; }
.hp__pair .fp { max-width: 100%; }
/* The daily check-in is narrower in this layout, so its parts are sized to fit it */
.hp__lcol .hp__open.hp__us { padding: 64px 24px 72px; border-radius: 130px 130px 12px 12px; }
.hp__lcol .hp__us .hp__flower { width: 56px; height: 94px; margin-left: 0; }
.hp__lcol .hp__us .hp__garden { gap: var(--s2); }
.hp__lcol .hp__us .hp__plant { padding: 0 4px; }
.hp__lcol .hp__us .hp__hills { height: 72px; }
.hp__lcol .hp__us .hp__moon { top: 40px; right: 40px; width: 32px; }
.hp__lcol .hp__note { padding: 16px 18px; gap: var(--s1); }
.hp__lcol .hp__note-box { min-height: 4.5rem; }
.hp__intro { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 28rem); gap: var(--s4); align-items: start; }
.hp__intro-side { display: flex; flex-direction: column; gap: var(--s4); min-width: 0; }
.hp__intro-text { display: flex; flex-direction: column; gap: var(--s2); }
.hp__grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--s2); }
.hp__c4 { grid-column: span 4; }
.hp__c5 { grid-column: span 5; }
.hp__c7 { grid-column: span 7; }
.hp__c6 { grid-column: span 6; }
.hp__c12 { grid-column: 1 / -1; }
.hp__action { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2) var(--s3); }

/* Buttons and links: the main button, an outline, a warm thank you, plain links */
.hp__btn, .hp__btn:visited { display: inline-flex; align-items: center; justify-content: center; padding: 12px 20px; border: 1px solid transparent; border-radius: 12px; font-family: inherit; font-size: 1rem; font-weight: 600; line-height: 1.25; text-decoration: none; cursor: pointer; transition: background-color 0.15s; }
.hp__btn--primary, .hp__btn--primary:visited { background: var(--navy); color: #fff; }
.hp__btn--primary:hover { background: #162b4f; color: #fff; }
.hp__card--navy .hp__btn--primary { background: #fbf3e6; color: var(--navy); }
.hp__card--navy .hp__btn--primary:hover { background: #fff; color: var(--navy); }
.hp__btn--attention, .hp__btn--attention:visited { background: var(--warm); color: #fff; }
.hp__btn--attention:hover { background: #99441f; color: #fff; }
.hp__btn--outline, .hp__btn--outline:visited { background: transparent; border-color: var(--navy); color: var(--navy); }
.hp__btn--outline:hover { background: var(--navy-soft); color: var(--navy); }
/* The emotional action: rounder, softer, with a heart. Other buttons are square-edged and plain. */
.hp__btn--warm, .hp__btn--warm:visited { gap: 10px; padding: 12px 24px; background: transparent; border-color: rgb(181 83 47 / 45%); color: #6b2f14; border-radius: 999px; }
.hp__btn--warm:hover { background: #fbeadf; color: #6b2f14; }
.hp__btn--warm svg { color: #b5532f; }
.hp__btn:disabled { opacity: 0.5; cursor: default; }
.hp__btn:focus-visible, .hp__link:focus-visible, .hp__starter:focus-visible, .hp__qbtn:focus-visible { outline: 2px solid var(--navy); outline-offset: 3px; }
.hp__link, .hp__link:visited { padding: 0; background: none; border: 0; font-family: inherit; font-size: 1rem; font-weight: 600; color: var(--link, var(--navy)); text-decoration: underline; text-underline-offset: 4px; cursor: pointer; }
.hp__link:hover { opacity: 0.8; }
.hp__link:disabled { opacity: 0.5; cursor: default; }
.hp__link--sm, .hp__link--sm:visited { flex: none; font-size: 0.875rem; }
.hp__link--quiet, .hp__link--quiet:visited { font-size: 0.875rem; font-weight: 500; color: var(--fg-muted, var(--muted)); }

/* The note */
.hp__note-box { width: 100%; min-height: 5.5rem; padding: var(--s2); background: #fff; border: 1px solid rgb(31 58 104 / 24%); border-radius: 12px; font-family: var(--serif); font-size: 1.25rem; line-height: 1.5; color: var(--ink); resize: vertical; }
.hp__note-box::placeholder { color: #7b8499; }
.hp__note-box:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
.hp__starts { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s1) var(--s2); margin: 0; font-size: 0.875rem; color: var(--fg-muted); }
.hp__starter { padding: 0; background: none; border: 0; font-family: inherit; font-size: 0.875rem; font-weight: 600; color: var(--navy); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.hp__note-foot { display: flex; align-items: center; gap: var(--s2); }
.hp__count { font-size: 0.875rem; color: var(--fg-muted); }
.hp__count.is-near { color: var(--warm); font-weight: 600; }

/* The two of you */
.hp__two { display: block; }
.hp__two-body { display: flex; flex-direction: column; gap: var(--s2); min-width: 0; }
.hp__garden { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s3); align-items: end; }
.hp__plant { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s1); min-width: 0; padding: 0 var(--s2); border-radius: 12px; }
.hp__plant.is-attention { box-shadow: inset 3px 0 0 var(--warm); }
.hp__plant-name { margin: 0; font-family: var(--serif); font-size: 1.25rem; font-weight: 500; line-height: 1.35; color: var(--fg); }
.hp__plant-text { display: flex; flex-direction: column; gap: 4px; }
.hp__flower { flex: none; width: 66px; height: 110px; margin: 4px 0 4px var(--s1); overflow: visible; }

/* Tonight, hour by hour */
.hp__shift { display: flex; flex-direction: column; gap: var(--s1); padding-top: var(--s1); }
.hp__track { position: relative; height: 40px; background: rgb(251 243 230 / 14%); border-radius: 10px; }
.hp__seg { position: absolute; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; padding: 0 var(--s1); overflow: hidden; border-radius: 10px; font-size: 0.875rem; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
.hp__seg--me { background: #fbf3e6; color: var(--navy); }
.hp__seg--partner { background: #f6d8c6; color: #5a2a14; }
.hp__seg--open { background: transparent; border: 2px dashed rgb(251 243 230 / 45%); color: #c3cfe4; }
.hp__tick { position: absolute; top: 8px; bottom: 8px; width: 3px; margin-left: -1.5px; background: #16233b; border-radius: 2px; box-shadow: 0 0 0 1.5px #fbf3e6; }
.hp__now { position: absolute; top: -8px; bottom: -8px; width: 3px; margin-left: -1.5px; background: #ff8a63; border-radius: 2px; }
.hp__now i { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); padding-bottom: 2px; font-size: 0.75rem; font-style: normal; font-weight: 700; color: #ffb095; white-space: nowrap; }
.hp__hours { display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 500; color: #c3cfe4; }

/* The nights this week */
.hp__dots { display: flex; gap: 10px; margin: 0; padding: 0; list-style: none; }
.hp__night { display: flex; flex-direction: column; align-items: center; gap: var(--s1); }
.hp__dot { box-sizing: border-box; width: 28px; aspect-ratio: 1; border-radius: 50%; }
.hp__dot--you { background: var(--navy); }
.hp__dot--them { border: 2.5px solid var(--navy); background: #fff; }
.hp__dot--shared { border: 2.5px solid var(--navy); background: linear-gradient(90deg, var(--navy) 50%, #fff 50%); }
.hp__dot--open { border: 2px dashed rgb(31 58 104 / 40%); }
.hp__night.is-today .hp__dot { outline: 2px solid var(--ink); outline-offset: 3px; }
.hp__night-day { font-size: 0.75rem; font-weight: 600; color: var(--fg-muted); }
.hp__night.is-today .hp__night-day { color: var(--ink); }
.hp__key { display: flex; align-items: center; gap: var(--s1); margin: 0; font-size: 0.875rem; color: var(--fg-muted); }
.hp__swatch { box-sizing: border-box; display: inline-block; width: 12px; height: 12px; border-radius: 50%; }
.hp__key .hp__swatch:not(:first-child) { margin-left: var(--s2); }
.hp__swatch--you { background: var(--navy); }
.hp__swatch--them { border: 2px solid var(--navy); background: #fff; }

/* The week, in flowers */
.hp__badge { flex: none; margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--navy); }
.hp__weekgrid { display: grid; grid-template-columns: 4.5rem repeat(7, minmax(0, 1fr)); align-items: end; gap: var(--s1) 4px; }
.hp__wk-day { text-align: center; font-size: 0.75rem; font-weight: 600; color: var(--fg-muted); }
.hp__wk-day.is-today { color: var(--ink); text-decoration: underline; text-underline-offset: 4px; }
.hp__wk-name { align-self: center; font-size: 0.875rem; font-weight: 600; color: var(--fg); }
.hp__wk-cell { display: grid; place-items: end center; height: 40px; }
.hp__mini { width: 22px; height: 36px; overflow: visible; }
.hp__nodata { display: block; width: 8px; height: 8px; margin-bottom: 8px; border-radius: 50%; background: rgb(31 58 104 / 22%); }

/* Numbers */
.hp__figs { display: flex; flex-wrap: wrap; gap: var(--s3) var(--s4); margin: 0; padding: 0; list-style: none; }
.hp__figure { display: flex; flex-direction: column; gap: 4px; }
.hp__fig { font-size: 2rem; font-weight: 500; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--navy); }
.hp__fig--sm { font-size: 1.5rem; font-weight: 500; }
.hp__figs--row { padding-top: var(--s2); border-top: 1px solid var(--line); }

/* The gratitude jar */

/* One thing today */
.hp__card--focus .hp__card-head { align-items: flex-start; }

/* Baby, today */
.hp__tally { display: flex; gap: var(--s3); margin: 0; padding: 0; list-style: none; }
.hp__tally li { display: flex; flex-direction: column; gap: 2px; }
.hp__tally b { font-size: 1.5rem; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; color: var(--navy); }
.hp__tally span { font-size: 0.875rem; color: var(--fg-muted); }
.hp__quicklog { display: flex; flex-wrap: wrap; gap: var(--s1); }
.hp__qbtn, .hp__qbtn:visited { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: transparent; border: 1px solid var(--line); border-radius: 10px; font-size: 0.875rem; font-weight: 600; color: var(--navy); text-decoration: none; transition: border-color 0.15s, background-color 0.15s; }
.hp__qbtn:hover { background: var(--navy-soft); border-color: var(--navy); color: var(--navy); }

/* Lines: waiting and lately */
.hp__lines { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.hp__line { display: flex; align-items: center; justify-content: space-between; gap: var(--s2); padding: var(--s2) 0; border-top: 1px solid var(--line); }
.hp__line:first-child { border-top: 0; padding-top: 0; }
.hp__line--time { display: grid; grid-template-columns: 5.5rem minmax(0, 1fr) auto; align-items: baseline; }

/* Fields */
.hp__post { display: flex; align-items: center; gap: var(--s2); }
.hp__field { flex: 1; min-width: 0; width: 100%; height: 48px; padding: 0 var(--s2); background: #fff; border: 1px solid rgb(31 58 104 / 28%); border-radius: 12px; font-family: inherit; font-size: 1rem; color: var(--ink); }
.hp__field::placeholder { color: #7b8499; }
.hp__field:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
.hp__field--date { max-width: 220px; }
.hp__task { display: flex; flex-direction: column; gap: var(--s2); }
.hp__field-label { display: flex; flex-direction: column; gap: var(--s1); font-size: 0.875rem; color: var(--muted); }
.hp__who { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s1) var(--s2); margin: 0; padding: 0; border: 0; font-size: 1rem; color: var(--ink); }
.hp__who legend { float: none; width: auto; margin: 0 0 var(--s1); padding: 0; font-size: 0.875rem; color: var(--muted); }
.hp__who label { display: inline-flex; align-items: center; gap: var(--s1); }

.hp__baby { font-size: 0.875rem; line-height: 1.5; color: #9fb0cc; }
.hp__baby strong { color: #fbf3e6; font-weight: 600; }

@media (max-width: 899px) {
  .hp { gap: var(--s5); }
  .hp__intro { grid-template-columns: minmax(0, 1fr); }
  .hp__layout { grid-template-columns: minmax(0, 1fr); }
  .hp__pair { grid-template-columns: minmax(0, 1fr); }
  .hp__grid { grid-template-columns: minmax(0, 1fr); }
  .hp__c4, .hp__c5, .hp__c6, .hp__c7, .hp__c12 { grid-column: 1 / -1; }
  .hp__trio { grid-template-columns: minmax(0, 1fr); }
  .hp__garden { gap: var(--s2); }
  .hp__card { padding: var(--s3); }
}
@media (max-width: 575px) {
  .hp__open.hp__us { padding: 70px 24px 80px; border-radius: 120px 120px 14px 14px; }
  .hp__moon { right: 40px; width: 32px; }
  .hp__house { width: 76px; }
  .hp__house-row { gap: 18px; }
  .hp__line--time { grid-template-columns: minmax(0, 1fr) auto; }
  .hp__line--time .hp__small:first-child { grid-column: 1 / -1; }
  .hp__weekgrid { grid-template-columns: 3.5rem repeat(7, minmax(0, 1fr)); }
}

/* Sections that sit on the page itself: no box, just cream text on the deep blue and a soft rule above */
.hp__open { --ink: #fbf3e6; --muted: #9fb0cc; --fg: #fbf3e6; --fg-muted: #9fb0cc; --link: #cfdcf2; --line: rgb(251 243 230 / 16%); --navy-soft: rgb(251 243 230 / 12%); display: flex; flex-direction: column; gap: var(--s2); min-width: 0; padding-top: var(--s3); border-top: 1px solid rgb(251 243 230 / 18%); color: #fbf3e6; }
.hp__open .hp__btn--primary { background: #fbf3e6; color: var(--navy); }
.hp__open .hp__btn--primary:hover { background: #fff; color: var(--navy); }
.hp__open .hp__btn:focus-visible, .hp__open .hp__link:focus-visible { outline-color: #fbf3e6; }
.hp__open .hp__field { background: rgb(251 243 230 / 8%); border-color: rgb(251 243 230 / 24%); color: #fbf3e6; }
.hp__open .hp__field::placeholder { color: #9fb0cc; }
.hp__open .hp__field:focus { border-color: #fbf3e6; box-shadow: 0 0 0 3px rgb(251 243 230 / 16%); }
.hp__open .hp__check { background: transparent; border-color: #fbf3e6; }
.hp__open .hp__check:hover { background: #fbf3e6; color: var(--navy); }
.hp__open .hp__tally b, .hp__open .hp__fig { color: #fbf3e6; }
.hp__open .hp__qbtn, .hp__open .hp__qbtn:visited { color: #cfdcf2; border-color: rgb(251 243 230 / 22%); }
.hp__open .hp__qbtn:hover { background: rgb(251 243 230 / 10%); border-color: rgb(251 243 230 / 45%); color: #fff; }
.hp__open .hp__problem { color: #f2b49b; }
.hp__open .hp__btn--outline, .hp__open .hp__btn--outline:visited { border-color: #fbf3e6; color: #fbf3e6; }
.hp__open .hp__btn--outline:hover { background: rgb(251 243 230 / 12%); color: #fff; }
.hp__open .hp__btn--warm, .hp__open .hp__btn--warm:visited { border-color: rgb(246 216 198 / 55%); color: #f6d8c6; }
.hp__open .hp__btn--warm:hover { background: rgb(246 216 198 / 14%); color: #fff; }
.hp__open .hp__btn--warm svg { color: #f0906c; }
.hp__open .hp__plant.is-attention { box-shadow: inset 3px 0 0 #f0906c; }
/* The house and its bubble keep their own colours */
.hp__open .hp__bubble { color: #16233b; }
.hp__open .hp__bubble .hp__label { color: #55627a; }
.hp__open .hp__bubble-title { color: #16233b; }
.hp__open--focus .hp__focus { font-size: 1.75rem; }
/* How you are both doing: an arched nursery window onto a garden at night */
.hp__open.hp__us { position: relative; isolation: isolate; overflow: hidden; padding: 76px 44px 84px; border: 2px solid rgb(251 243 230 / 30%); border-radius: 170px 170px 14px 14px; background: linear-gradient(180deg, #0e1d39 0%, #162b52 55%, #1f3c6e 100%); box-shadow: 0 9px 0 -2px rgb(251 243 230 / 22%); }
.hp__stars { position: absolute; inset: 0; z-index: -1; background-image: radial-gradient(1.6px 1.6px at 14% 14%, #fff 50%, transparent 52%), radial-gradient(1.2px 1.2px at 30% 8%, #fff 50%, transparent 52%), radial-gradient(1.6px 1.6px at 46% 18%, #fff 50%, transparent 52%), radial-gradient(1.2px 1.2px at 62% 7%, #fff 50%, transparent 52%), radial-gradient(1.6px 1.6px at 78% 20%, #fff 50%, transparent 52%), radial-gradient(1.2px 1.2px at 22% 28%, #fff 50%, transparent 52%), radial-gradient(1.2px 1.2px at 88% 34%, #fff 50%, transparent 52%), radial-gradient(1.2px 1.2px at 8% 40%, #fff 50%, transparent 52%); opacity: 0.75; -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 45%, transparent 80%); mask-image: linear-gradient(180deg, #000 0%, #000 45%, transparent 80%); }
.hp__moon { position: absolute; z-index: -1; top: 44px; right: 64px; width: 40px; height: auto; filter: drop-shadow(0 0 12px rgb(251 231 196 / 55%)); }
.hp__hills { position: absolute; z-index: -1; left: 0; right: 0; bottom: 0; width: 100%; height: 90px; }
.hp__list { max-width: 460px; margin-top: var(--s1); }
.hp__tonight { max-width: 460px; }
.hp__trio { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s4); }

/* The week strip */
.hp__strip { gap: var(--s3); padding: var(--s4) 0; border-block: 1px solid rgb(251 243 230 / 18%); }
.hp__strip-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--s2); }
.hp__strip-head > div { display: flex; flex-direction: column; gap: 4px; }
.hp__strip-title { margin: 0; font-family: var(--serif); font-size: 1.5rem; font-weight: 500; line-height: 1.35; color: #fbf3e6; }
.hp__strip-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s2) var(--s3); }
.hp__strip .hp__badge { color: #fbf3e6; }
.hp__strip-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s2) var(--s4); }
.hp__strip .hp__dot--you { background: #fbf3e6; }
.hp__strip .hp__dot--them { border-color: #fbf3e6; background: transparent; }
.hp__strip .hp__dot--shared { border-color: #fbf3e6; background: linear-gradient(90deg, #fbf3e6 50%, transparent 50%); }
.hp__strip .hp__dot--open { border-color: rgb(251 243 230 / 40%); }
.hp__strip .hp__swatch--you { background: #fbf3e6; }
.hp__strip .hp__swatch--them { border-color: #fbf3e6; background: transparent; }
.hp__strip .hp__nodata { background: rgb(251 243 230 / 24%); }
.hp__strip .hp__night-day, .hp__strip .hp__wk-day { color: #9fb0cc; }
.hp__strip .hp__wk-day.is-today { color: #fbf3e6; }
.hp__strip .hp__dot { width: 24px; }
.hp__wk-cell--night { height: 32px; place-items: center; }
.hp__figs--inline { gap: var(--s2) var(--s4); }

/* Compact: the same elements, sized so the whole page needs far less scrolling */
.hp { gap: var(--s4); }
.hp__layout { gap: var(--s3); }
.hp__lcol, .hp__rcol { gap: var(--s2); }
.hp__layout + .hp__layout { margin-top: 0; }
.hp__head { gap: 4px; }
.hp__title { font-size: clamp(1.75rem, 3vw, 2.25rem); }
.hp__lead { font-size: 1.0625rem; }
.hp__car.hp__car--framed { height: clamp(220px, 30vh, 300px); }
/* The daily check-in: flowers beside their words, a shorter note, a smaller garden */
.hp__lcol .hp__open.hp__us { padding: 38px 20px 50px; border-radius: 90px 90px 12px 12px; }
.hp__lcol .hp__us .hp__card-title { font-size: 1.0625rem; }
.hp__lcol .hp__us .hp__garden { gap: var(--s2); align-items: center; }
.hp__lcol .hp__us .hp__plant { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "flower name" "flower text"; align-items: center; column-gap: 10px; row-gap: 0; padding: 0; }
.hp__lcol .hp__us .hp__flower { grid-area: flower; width: 40px; height: 68px; margin: 0; }
.hp__lcol .hp__us .hp__plant-name { grid-area: name; align-self: end; font-size: 1.0625rem; }
.hp__lcol .hp__us .hp__plant-text { grid-area: text; align-self: start; }
.hp__lcol .hp__us .hp__hills { height: 44px; }
.hp__lcol .hp__us .hp__moon { top: 22px; right: 30px; width: 24px; }
.hp__noteform { margin-top: var(--s2); padding-top: var(--s2); }
.hp__noteform .hp__card-title { font-size: 1rem; }
.hp__noteform .hp__note-box { height: 4rem; min-height: 0; padding: 10px 12px; font-size: 1.0625rem; }
.hp__noteform .hp__starts { display: none; }
.hp__noteform:focus-within .hp__starts { display: flex; }
/* Tonight: tiles on one line each, a slimmer bar, and no extra sentence */
.hp__rcol .hp__tonight { gap: var(--s1); padding: 14px 18px; }
.hp__rcol .hp__tonight .hp__card-title { font-size: 1.0625rem; }
.hp__rcol .hp__tonight .hp__tile { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px 8px; padding: 8px 12px; }
.hp__rcol .hp__tonight .hp__tile-initial { width: 24px; height: 24px; margin-bottom: 0; }
.hp__rcol .hp__tonight .hp__shift { padding-top: 14px; }
.hp__rcol .hp__tonight .hp__track { height: 26px; }
.hp__rcol .hp__tonight > .hp__small { display: none; }
/* The photo, the day's idea and the checklist */
.hp__lcol .fp { max-width: 240px; }
.hp__open { padding-top: var(--s2); gap: var(--s1); }
.hp__open--focus .hp__focus { font-size: 1.375rem; }
.hp__house { width: 72px; }
.hp__bubble { padding: 10px 14px; }
.hp__bubble-title { font-size: 1rem; }
/* The week strip */
.hp__strip { gap: var(--s2); padding: var(--s2) 0; }
.hp__strip-title { font-size: 1.25rem; }
.hp__strip .hp__wk-cell { height: 30px; }
.hp__strip .hp__mini { width: 18px; height: 30px; }
.hp__strip .hp__nodata { margin-bottom: 4px; }
.hp__strip .hp__dot { width: 18px; }
.hp__strip .hp__wk-cell--night { height: 24px; }
.hp__strip .hp__figs--inline { display: none; }
/* Share the load, lately, baby */
.hp__trio { gap: var(--s3); }
.hp__line { padding: 8px 0; }

/* Two clear sections: the night window for how you are doing, and a cream sheet of paper for the note */
.hp__lcol .hp__open.hp__us { gap: var(--s2); padding: 0; border: 0; border-radius: 0; background: none; box-shadow: none; overflow: visible; isolation: auto; }
.hp__window { position: relative; isolation: isolate; overflow: hidden; display: flex; flex-direction: column; padding: 38px 20px 50px; border: 2px solid rgb(251 243 230 / 30%); border-radius: 90px 90px 12px 12px; background: linear-gradient(180deg, #0e1d39 0%, #162b52 55%, #1f3c6e 100%); box-shadow: 0 7px 0 -2px rgb(251 243 230 / 22%); color: #fbf3e6; }
.hp__lcol .hp__us .hp__noteform { --fg: #16233b; --fg-muted: #55627a; --link: #1f3a68; --ink: #16233b; --muted: #55627a; margin: 0; padding: 18px 20px 16px; border: 1px solid #f0cfda; border-radius: 12px; background: #fceef2; box-shadow: inset 0 4px 0 var(--warm); color: #16233b; }
.hp__lcol .hp__us .hp__noteform .hp__card-title { color: #16233b; font-family: var(--serif); font-size: 1.25rem; }
.hp__lcol .hp__us .hp__noteform .hp__label { color: var(--warm); }
.hp__lcol .hp__us .hp__noteform .hp__note-box { height: 5rem; background: #fff; border: 1px solid #c9d3e3; color: #16233b; }
.hp__lcol .hp__us .hp__noteform .hp__note-box::placeholder { color: #6b7790; }
.hp__lcol .hp__us .hp__noteform .hp__note-box:focus { border-color: var(--navy); box-shadow: 0 0 0 3px rgb(31 58 104 / 15%); }
.hp__lcol .hp__us .hp__noteform .hp__starter, .hp__lcol .hp__us .hp__noteform .hp__starter:visited { color: var(--navy); }
.hp__lcol .hp__us .hp__noteform .hp__small, .hp__lcol .hp__us .hp__noteform .hp__starts { color: #55627a; }

/* A little shorter on the left; the carousel stretches so both columns end level */
.hp__layout[aria-label="Today"] { align-items: stretch; }
.hp__layout[aria-label="Today"] .hp__rcol .hp__car.hp__car--framed { flex: 1 1 auto; height: auto; min-height: 240px; }
.hp__window { padding: 28px 18px 40px; }
.hp__lcol .hp__us .hp__noteform { padding: 14px 18px 12px; gap: 6px; }
.hp__lcol .hp__us .hp__noteform .hp__card-title { font-size: 1.125rem; }
.hp__lcol .hp__us .hp__noteform .hp__note-box { height: 3.5rem; }
.hp__lcol .hp__us .hp__hills { height: 36px; }

/* Light page: the pale blue paper shows through, so open sections use dark ink. The night window and the shift card stay dark. */
.hp__title { color: #16233b; }
.hp__lead, .hp__status, .hp__baby { color: #55627a; }
.hp__baby strong { color: #16233b; }
.hp__open { --ink: #16233b; --muted: #55627a; --fg: #16233b; --fg-muted: #55627a; --link: #1f3a68; --line: rgb(22 35 59 / 16%); --navy-soft: rgb(31 58 104 / 10%); border-top-color: rgb(22 35 59 / 16%); color: #16233b; }
.hp__open .hp__btn--primary { background: var(--navy); color: #fff; }
.hp__open .hp__btn:focus-visible, .hp__open .hp__link:focus-visible { outline-color: var(--navy); }
.hp__open .hp__field { background: #fff; border-color: #c9d3e3; color: #16233b; }
.hp__open .hp__field::placeholder { color: #6b7790; }
.hp__open .hp__field:focus { border-color: var(--navy); box-shadow: 0 0 0 3px rgb(31 58 104 / 15%); }
.hp__open .hp__check { background: transparent; border-color: var(--navy); }
.hp__open .hp__check:hover { background: var(--navy); color: #fff; }
.hp__open .hp__tally b, .hp__open .hp__fig { color: #16233b; }
.hp__open .hp__qbtn, .hp__open .hp__qbtn:visited { color: var(--navy); border-color: rgb(31 58 104 / 30%); }
.hp__open .hp__qbtn:hover { background: rgb(31 58 104 / 8%); border-color: var(--navy); color: var(--navy); }
.hp__open .hp__btn--outline, .hp__open .hp__btn--outline:visited { border-color: var(--navy); color: var(--navy); }
.hp__open .hp__btn--outline:hover { background: rgb(31 58 104 / 8%); color: var(--navy); }
.hp__strip { border-block-color: rgb(22 35 59 / 16%); }
.hp__strip-title, .hp__strip .hp__badge, .hp__strip .hp__wk-day.is-today { color: #16233b; }
.hp__strip .hp__dot--you, .hp__strip .hp__swatch--you { background: var(--navy); }
.hp__strip .hp__dot--them, .hp__strip .hp__swatch--them { border-color: var(--navy); background: transparent; }
.hp__strip .hp__dot--shared { border-color: var(--navy); background: linear-gradient(90deg, var(--navy) 50%, transparent 50%); }
.hp__strip .hp__dot--open { border-color: rgb(22 35 59 / 35%); }
.hp__strip .hp__nodata { background: rgb(22 35 59 / 16%); }
.hp__strip .hp__night-day, .hp__strip .hp__wk-day { color: #55627a; }
.hp__window { --ink: #fbf3e6; --muted: #9fb0cc; --fg: #fbf3e6; --fg-muted: #9fb0cc; --link: #cfdcf2; }
.hp__window .hp__btn--primary { background: #fbf3e6; color: var(--navy); }
.hp__window .hp__btn:focus-visible, .hp__window .hp__link:focus-visible { outline-color: #fbf3e6; }
.hp__window .hp__btn--outline, .hp__window .hp__btn--outline:visited { border-color: #fbf3e6; color: #fbf3e6; }
.hp__window .hp__btn--outline:hover { background: rgb(251 243 230 / 12%); color: #fff; }

.hp__window { border-radius: 12px; }
.hp__lcol .hp__us .hp__noteform { border-radius: 12px; }

/* How you are both doing: no decoration, one row each */
.hp__lcol .hp__us .hp__window { padding: 20px; background: #1f3a68; border: 0; box-shadow: none; }
.hp__lcol .hp__us .hp__window .hp__garden { grid-template-columns: minmax(0, 1fr); gap: var(--s1); align-items: stretch; }
.hp__lcol .hp__us .hp__window .hp__plant { grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "av name" "av text"; column-gap: 12px; align-items: center; padding: 12px 14px; background: rgb(251 243 230 / 8%); border: 1px solid rgb(251 243 230 / 14%); border-radius: 8px; }
.hp__avatar { grid-area: av; position: relative; display: grid; place-items: center; width: 40px; height: 40px; background: #fbf3e6; border-radius: 50%; font-size: 1rem; font-weight: 600; color: var(--navy); }
.hp__avatar--partner { background: #f6d8c6; color: #5a2a14; }
.hp__avatar--empty { background: transparent; border: 1.5px dashed rgb(251 243 230 / 50%); color: #c3cfe4; }
.hp__avatar::after { content: ""; position: absolute; right: -2px; bottom: -2px; width: 12px; height: 12px; border: 2px solid #1f3a68; border-radius: 50%; background: #8fcf9f; }
.hp__avatar--empty::after { display: none; }
.hp__avatar--opening::after { background: #e8d27a; }
.hp__avatar--drooping::after { background: #e9a56b; }
.hp__avatar--wilted::after { background: #e07a62; }
.hp__lcol .hp__us .hp__window .hp__plant-name { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #c3cfe4; }

/* The row tint follows how each of you is feeling */
.hp__lcol .hp__us .hp__window .hp__plant--bloom { background: rgb(143 207 159 / 22%); border-color: rgb(143 207 159 / 55%); }
.hp__lcol .hp__us .hp__window .hp__plant--opening { background: rgb(232 210 122 / 18%); border-color: rgb(232 210 122 / 50%); }
.hp__lcol .hp__us .hp__window .hp__plant--drooping { background: rgb(233 165 107 / 22%); border-color: rgb(233 165 107 / 55%); }
.hp__lcol .hp__us .hp__window .hp__plant--wilted { background: rgb(224 122 98 / 26%); border-color: rgb(224 122 98 / 65%); }

.hp__incharge { margin: 0; font-size: 1rem; color: #c3cfe4; }
.hp__incharge strong { color: #fbf3e6; }
.hp__tile.is-current { border-color: #ff8a63; }
.hp__tile--both .hp__tile-initial { background: #dce6f2; color: #1f3a68; }
.hp__rule { margin: 0; font-size: 0.875rem; color: #c3cfe4; }
.hp__seg--both { background: #dce6f2; color: var(--navy); }
.hp__rcol .hp__tonight .hp__seg { font-size: 0.8125rem; padding: 0 4px; }

/* Today: a plain timeline on a warm card, one row per part of the day */
.hp__rcol .hp__card.hp__tonight { background: #fceef2; border-color: #f0cfda; gap: var(--s2); }
.hp__tonight .hp__incharge { color: #55627a; }
.hp__tonight .hp__incharge strong { color: #16233b; }
.hp__tonight .hp__rule { color: #6b7790; }
.hp__tl { margin: 0; padding: 0; list-style: none; }
.hp__tl-row { position: relative; display: grid; grid-template-columns: 9.5rem 18px minmax(0, 1fr) auto; align-items: center; column-gap: 12px; padding: 9px 0; }
.hp__tl-row + .hp__tl-row { border-top: 1px dashed #e2c8b0; }
.hp__tl-when { display: flex; flex-direction: column; font-size: 0.9375rem; font-weight: 600; color: #16233b; }
.hp__tl-when small { font-size: 0.8125rem; font-weight: 400; color: #6b7790; }
.hp__tl-dot { width: 12px; height: 12px; border: 2px solid #b5532f; border-radius: 50%; background: #fdf1e6; }
.hp__tl-row.is-current .hp__tl-dot { background: #b5532f; box-shadow: 0 0 0 4px rgb(181 83 47 / 18%); }
.hp__tl-who { font-family: var(--serif); font-size: 1.125rem; color: #16233b; }
.hp__tl-row--open .hp__tl-who { font-family: inherit; font-size: 1rem; color: #6b7790; }
.hp__tl-now { padding: 2px 10px; background: #b5532f; border-radius: 999px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #fff; }
@media (max-width: 575px) { .hp__tl-row { grid-template-columns: 7.5rem 14px minmax(0, 1fr) auto; column-gap: 8px; } }

/* Both columns end level: the note stretches to the bottom of the Today card, and the carousel takes what is left on the right */
.hp__layout[aria-label="Today"] .hp__lcol { align-self: stretch; }
.hp__layout[aria-label="Today"] .hp__lcol .hp__open.hp__us { flex: 1 1 auto; }
.hp__layout[aria-label="Today"] .hp__lcol .hp__us .hp__noteform { flex: 1 1 auto; }
.hp__layout[aria-label="Today"] .hp__lcol .hp__us .hp__noteform .hp__note-box { flex: 1 1 auto; height: auto; min-height: 3.5rem; resize: none; }
.hp__layout[aria-label="Today"] .hp__rcol .hp__car.hp__car--framed { min-height: 180px; }

/* Top right: the checklist and the bell sit beside the greeting; the checklist opens as a panel under them */
.hp__head { flex-direction: row; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--s3); }
.hp__head-text { display: flex; flex: 1 1 22rem; flex-direction: column; gap: 4px; min-width: 0; }
.hp__head-tools { position: relative; display: flex; flex: 0 1 auto; align-items: flex-start; gap: 12px; margin-left: auto; max-width: 100%; }
.hp__head-tools .hp__list { flex: 0 1 380px; min-width: 0; max-width: 380px; margin: 0; padding: 0; border: 0; }
.hp__head-tools .hp__house-row { gap: 12px; }
.hp__head-tools .hp__house { width: 54px; }
.hp__head-tools .hp__bubble { padding: 8px 12px; gap: 10px; }
.hp__head-tools .hp__bubble-count { min-width: 28px; height: 28px; font-size: 0.9375rem; }
.hp__head-tools .hp__bubble-title { font-size: 0.9375rem; }
.hp__head-tools .hp__list-panel { position: absolute; top: calc(100% + 8px); right: 0; z-index: 30; width: min(440px, calc(100vw - 32px)); max-height: 70vh; overflow: auto; padding: var(--s2); background: #fff; border: 1px solid #c9d3e3; border-radius: 12px; }
.hp__bell { position: relative; display: grid; flex: none; place-items: center; width: 46px; height: 46px; background: #fff; border: 1.5px solid #1f3a68; border-radius: 50%; color: #1f3a68; cursor: pointer; }
.hp__bell:hover { background: #fffdf8; }
.hp__bell:focus-visible { outline: 2px solid #1f3a68; outline-offset: 3px; }
.hp__bell-badge { position: absolute; top: -4px; right: -4px; display: grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; background: #b5532f; border: 2px solid #ebf2fa; border-radius: 999px; font-size: 0.6875rem; font-weight: 700; color: #fff; }
@media (max-width: 575px) { .hp__head-tools { width: 100%; justify-content: space-between; } .hp__head-tools .hp__list { flex: 1 1 auto; } }

/* Today: two plain lanes on a 6 AM to 6 AM ruler, so every time can be read */
.hp__lanes { position: relative; display: grid; grid-template-columns: 4.25rem minmax(0, 1fr); grid-template-rows: 44px 44px 22px; row-gap: 6px; align-items: center; }
.hp__lane-name { font-size: 0.9375rem; font-weight: 600; color: #16233b; }
.hp__lane { position: relative; height: 100%; background: repeating-linear-gradient(90deg, #ecc5d2 0 1px, transparent 1px 12.5%), rgb(255 255 255 / 45%); border-radius: 6px; }
.hp__block { position: absolute; top: 4px; bottom: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1.5px solid; border-radius: 4px; font-size: 0.875rem; font-weight: 600; white-space: nowrap; color: #16233b; }
.hp__block--me { background: #dce6f2; border-color: #5c7a9e; }
.hp__block--partner { background: #f6d8c6; border-color: #e3a584; }
.hp__axis { grid-column: 2; position: relative; height: 100%; }
.hp__axis span { position: absolute; top: 4px; transform: translateX(-50%); font-size: 0.75rem; font-weight: 500; white-space: nowrap; color: #55627a; }
.hp__axis span.is-first { transform: none; }
.hp__axis span.is-last { transform: translateX(-100%); }
.hp__lanes-now { grid-column: 2; grid-row: 1 / 3; position: relative; height: 100%; pointer-events: none; }
.hp__nowline { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: #b5532f; }
.hp__nowline b { position: absolute; top: -22px; left: 50%; transform: translateX(-50%); font-size: 0.75rem; font-weight: 700; white-space: nowrap; color: #b5532f; }
.hp__lanes { margin-top: 20px; }
.hp__open-hours { margin: 0; padding: 0; list-style: none; font-size: 0.875rem; color: #55627a; }
@media (max-width: 575px) { .hp__block { font-size: 0.75rem; } .hp__lanes { grid-template-columns: 3.25rem minmax(0, 1fr); } }

.hp__block { font-size: 0; }
.hp__hand { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.hp__hand-row { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; align-items: center; column-gap: 10px; padding: 8px 0; font-size: 1rem; color: #16233b; }
.hp__hand-row + .hp__hand-row { border-top: 1px dashed #ecc5d2; }
.hp__hand-key { width: 14px; height: 14px; border: 1.5px solid; border-radius: 3px; }
.hp__hand-key--me { background: #dce6f2; border-color: #5c7a9e; }
.hp__hand-key--partner { background: #f6d8c6; border-color: #e3a584; }
.hp__hand-key--both { background: linear-gradient(90deg, #dce6f2 50%, #f6d8c6 50%); border-color: #8c8c8c; }
.hp__hand-key--open { border-style: dashed; border-color: #8fa0bd; background: transparent; }
.hp__hand-name { font-weight: 600; }
.hp__hand-time { font-size: 0.9375rem; color: #55627a; }
.hp__hand-row.is-current .hp__hand-name::after { content: "Now"; margin-left: 8px; padding: 1px 8px; background: #b5532f; border-radius: 999px; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #fff; vertical-align: 2px; }

.hp__block { font-size: inherit; }
.hp__block .carry { flex: none; }
.hp__hand-row { grid-template-columns: 30px minmax(0, 1fr) auto; }
.hp__hand-key { justify-self: center; }

/* The three everyday boxes: equal height, a header with a rule under it, and a body that fills the rest */
.hp__trio { align-items: stretch; }
.hp__trio > .hp__trio-card { gap: var(--s2); padding: 18px 20px 20px; background: #fff; border: 1px solid #c9d3e3; }
.hp__trio-card .hp__card-head { align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid #e5eaf2; }
.hp__trio-card .hp__card-title { font-size: 1.25rem; }
.hp__trio-card .hp__action { margin-top: auto; }
.hp__trio-card .hp__post { margin-top: auto; }
.hp__trio-card .hp__lines { flex: 1; }
.hp__trio-card .hp__line { padding: 10px 0; }
.hp__trio-card .hp__line:first-child { padding-top: 0; }
.hp__trio-card .hp__line--time { grid-template-columns: 4.75rem minmax(0, 1fr) auto; }
.hp__trio-card .hp__tally { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.hp__trio-card .hp__tally li { align-items: center; gap: 4px; padding: 12px 6px; background: #f3f6fb; border: 1px solid #e5eaf2; border-radius: 8px; text-align: center; }
.hp__trio-card .hp__quicklog { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: auto; }
.hp__trio-card .hp__qbtn { justify-content: center; padding: 8px 6px; }
@media (max-width: 899px) { .hp__trio { grid-template-columns: minmax(0, 1fr); } }

/* Every item gets its own grid cell, so the "now" overlay cannot push the lanes out of place */
.hp__lanes > :nth-child(1) { grid-area: 1 / 1; }
.hp__lanes > :nth-child(2) { grid-area: 1 / 2; }
.hp__lanes > :nth-child(3) { grid-area: 2 / 1; }
.hp__lanes > :nth-child(4) { grid-area: 2 / 2; }
.hp__lanes > :nth-child(5) { grid-area: 3 / 2; }
.hp__lanes > :nth-child(6) { grid-area: 1 / 2 / 3 / 3; }

/* Coming up: the next plan on a warm panel, and the ones after it on a timeline */
.hp__coming { display: flex; flex-direction: column; gap: var(--s2); }
.hp__coming-head { align-items: flex-start; }
.hp__coming-head .hp__card-title { font-size: 1.25rem; }
.hp__coming-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: var(--s3); align-items: stretch; }
.hp__next { display: flex; flex-direction: column; gap: 4px; padding: 20px 24px; background: #fdf1e6; border: 1px solid #ecd3bd; border-radius: 12px; }
.hp__next-when { margin: 6px 0 0; font-family: var(--serif); font-size: 2rem; line-height: 1.1; letter-spacing: -0.01em; color: #16233b; }
.hp__next-day { margin: 0; font-size: 1rem; font-weight: 500; color: #b5532f; }
.hp__next-title { margin: 14px 0 0; font-family: var(--serif); font-size: 1.25rem; font-weight: 500; line-height: 1.3; color: #16233b; }
.hp__next-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: auto 0 0; padding-top: 14px; }
.hp__after { position: relative; display: flex; flex-direction: column; margin: 0; padding: 6px 22px 6px 20px; list-style: none; background: #fff; border: 1px solid #c9d3e3; border-radius: 12px; }
.hp__after-row { position: relative; display: grid; grid-template-columns: 6.5rem 16px minmax(0, 1fr); align-items: center; column-gap: 14px; flex: 1; padding: 12px 0; }
.hp__after-row + .hp__after-row { border-top: 1px dashed #dbe3ef; }
.hp__after-when { display: flex; flex-direction: column; text-align: right; }
.hp__after-when b { font-family: var(--serif); font-size: 1rem; font-weight: 500; color: #16233b; }
.hp__after-when small { font-size: 0.8125rem; color: #55627a; }
.hp__after-dot { position: relative; z-index: 1; width: 12px; height: 12px; justify-self: center; background: #fff; border: 2px solid #1f3a68; border-radius: 50%; }
.hp__after-row::before { content: ""; position: absolute; top: 0; bottom: 0; left: calc(6.5rem + 14px + 8px - 0.5px); width: 1px; background: #c9d3e3; }
.hp__after-row + .hp__after-row::before { top: -1px; }
.hp__after-row:first-child::before { top: 50%; }
.hp__after-row:last-child::before { bottom: 50%; }
.hp__after-row:only-child::before { display: none; }
.hp__after-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.hp__after-title { overflow: hidden; font-size: 1rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; color: #16233b; }
.hp__after-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.hp__kind { padding: 2px 9px; border: 1px solid transparent; border-radius: 6px; font-size: 0.75rem; font-weight: 600; }
.hp__kind--appointment { background: #dbeafe; color: #1e40af; }
.hp__kind--family { background: #f6d8c6; color: #5a2a14; }
.hp__kind--work { background: #e5e7eb; color: #374151; }
.hp__kind--task { background: transparent; border-color: #9fb0cc; color: #374151; }
.hp__who2 { display: inline-flex; align-items: center; gap: 6px; font-size: 0.875rem; color: #55627a; }
.hp__who2-dots { display: inline-block; width: 14px; height: 14px; background: #dce6f2; border: 1.5px solid #5c7a9e; border-radius: 50%; }
.hp__who2-dots--partner { background: #f6d8c6; border-color: #e3a584; }
.hp__who2-dots--both { width: 22px; background: linear-gradient(90deg, #dce6f2 50%, #f6d8c6 50%); border-color: #8c97ab; border-radius: 999px; }
@media (max-width: 899px) { .hp__coming-grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 575px) { .hp__after-row { grid-template-columns: 5rem 14px minmax(0, 1fr); column-gap: 10px; } .hp__after-row::before { left: calc(5rem + 10px + 7px - 0.5px); } }

.hp__lcol .hp__us .hp__noteform { padding-top: 22px; }

/* Today as a hand-written rota: each part of the day is a slot with who is on, a wavy line under the current one */
.hp__slots { display: grid; grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr)); margin: 0 0 0 -17.5px; padding: 0; list-style: none; clip-path: inset(0 0 0 17.5px); }
.hp__slot { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; padding: 2px 16px 8px; border-left: 1.5px dashed #e3b3c4; }
.hp__slot-pic { display: grid; place-items: center; width: 38px; height: 38px; margin-bottom: 6px; }
.hp__slot-pic i { display: grid; place-items: center; width: 34px; height: 34px; border: 1.5px dashed #b48a98; border-radius: 50%; font-size: 0.9375rem; font-style: normal; color: #7b6670; }
.hp__slot-period { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #7b6670; }
.hp__slot-name { max-width: 100%; overflow: hidden; font-family: var(--serif); font-size: 1.5rem; font-weight: 500; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; color: #16233b; }
.hp__slot--open .hp__slot-name { font-family: inherit; font-size: 1rem; font-weight: 500; color: #7b6670; }
.hp__slot.is-current .hp__slot-time { font-size: 0.875rem; color: #55627a; }
.hp__slot-now { margin-top: 4px; font-size: 0.8125rem; font-weight: 700; color: #b5532f; }
@media (max-width: 575px) {
  .hp__slots { grid-template-columns: minmax(0, 1fr); }
  .hp__slot { display: grid; grid-template-columns: 44px minmax(0, 1fr); column-gap: 12px; align-items: center; padding: 10px 0; border-left: 0; border-top: 1.5px dashed #e3b3c4; }
  .hp__slot:first-child { border-top: 0; }
  .hp__slot-pic { grid-row: 1 / 5; margin: 0; }
  }

.hp__slot-edit { margin-top: 6px; padding: 0; background: none; border: 0; font-family: inherit; font-size: 0.875rem; font-weight: 600; color: #1f3a68; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.hp__slot-edit:hover { opacity: 0.8; }
.hp__slot-edit:focus-visible { outline: 2px solid #1f3a68; outline-offset: 3px; border-radius: 3px; }
.hp__cover { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; background: #fff; border: 1px solid #f0cfda; border-radius: 12px; }
.hp__cover-title { margin: 0; font-size: 0.9375rem; font-weight: 600; color: #16233b; }
.hp__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.hp__chip { padding: 8px 14px; background: #fff; border: 1px solid #c9d3e3; border-radius: 8px; font-family: inherit; font-size: 0.9375rem; font-weight: 500; color: #16233b; cursor: pointer; }
.hp__chip:hover { border-color: #1f3a68; }
.hp__chip:focus-visible { outline: 2px solid #1f3a68; outline-offset: 2px; }
.hp__chip.is-on { background: #1f3a68; border-color: #1f3a68; color: #fff; }
.hp__chip--small { padding: 5px 11px; font-size: 0.875rem; }

.hp__shifts { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.hp__shift-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 0.9375rem; color: #55627a; }
.hp__sel { padding: 7px 10px; background: #fff; border: 1px solid #c9d3e3; border-radius: 8px; font-family: inherit; font-size: 0.9375rem; color: #16233b; }
.hp__sel:focus-visible { outline: 2px solid #1f3a68; outline-offset: 2px; }
.hp__sel--who { min-width: 7.5rem; }
.hp__cover-foot { display: flex; align-items: center; gap: 16px; }

/* The painting strip: 24 hours, drag across them to say who is in charge */
.hp__paint { position: relative; padding-bottom: 22px; }
.hp__strip2 { position: relative; display: grid; grid-template-columns: repeat(24, minmax(0, 1fr)); height: 46px; overflow: hidden; border: 1px solid #c9d3e3; border-radius: 8px; touch-action: none; cursor: crosshair; user-select: none; }
.hp__hour { padding: 0; background: #f6f8fc; border: 0; border-right: 1px solid rgb(22 35 59 / 8%); cursor: inherit; }
.hp__hour:nth-child(3n + 1) { border-left: 1px solid rgb(22 35 59 / 16%); }
.hp__hour:focus-visible { outline: 2px solid #1f3a68; outline-offset: -2px; }
.hp__hour--me { background: #dce6f2; box-shadow: inset 0 -4px 0 #5c7a9e; }
.hp__hour--partner { background: #f6d8c6; box-shadow: inset 0 -4px 0 #e3a584; }
.hp__hour--both { background: linear-gradient(180deg, #dce6f2 50%, #f6d8c6 50%); }
.hp__hour--other { background: #d7e8dd; box-shadow: inset 0 -4px 0 #7aa38c; }
.hp__hour--open { background: repeating-linear-gradient(135deg, #f6f8fc 0 5px, #eaeff7 5px 10px); }
.hp__paint-now { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #b5532f; pointer-events: none; }
.hp__paint-hours { position: absolute; left: 0; right: 0; bottom: 0; height: 18px; }
.hp__paint-hours span { position: absolute; transform: translateX(-50%); font-size: 0.75rem; color: #55627a; white-space: nowrap; }
.hp__paint-hours span:first-child { transform: none; }
.hp__paint-hours span:last-child { transform: translateX(-100%); }
.hp__chip--other.is-on { background: #3f6b53; border-color: #3f6b53; }
.hp__cover-foot { justify-content: space-between; }

.hp__tonight-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; }
.hp__chip--plan { border-color: #1f3a68; background: #fff; font-weight: 600; color: #1f3a68; }
.hp__chip--plan:hover { background: #1f3a68; color: #fff; }

.hp__cover-actions { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 16px; }

.hp > .hp__car { --pad: max(clamp(16px, 4vw, 64px), calc((100vw - 1320px) / 2)); }

/* Row one holds the check-in, the note and the photo on the left, and Today and Coming up on the right, so both sides end together */
.hp__layout[aria-label="Today"] .hp__rcol .hp__coming { flex: 1 1 auto; }
.hp__layout[aria-label="Today"] .hp__rcol .hp__coming-grid { flex: 1 1 auto; }
.hp__layout[aria-label="Today"] .hp__lcol .fp { max-width: 100%; }

/* The reminder: one slim line near the top. "After that" is just the timeline now. */
.hp__remind { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 10px 16px; background: #fdf1e6; border: 1px solid #ecd3bd; border-radius: 12px; }
.hp__remind-bell { display: grid; flex: none; place-items: center; width: 34px; height: 34px; background: #fff; border: 1px solid #ecd3bd; border-radius: 50%; color: #b5532f; }
.hp__remind-text { display: flex; flex: 1 1 16rem; flex-wrap: wrap; align-items: baseline; gap: 2px 12px; min-width: 0; margin: 0; }
.hp__remind-text strong { font-size: 1rem; font-weight: 600; color: #b5532f; }
.hp__remind-title { font-family: var(--serif); font-size: 1.0625rem; font-weight: 500; color: #16233b; }
.hp__remind-sample { padding: 1px 8px; border: 1px dashed #b48a98; border-radius: 6px; font-size: 0.75rem; color: #7b6670; }
.hp__remind-link { margin-left: auto; }
.hp__coming-grid { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 575px) { .hp__remind-link { margin-left: 0; } }

/* ===== Crafted: every part is its own object, with a hand-made feel ===== */
.hp__lead { font-family: var(--serif); font-size: 1.25rem; line-height: 1.5; font-weight: 400; color: #3b4a66; }
.hp__title { position: relative; display: inline-block; }

/* the reminder is a tear-off ticket */
.hp__remind { position: relative; border-radius: 10px; border-style: dashed; border-width: 1.5px; border-color: #d9a98b; background: #fdf1e6; }
.hp__remind-bell { border-style: dashed; }

/* the note is a letter on ruled paper, with a stamp */
.hp__lcol .hp__us .hp__noteform { position: relative; padding: 20px 22px 16px; border-radius: 4px 14px 12px 10px; background: #fff7f9 repeating-linear-gradient(180deg, transparent 0 31px, #f2d3dd 31px 32px); box-shadow: none; }
.hp__lcol .hp__us .hp__noteform .hp__card-title { font-family: var(--serif); font-size: 1.375rem; font-weight: 500; line-height: 1.2; color: #16233b; }
.hp__lcol .hp__us .hp__noteform .hp__label { font-family: inherit; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #b5532f; }
.hp__lcol .hp__us .hp__noteform .hp__note-box { background: transparent repeating-linear-gradient(180deg, transparent 0 27px, #e3b3c4 27px 28px); border: 0; border-radius: 0; padding: 2px 0 0; font-family: inherit; font-size: 1rem; line-height: 28px; color: #16233b; }
.hp__lcol .hp__us .hp__noteform .hp__note-box::placeholder { color: #8b7a82; }
.hp__lcol .hp__us .hp__noteform .hp__note-box:focus { border: 0; box-shadow: none; outline: none; }
.hp__stamp { position: absolute; top: 14px; right: 16px; display: grid; place-items: center; width: 40px; height: 48px; background: #fff; border-radius: 2px; box-shadow: 0 0 0 3px #fff, 0 0 0 4.5px #e3a1b6; color: #e07a62; transform: rotate(5deg); }

/* Today is a day planner: punched holes down the side, handwritten names */
.hp__rcol .hp__card.hp__tonight { position: relative; padding-left: 52px; border-radius: 4px 18px 16px 4px; }
.hp__tonight::before { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 36px; background: radial-gradient(circle at 18px 50%, #ebf2fa 0 6px, #d9a7ba 6px 7.5px, transparent 8px) 0 0 / 36px 52px repeat-y; border-right: 1.5px dashed #ecc5d2; }
.hp__slot-name { font-family: var(--serif); font-size: 1.5rem; font-weight: 500; line-height: 1.2; color: #16233b; }
.hp__slot--open .hp__slot-name { font-family: inherit; font-size: 1rem; font-weight: 500; }
.hp__slot-period { font-family: inherit; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #8b6a78; }
.hp__slot-now { font-family: inherit; font-size: 0.8125rem; font-weight: 700; }

/* coming up: tear-off calendar leaves */
.hp__after { padding: 6px 20px; border-radius: 6px 16px 14px 10px; }
.hp__after-row { grid-template-columns: 64px minmax(0, 1fr); column-gap: 16px; }
.hp__after-row::before { display: none; }
.hp__leaf { display: flex; flex-direction: column; align-items: center; overflow: hidden; width: 64px; background: #fff; border: 1.5px solid #1f3a68; border-radius: 8px; box-shadow: 0 3px 0 -1px #c9d3e3; }
.hp__leaf i { align-self: stretch; padding: 2px 0; background: #b5532f; font-size: 0.75rem; font-style: normal; font-weight: 700; letter-spacing: 0.1em; text-align: center; text-transform: uppercase; color: #fff; }
.hp__leaf b { font-family: var(--serif); font-size: 1.5rem; font-weight: 500; line-height: 1; padding-top: 3px; color: #16233b; }
.hp__leaf small { padding-bottom: 3px; font-size: 0.75rem; color: #55627a; }
.hp__after-time { font-size: 0.875rem; font-weight: 600; color: #b5532f; }

/* the three boxes, each its own thing */
.hp__trio > .hp__trio-card { border-radius: 14px 20px 12px 18px / 18px 12px 20px 14px; }
.hp__trio-card--tasks { position: relative; background: #eef4e4; border-color: #bfd0a8; }
.hp__trio-card--tasks .hp__card-head { border-bottom: 1.5px dashed #bfd0a8; }
.hp__pin { position: absolute; top: -9px; left: 50%; width: 20px; height: 20px; margin-left: -10px; background: radial-gradient(circle at 35% 30%, #fff, #b5532f 62%); border-radius: 50%; box-shadow: 0 3px 4px rgb(0 0 0 / 30%); }
.hp__trio-card--log { background: #fff repeating-linear-gradient(180deg, transparent 0 35px, #dbe6f3 35px 36px); background-position: 0 56px; padding-left: 44px; }
.hp__trio-card--log::before { content: ""; position: absolute; top: 0; bottom: 0; left: 30px; width: 1.5px; background: #e7a79a; }
.hp__trio-card--log .hp__card-head { background: #fff; }
.hp__trio-card--log .hp__line { background: transparent; }
.hp__trio-card--log .hp__small { font-family: inherit; font-size: 0.875rem; color: #6b7790; }
.hp__trio-card--baby { background: #eaf3fc; border-color: #b9d2ec; }
.hp__trio-card--baby .hp__tally li { background: #fff; border-color: #cfe0f3; }
.hp__trio-card--baby .hp__qbtn { background: #fff; }

/* Today and the photo side by side; the next plans in one row underneath */
.hp__rtop { display: grid; grid-template-columns: minmax(0, 1fr) 250px; gap: var(--s3); align-items: start; }
.hp__rtop .fp { max-width: 250px; }
@media (max-width: 1199px) { .hp__rtop { grid-template-columns: minmax(0, 1fr); } .hp__rtop .fp { max-width: 260px; } }
.hp__after { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); align-content: center; gap: 0; padding: 12px 18px; }
.hp__after-row { flex: none; grid-template-columns: 56px minmax(0, 1fr); column-gap: 12px; padding: 4px 0; }
.hp__after-row + .hp__after-row { padding-left: 18px; border-top: 0; border-left: 1.5px dashed #dbe3ef; }
.hp__leaf { width: 56px; }
.hp__leaf b { font-size: 1.25rem; }

/* The reminder ticket in deep blue */
.hp__remind { background: #1f3a68; border-color: rgb(251 243 230 / 40%); }
.hp__remind-bell { background: rgb(251 243 230 / 10%); border-color: rgb(251 243 230 / 45%); color: #f6d8c6; }
.hp__remind-text .hp__label { color: #b3c4dc; }
.hp__remind-text strong { color: #ffb095; }
.hp__remind-title { color: #fbf3e6; }
.hp__remind .hp__who2 { color: #c3cfe4; }
.hp__remind .hp__kind--appointment { background: #dbeafe; color: #1e40af; }
.hp__remind .hp__kind--task { border-color: rgb(251 243 230 / 55%); color: #fbf3e6; }
.hp__remind-sample { border-color: rgb(251 243 230 / 45%); color: #c3cfe4; }
.hp__remind .hp__link, .hp__remind .hp__link:visited { color: #fbf3e6; }
.hp__remind .hp__link:focus-visible { outline-color: #f6d8c6; }

/* The page behind Home is a soft sky blue, so the words written straight on it are dark */
.hp__title { color: #16233b; }
.hp__lead { color: #24344f; }
.hp__coming { --fg: #16233b; --fg-muted: #24344f; --link: #16233b; }
.hp__coming-head .hp__label { color: #24344f; }
.hp__coming .hp__link, .hp__coming .hp__link:visited { color: #16233b; }
.hp__baby { color: #1b2a44; }
.hp__baby strong { color: #16233b; }

/* A little less zoomed in on a laptop at 100%: everything but the full-bleed carousel is drawn at 90% */
.hp > :not(.hp__car) { zoom: 0.9; }

/* Lately beside Today; the baby gets the bottom row to itself */
.hp__rtop { grid-template-columns: minmax(0, 1fr) 300px; }
.hp__rtop .hp__trio-card--log { padding: 18px 18px 18px 40px; }
.hp__rtop .hp__line--time { grid-template-columns: minmax(0, 1fr); gap: 0; }
.hp__trio { grid-template-columns: minmax(0, 1fr); }
.hp__trio-card--baby { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); align-items: center; column-gap: var(--s4); row-gap: var(--s2); }
.hp__trio-card--baby > .bs { grid-row: 1 / span 2; }
@media (max-width: 899px) { .hp__trio-card--baby { grid-template-columns: minmax(0, 1fr); } .hp__trio-card--baby > .bs { grid-row: auto; } }

/* "After that" uses the pale blue paper from the old page background */
.hp__coming { padding: 16px 20px 10px; background: #ebf2fa url("/bg-paper.jpg") 0 0 / 1472px 2616px; border: 1px solid #c9d3e3; border-radius: 6px 16px 14px 10px; }
.hp__coming .hp__after { padding: 4px 0 0; background: none; border: 0; border-radius: 0; }
.hp__coming-head .hp__label { color: #55627a; }

/* Lately: the same pale blue paper as Coming up */
.hp__trio-card--log { background: #ebf2fa url("/bg-paper.jpg") 0 0 / 1472px 2616px; border-color: #c9d3e3; }
.hp__trio-card--log::before { display: none; }
.hp__rtop .hp__trio-card--log { padding: 18px 20px; }
.hp__trio-card--log .hp__card-head { background: transparent; border-bottom: 1px solid #c9d3e3; }
.hp__trio-card--log .hp__line { border-color: #d3dcea; }

/* The baby box in deep blue */
.hp__trio > .hp__trio-card.hp__trio-card--baby { background: #1f3a68; border-color: #1f3a68; }
.hp__trio-card--baby .hp__tally li { background: rgb(251 243 230 / 10%); border-color: rgb(251 243 230 / 22%); }
.hp__trio-card--baby .hp__tally b { color: #fbf3e6; }
.hp__trio-card--baby .hp__tally span { color: #c3cfe4; }
.hp__trio-card--baby .hp__qbtn, .hp__trio-card--baby .hp__qbtn:visited { background: transparent; border-color: rgb(251 243 230 / 38%); color: #fbf3e6; }
.hp__trio-card--baby .hp__qbtn:hover { background: rgb(251 243 230 / 12%); border-color: #fbf3e6; color: #fff; }

/* Baby box: the picture on the left, the counts and the buttons stacked together in the middle of the right */
.hp__trio-card--baby { grid-template-rows: 1fr auto auto 1fr; row-gap: 14px; }
.hp__trio-card--baby > .bs { grid-column: 1; grid-row: 1 / -1; }
.hp__trio-card--baby > .hp__tally { grid-column: 2; grid-row: 2; }
.hp__trio-card--baby > .hp__quicklog { grid-column: 2; grid-row: 3; margin-top: 0; }
@media (max-width: 899px) {
  .hp__trio-card--baby { grid-template-rows: none; }
  .hp__trio-card--baby > .bs, .hp__trio-card--baby > .hp__tally, .hp__trio-card--baby > .hp__quicklog { grid-column: 1; grid-row: auto; }
}

/* The carousel: one full-bleed photograph, the quote laid over a navy scrim, a thin progress line along the bottom */
.hp__car { --pad: max(clamp(16px, 4vw, 64px), calc((100vw - 1080px) / 2)); position: relative; width: 100vw; height: clamp(240px, 26vh, 300px); margin: -32px 0 0 calc(50% - 50vw); overflow: hidden; background: #16233b; }
/* The container sets the height. The stage, photos and text sit inside it and never change it. */
.hp__car-stage { position: absolute; inset: 0; }
.hp__car-slide { position: absolute; inset: 0; display: flex; align-items: center; padding: 0 var(--pad); opacity: 0; visibility: hidden; transition: opacity 1.6s ease, visibility 0s linear 1.6s; isolation: isolate; }
.hp__car-slide.is-active { opacity: 1; visibility: visible; transition: opacity 1.6s ease, visibility 0s; }
/* The photograph fills the right half of the strip, zoomed in so the people are big, with only the top
   and bottom trimmed. Its left edge melts into the navy so there is no hard rectangle behind the words. */
.hp__car-photo { position: absolute; z-index: -2; top: 0; right: 0; width: 58%; height: 100%; object-fit: cover; -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 26%); mask-image: linear-gradient(90deg, transparent 0%, #000 26%); }
.hp__car-slide :deep(.art) { z-index: -2; }
.hp__car-copy { display: flex; flex-direction: column; gap: var(--s1, 8px); max-width: min(34rem, 46%); padding-bottom: 20px; color: #fbf3e6; transform: translateY(8px); transition: transform 1.6s ease; }
.hp__car-slide.is-active .hp__car-copy { transform: none; }
.hp__car-label { margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.14em; line-height: 1.4; text-transform: uppercase; color: #d9c7ab; }
.hp__car-text { margin: 0; font-family: "Fraunces", Georgia, serif; font-size: clamp(1.25rem, 1.9vw, 1.875rem); font-style: italic; font-weight: 300; line-height: 1.3; letter-spacing: -0.01em; color: #fbf3e6; text-wrap: balance; }
.hp__car-credit, .hp__car-credit:visited { position: absolute; right: var(--s2, 16px); bottom: 28px; font-size: 0.75rem; line-height: 1.5; color: rgb(251 243 230 / 70%); text-decoration: none; }
.hp__car-credit:hover, .hp__car-credit:focus-visible { color: #fff; text-decoration: underline; }

.hp__car-nav { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: flex-end; gap: var(--s2, 16px); padding: 0 var(--pad) 14px; pointer-events: none; }
.hp__car-nav > * { pointer-events: auto; }
.hp__car-ticks { display: flex; flex: 1; gap: 6px; }
.hp__tick-btn { flex: 1; padding: 10px 0; background: none; border: 0; cursor: pointer; }
.hp__tick-btn:focus-visible { outline: 2px solid #fbf3e6; outline-offset: 2px; }
.hp__tick-line { position: relative; display: block; height: 2px; overflow: hidden; background: rgb(251 243 230 / 24%); border-radius: 2px; transition: background-color 0.2s; }
.hp__tick-btn:hover .hp__tick-line { background: rgb(251 243 230 / 45%); }
.hp__tick-fill { position: absolute; inset: 0; background: #fbf3e6; transform-origin: left; transform: scaleX(0); animation: hp-tick linear forwards; }
.hp__tick-fill.is-held { animation-play-state: paused; }
@keyframes hp-tick { to { transform: scaleX(1); } }
.hp__car-pause { display: grid; place-items: center; width: 28px; height: 28px; margin-bottom: 4px; padding: 0; background: none; border: 0; border-radius: 50%; color: #fbf3e6; opacity: 0.5; cursor: pointer; transition: opacity 0.2s; }
.hp__car-pause:hover, .hp__car-pause:focus-visible { opacity: 1; }
.hp__car-pause:focus-visible { outline: 2px solid #fbf3e6; outline-offset: 2px; }

@media (max-width: 1099px) {
  .hp__car { margin-top: -24px; }
}
@media (max-width: 700px) {
    .hp__car { height: clamp(340px, 46vh, 400px); }
  .hp__car-slide { align-items: flex-end; padding-bottom: 36px; }
  .hp__car-photo { top: 0; right: 0; left: 0; width: 100%; max-width: 100%; height: 62%; -webkit-mask-image: linear-gradient(180deg, #000 55%, transparent 100%); mask-image: linear-gradient(180deg, #000 55%, transparent 100%); }
  .hp__car-copy { max-width: 100%; }
  .hp__car-text { font-size: 1.25rem; }
}
@media (prefers-reduced-motion: reduce) {
  .hp__car-slide, .hp__car-slide.is-active, .hp__car-copy { transition: none; }
  .hp__tick-fill { animation: none; transform: scaleX(1); }
}
</style>
