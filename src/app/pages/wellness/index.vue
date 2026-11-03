<script setup>
import "@/app/app.css";
import { computed, inject, nextTick, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import SuggestionArt from "@/app/components/SuggestionArt.vue";
import { NUDGES_KEY } from "@/app/composables/useNudges";
import { REPLIES } from "@/app/utils/askHelpers";
import { dateKey, useCheckinsStore } from "@/app/stores/checkins";
import { HOME_KEY } from "@/app/composables/useHome";
import {
  CLOSENESS,
  CONCERNS,
  ENERGY,
  LIFTS,
  MAX_CONCERNS,
  MOODS,
  NEED_OPTIONS,
  STRESS,
  kindWords,
  readingFor,
} from "@/app/data/wellness";
import { isHardCheckin, needsSupport } from "@/app/utils/loadHelpers";
import { SHARED_KEY } from "@/app/composables/useShared";
import { tonightDate } from "@/app/utils/homeSummary";
import { mondayOf, weekNights } from "@/app/utils/rotaHelpers";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "WellnessPage" });

/* The questions. The check-in is answered in sentences, not faces. Each sentence stands for the same 1 to 5 value
   the rest of the app already stores (mood, energy, stress, closeness), so nothing downstream changes. `sub` is a
   gentle second line that says what the sentence can look like. */
const MOOD_LINES = [
  { value: 1, label: "I need someone to take over.", sub: "I cannot do the next hour on my own." },
  { value: 2, label: "I'm barely hanging on.", sub: "Small things are tipping me over." },
  { value: 3, label: "I'm getting through it.", sub: "Not good, not bad. Just doing the next thing." },
  { value: 4, label: "Mostly good, with a few rough patches.", sub: "The hard parts came and went." },
  { value: 5, label: "I'm getting the hang of this.", sub: "There were moments I felt capable, even happy." },
];
const ENERGY_LINES = [
  { value: 1, label: "Past tired.", sub: "I cannot think straight, and I may feel shaky or tearful." },
  { value: 2, label: "Running on fumes.", sub: "I have forgotten to eat or drink, or I keep losing things." },
  { value: 3, label: "Foggy.", sub: "Simple decisions feel hard, and I lose my words." },
  { value: 4, label: "Tired, but coping.", sub: "Broken sleep, but I have eaten and had something to drink." },
  { value: 5, label: "Rested enough to think clearly.", sub: "I got a stretch of sleep or a proper break." },
];
const STRESS_LINES = [
  { value: 1, label: "Light.", sub: "Nothing is pressing today." },
  { value: 2, label: "One or two small things.", sub: "Things I could name and set aside." },
  { value: 3, label: "A fair amount, but manageable.", sub: "A list I could get through after a good night's sleep." },
  { value: 4, label: "A lot at once.", sub: "Everything feels equally urgent." },
  { value: 5, label: "Too much for one person.", sub: "I can no longer tell what matters most." },
];
const CLOSE_LINES = [
  { value: 1, label: "Far apart.", sub: "I feel alone in this, even with them here." },
  { value: 2, label: "A bit apart.", sub: "We are snappy, quiet, or keeping score." },
  { value: 3, label: "Side by side.", sub: "We are working in parallel, with little room for each other." },
  { value: 4, label: "Good, but we have had little time.", sub: "We feel connected, mostly through the logistics." },
  { value: 5, label: "Same team.", sub: "We have been kind to each other, and it has felt shared." },
];
// What each sentence says back. The point is to make the parent notice, not to grade them.
const SAYS_BACK = {
  mood: {
    1: "That is a heavy place to be, and you do not have to carry tonight alone. Asking someone to take over is the right move, and you can say exactly that.",
    2: "Barely hanging on usually means something needs to come off your plate, not that you need to try harder. What is one thing someone else could take today?",
    3: "Getting through it is real work, even when it does not look like much. What is one thing that would make the next hour a little lighter?",
    4: "Good with some rough patches is most days, and a decent place to be. Which patch was the roughest, and does it need anything?",
    5: "A day when it clicks is worth noticing. What made room for it, so you can do more of that?",
  },
  energy: {
    1: "Being past tired is your body asking for sleep, not for more willpower. Make rest the one job that matters today.",
    2: "Forgetting to eat or drink, or losing things, is what very little sleep does. It does not mean you are failing. What could you hand over so that you can rest?",
    3: "Fog is what missing sleep does. Write things down, and keep today's decisions small.",
    4: "Coping on broken sleep is a skill, and it has a limit. Protect your next stretch of sleep.",
    5: "A clear head is rare in these weeks. Is there one decision you have been putting off that you could settle now?",
  },
  stress: {
    1: "Not much in your head today. Notice what is making that possible.",
    2: "A small load. Which one is it, and does it need doing today?",
    3: "A fair load. Is any of it something that could wait until tomorrow?",
    4: "When it all arrives at once, the list in your head is the heaviest part. Say it out loud to someone, or write it down, and pick one thing to put down.",
    5: "When you cannot tell what matters most, that is a sign the load is too big, not that you are bad at this. Choose one thing to hand over today, and say it out loud to someone.",
  },
  closeness: {
    1: "Feeling alone in it, even with them there, is common when you are both running on empty, and it can change. Ten minutes together that is not about the baby helps more than one big talk.",
    2: "Snappy, quiet or keeping score usually means tired, not that something is wrong between you. What small thing would soften the next conversation: a thank you, a hug, a cup of tea together?",
    3: "Working in parallel is what these weeks do to a couple. One question that is not about the baby can change the feel of an evening.",
    4: "Connected through the logistics is still connected. Tell them. It means more than you think to hear it.",
    5: "Same team is worth saying out loud. Remember this feeling on the harder days.",
  },
};
// Deeper words for the concerns and for what gave something back. The saved values stay the same.
const CONCERN_WORDS = {
  exhausted: "Tiredness that sleep is not fixing",
  overwhelmed: "Too many things at once",
  anxious: "Worry that will not switch off",
  isolated: "Feeling alone in it",
  disconnected: "Distance between us",
  "body-image": "How my body looks and feels now",
  "provider-pressure": "Pressure to provide",
  "return-to-work": "Going back to work",
  pumping: "Feeding and pumping",
  "parenting-confidence": "Whether I am doing this right",
};
const LIFT_WORDS = {
  sleep: "A stretch of real sleep",
  food: "A meal I enjoyed",
  outside: "Fresh air or a walk",
  laugh: "A laugh",
  hug: "A hug",
  baby: "A moment with the baby that felt good",
  alone: "A little time to myself",
  friend: "Talking to someone who listens",
};
const CONCERN_ITEMS = CONCERNS.map((c) => ({ ...c, label: CONCERN_WORDS[c.value] ?? c.label }));
const LIFT_ITEMS = LIFTS.map((l) => ({ ...l, label: LIFT_WORDS[l.value] ?? l.label }));

/* Page */
const store = useCheckinsStore();
const home = inject(HOME_KEY, null);
const partnerName = computed(() => {
  const name = home?.partner?.value?.firstName || "";
  return name.charAt(0).toUpperCase() + name.slice(1);
});
const partnerFirst = computed(() => partnerName.value.split(" ")[0]);
const privacyLine = computed(() =>
  partnerName.value ? `You and ${partnerName.value} can both see your check-ins.` : "Your partner will see your check-ins once they join.",
);

// The chat between the two of you. "Message your partner" opens it.
const nudgeState = inject(NUDGES_KEY, null);
const today = dateKey(new Date());

// A check-in from the last 24 hours stands in for today's quiz. It is shown first, and the quiz
// is only reopened when the parent chooses to change their answers.
const existing = store.recent() ?? store.forDate(today);
const mood = ref(existing?.mood ?? null);
const energy = ref(existing?.energy ?? null);
const stress = ref(existing?.stress ?? null);
const body = ref([...(existing?.body ?? [])]);
const closeness = ref(existing?.closeness ?? null);
const concerns = ref([...(existing?.concerns ?? [])]);
const lifts = ref([...(existing?.lifts ?? [])]);
const need = ref(existing?.need ?? null);
const answers = () => ({
  mood: mood.value,
  energy: energy.value,
  stress: stress.value,
  closeness: closeness.value,
  body: [...body.value],
  concerns: [...concerns.value],
  lifts: [...lifts.value],
  need: need.value,
});

// "steps" is the check-in, "summary" the reading of the saved answers.
const view = ref(store.recent() ? "summary" : "steps");
const STEPS = ["light", "tank", "stones", "close", "weigh", "need", "review"];
const REQUIRED = { light: () => mood.value, stones: () => stress.value };
const step = ref(0);
const current = computed(() => STEPS[step.value]);
const isOptional = computed(() => !REQUIRED[current.value] && current.value !== "review");
const titles = computed(() => ({
  light: "If you answered honestly, how is today going?",
  tank: "What have the last 24 hours done to you?",
  stones: "How much is in your head right now?",
  close: partnerName.value ? `How connected do you feel to ${partnerName.value} right now?` : "How connected do you feel to your partner right now?",
  weigh: "What is taking up room, and what gave something back?",
  need: partnerName.value ? `If today is hard, what would help most from ${partnerName.value}?` : "If today is hard, what would help most?",
  review: "Here is today",
}));
const HINTS = {
  tank: "Sleep, food and water change more than anything else in these weeks.",
  stones: "Not only the jobs. The list in your head, the worry, the feeling that you have forgotten something.",
  close: "Think about the last time you really talked, and not about the baby.",
  weigh: "Pick what fits, up to three on the left. It is fine if nothing gave anything back yet.",
  need: "Optional. It only shapes the suggestion your partner sees. If you skip it, we assume a kind check-in.",
  review: "Look it over. Tap any part to change it.",
};

const error = ref("");
const heading = ref(null);
async function go(index) {
  view.value = "steps";
  step.value = Math.max(0, Math.min(STEPS.length - 1, index));
  error.value = "";
  await nextTick();
  heading.value?.focus();
}
function next() {
  const need = REQUIRED[current.value];
  if (need && !need()) {
    error.value = "Choose one to carry on.";
    return;
  }
  go(step.value + 1);
}
const goTo = (id) => go(STEPS.indexOf(id));

// The four sentence questions share one set of choices.
const STATEMENTS = computed(() => ({
  light: { list: MOOD_LINES, label: "Today" },
  tank: { list: ENERGY_LINES, label: "The last 24 hours" },
  stones: { list: STRESS_LINES, label: "The load" },
  close: { list: CLOSE_LINES, label: "The two of you" },
})[current.value] ?? null);
// How good or hard an answer is, from 1 (hardest) to 5 (best). For "how much is in your head" a high number is the hard end.
const toneOf = (value) => (current.value === "stones" ? 6 - value : value);
// Good at the top, hard at the bottom, for every question. "How much is in your head" counts the other way (1 is light),
// so its list runs from 1 down, while the others run from 5 down.
const orderedLines = computed(() => (STATEMENTS.value ? (current.value === "stones" ? [...STATEMENTS.value.list] : highFirst(STATEMENTS.value.list)) : []));
const lineValue = computed(() => ({ light: mood.value, tank: energy.value, stones: stress.value, close: closeness.value })[current.value] ?? null);
function setLine(value) {
  if (current.value === "light") mood.value = value;
  else if (current.value === "tank") energy.value = value;
  else if (current.value === "stones") stress.value = value;
  else if (current.value === "close") closeness.value = value;
}

// Took and gave
const atLimit = computed(() => concerns.value.length >= MAX_CONCERNS);
const flip = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
const toggleConcern = (value) => {
  concerns.value = flip(concerns.value, value);
};
const toggleLift = (value) => {
  lifts.value = flip(lifts.value, value);
};

// What the current step says back.
const reflection = computed(() => {
  switch (current.value) {
    case "light":
      return mood.value ? SAYS_BACK.mood[mood.value] : "";
    case "tank":
      return energy.value ? SAYS_BACK.energy[energy.value] : "";
    case "stones":
      return stress.value ? SAYS_BACK.stress[stress.value] : "";
    case "close":
      return closeness.value ? SAYS_BACK.closeness[closeness.value] : "";
    case "weigh":
      if (lifts.value.length) return "Hold on to that. Small things are the ones you can repeat tomorrow.";
      return concerns.value.length ? "Nothing gave back yet? Then plan one small thing on purpose for tomorrow." : "";
    default:
      return "";
  }
});

const labelOf = (list, value) => list.find((o) => o.value === value)?.label ?? "";
const labelsOf = (list, values) => values.map((v) => labelOf(list, v)).filter(Boolean).join(", ");
const kind = computed(() => kindWords(answers()));

// Saving, then the summary.
const savedEntry = ref(existing);
const savedDay = computed(() => {
  const at = savedEntry.value?.savedAt ? new Date(savedEntry.value.savedAt) : null;
  return at && !Number.isNaN(at.getTime()) ? at.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "Today";
});
const savedTime = computed(() => {
  const at = savedEntry.value?.savedAt ? new Date(savedEntry.value.savedAt) : null;
  return at && !Number.isNaN(at.getTime()) ? at.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" }) : "";
});
const done = ref([]);
const summaryHeading = ref(null);
async function showSummary() {
  view.value = "summary";
  done.value = [];
  await nextTick();
  summaryHeading.value?.focus();
}
const saveNote = computed(() => store.error);

async function save() {
  if (!mood.value || !stress.value) {
    goTo(!mood.value ? "light" : "stones").then(() => {
      error.value = "Choose one to carry on.";
    });
    return;
  }
  error.value = "";
  const entry = store.save(answers());
  savedEntry.value = entry;
  // What you asked for is sent to your partner as a message in the household stream, once per answer.
  if (need.value && partnerName.value && !isAsked(need.value)) sendAsk(need.value, entry);

  await showSummary();
}

// Hydrate from the household once it has loaded: a check-in made on another device, or before a
// refresh, means this parent has already done today's quiz.
let pristine = true;
let adopted = Boolean(store.recent());
watch([mood, energy, stress, body, closeness, concerns, lifts], () => (pristine = false), { deep: true });
watch(
  () => store.loaded,
  (isLoaded) => {
    const entry = isLoaded ? store.recent() : null;
    if (!entry || adopted || !pristine || view.value !== "steps") return;
    adopted = true;
    mood.value = entry.mood;
    energy.value = entry.energy;
    stress.value = entry.stress;
    body.value = [...entry.body];
    closeness.value = entry.closeness;
    concerns.value = [...entry.concerns];
    lifts.value = [...entry.lifts];
    need.value = entry.need ?? null;
    savedEntry.value = entry;
    showSummary();
  },
  { immediate: true },
);

const supportNeeded = computed(() => needsSupport(store.lastSeven(new Date()), new Date()));

const days = computed(() => store.lastSeven(new Date()));
const logged = computed(() => days.value.filter((d) => d.entry));

const reading = computed(() => {
  if (!savedEntry.value) return null;
  const earlier = logged.value.filter((d) => d.date !== today).map((d) => d.entry);
  return readingFor(savedEntry.value, { partner: partnerName.value, earlier });
});
const toggleDone = (id) => {
  done.value = flip(done.value, id);
};

// Today's report for each of you: the check-in each person made today, in words.
function reportFor(entry) {
  if (!entry) return null;
  const at = entry.savedAt ? new Date(entry.savedAt) : null;
  return {
    time: at && !Number.isNaN(at.getTime()) ? at.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" }) : "",
    mood: labelOf(MOODS, entry.mood),
    rows: [
      { name: "Energy", value: labelOf(ENERGY, entry.energy) },
      { name: "Carrying", value: labelOf(STRESS, entry.stress) },
      { name: "With each other", value: labelOf(CLOSENESS, entry.closeness) },
    ].filter((row) => row.value),
    took: labelsOf(CONCERN_ITEMS, entry.concerns ?? []),
    gave: labelsOf(LIFT_ITEMS, entry.lifts ?? []),
    need: labelOf(NEED_OPTIONS, entry.need),
    hard: isHardCheckin(entry),
  };
}
const todayReports = computed(() => [
  { key: "me", name: "You", report: reportFor(store.forDate(today)) },
  { key: "partner", name: partnerFirst.value || "Your partner", report: reportFor(store.partnerItems?.[today]) },
]);


/* What you asked your partner for. Saving the check-in sends it to the household stream, where it shows on Home
   with the coral dot until they answer it. The record of what was sent lives on this device so it is never sent twice. */
const shared = inject(SHARED_KEY, null);
const rota = shared?.rota ?? null;
const myUid = computed(() => home?.me?.value?.uid ?? "");
const storeKey = (name) => `nt.app.wl.${name}:${myUid.value || "guest"}`;
const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the page still works, it just forgets */
  }
};
// What has been sent today, per kind of ask: { date, sent: { coverTonight: "2026-11-03T13:21:00Z", ... } }. Asks add up, so
// picking a second one never takes the first back.
function loadAsks() {
  const raw = readJson(storeKey("ask"));
  if (!raw || raw.date !== today) return { date: today, sent: {} };
  if (raw.sent) return raw;
  return { date: today, sent: raw.need ? { [raw.need]: raw.at } : {} };
}
const askSent = ref(loadAsks());
const isAsked = (value) => Boolean(askSent.value.sent[value]);
const clockOf = (iso) => (iso ? new Date(iso).toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" }) : "");
const askProblem = ref("");
const sendingAsk = ref(false);
const NEED_STORY = {
  coverTonight: { title: "Take over tonight", line: "take over tonight so I can rest?" },
  checkOnMe: { title: "Check on me", line: "check in on me today? A kind message would help." },
  giveSpace: { title: "Give me space", line: "give me some quiet for a while, with no questions yet? I will tell you when I am ready." },
};
const lower = (text) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : "");
function askText(entry, value) {
  const parts = [`Could you ${NEED_STORY[value]?.line ?? "check in on me?"}`];
  parts.push(`Today: "${labelOf(MOOD_LINES, entry.mood)}"`);
  const took = labelsOf(CONCERN_ITEMS, entry.concerns ?? []);
  if (took) parts.push(`Taking up room: ${lower(took)}.`);
  // The chat takes up to 200 characters.
  const text = parts.join(" ");
  return text.length <= 200 ? text : `${text.slice(0, 197).trimEnd()}...`;
}
// Asks go into the chat between the two of you. That shows the message on your partner's Home, lights their bell, and sends
// them a push alert. A request to take over a night is a real request in the sleep rota instead, which has its own alert.
const sendChat = async (text) => {
  if (!nudgeState) return false;
  const ok = await nudgeState.send(text);
  if (!ok) askProblem.value = nudgeState.writeError || "That did not send. Try again in a moment.";
  return ok;
};
async function sendAsk(value, entry = savedEntry.value) {
  if (!value || !entry || sendingAsk.value) return false;
  sendingAsk.value = true;
  askProblem.value = "";
  const handOver = value === "coverTonight" && Boolean(rota?.settings && myHoursTonight.value);
  const ok = handOver ? await requestCover() : await sendChat(askText(entry, value));
  sendingAsk.value = false;
  if (!ok) return false;
  askSent.value = { date: today, sent: { ...askSent.value.sent, [value]: new Date().toISOString() } };
  writeJson(storeKey("ask"), askSent.value);
  return true;
}
// Everything asked today, in the order of the options.
const askedList = computed(() => NEED_OPTIONS.filter((o) => isAsked(o.value)).map((o) => ({ ...o, time: clockOf(askSent.value.sent[o.value]) })));
// Tapping another option saves the check-in again with it and sends that ask too. Ones already sent stay sent.
async function changeAsk(value) {
  if (isAsked(value) || !partnerName.value) return;
  need.value = value;
  const entry = store.save(answers());
  savedEntry.value = entry;
  await sendAsk(value, entry);
}

// Tonight, 6 PM to 6 AM: the hours you hold, and whether your partner has offered to cover them.
const tonight = computed(() => {
  if (!rota?.settings) return null;
  const view = rota.view;
  const date = tonightDate(new Date(), view.handoverTime);
  const night = weekNights(view, mondayOf(date)).find((x) => x.date === date);
  return { date, night };
});
const hoursOf = (who) => {
  const night = tonight.value?.night;
  if (!night || (night.who !== "me" && night.who !== "partner")) return "";
  const first = night.who === who;
  if (!night.shared) return first ? "6 PM to 6 AM" : "";
  return first ? "6 PM to 12 AM" : "12 AM to 6 AM";
};
const myHoursTonight = computed(() => hoursOf("me"));
const offersToMe = computed(() => (rota?.pending ?? []).filter((x) => x.from !== myUid.value && !x.date && (!x.to || x.to === myUid.value)));
/* Taking over tonight is a real request in the sleep rota (a swap with nothing in return), so your partner can accept or decline
   it, and accepting puts them on tonight's night. Both of you get a push alert, sent by the rota store. */
const partnerUid = computed(() => home?.partner?.value?.uid ?? "");
function coverSwapFrom(uid) {
  if (!rota || !tonight.value || !uid) return null;
  const mine = [...(rota.pending ?? []), ...(rota.history ?? [])].filter((x) => x.from === uid && x.date === tonight.value.date && !x.withDate);
  const stamp = (x) => x.createdAt?.toMillis?.() ?? Date.now();
  return mine.sort((a, b) => stamp(b) - stamp(a))[0] ?? null;
}
const myCoverSwap = computed(() => coverSwapFrom(myUid.value));
const theirCoverSwap = computed(() => coverSwapFrom(partnerUid.value));
let coverBusy = false;
async function requestCover(again = false) {
  if (coverBusy || !rota?.settings || !tonight.value || !myHoursTonight.value) return false;
  const open = myCoverSwap.value;
  if (open && !(again && open.status === "declined")) return true;
  coverBusy = true;
  askProblem.value = "";
  const ok = await rota.requestSwap({ date: tonight.value.date, withDate: null, message: "" });
  if (!ok) askProblem.value = rota.writeError || "That did not send. Try again in a moment.";
  coverBusy = false;
  return ok;
}
async function answerCover(accept) {
  const swap = theirCoverSwap.value;
  if (!swap || swap.status !== "pending") return;
  askProblem.value = "";
  const ok = await rota.respondSwap(swap.id, accept);
  if (!ok) {
    askProblem.value = rota.writeError || "That did not send. Try again in a moment.";
    return;
  }
  await sendChat(accept ? REPLIES.coverTonight : REPLIES.coverDeclined);
  if (theirAsk.value) {
    replied.value = { ...replied.value, [theirAsk.value.key]: new Date().toISOString() };
    writeJson(storeKey("reply"), replied.value);
  }
}

async function answerOffer(offer, accept) {
  askProblem.value = "";
  const ok = await rota.respondSwap(offer.id, accept);
  if (!ok) askProblem.value = rota.writeError || "That did not send. Try again in a moment.";
  else if (accept) store.resetStage(new Date());
}

/* The other way round: what your partner asked of you today, with the one action that answers it. */
const theirAsk = computed(() => {
  if (!partnerName.value) return null;
  let best = null;
  for (const entry of Object.values(store.partnerItems ?? {})) {
    const at = new Date(entry.savedAt).getTime();
    if (Number.isNaN(at) || Date.now() - at > 24 * 3600 * 1000 || !NEED_STORY[entry.need]) continue;
    // Skipping the question saves "check on me", so that one only counts as an ask on a hard day.
    if (entry.need === "checkOnMe" && !isHardCheckin(entry)) continue;
    if (!best || at > new Date(best.savedAt).getTime()) best = entry;
  }
  if (!best) return null;
  const range = hoursOf("partner");
  const key = `${best.date}:${best.need}`;
  return {
    entry: best,
    key,
    need: best.need,
    mood: labelOf(MOOD_LINES, best.mood),
    energy: best.energy ? labelOf(ENERGY_LINES, best.energy) : "",
    took: labelsOf(CONCERN_ITEMS, best.concerns ?? []),
    range,
    when: new Date(best.savedAt).toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" }),
  };
});
const replied = ref(readJson(storeKey("reply")) ?? {});
const offered = computed(() => (rota?.pending ?? []).some((x) => x.from === myUid.value && !x.date));
async function answerAsk(kindOfAnswer) {
  const ask = theirAsk.value;
  if (!ask) return;
  askProblem.value = "";
  if (kindOfAnswer === "offer") {
    if (!rota?.settings || offered.value) return;
    const ok = await rota.requestSwap({ date: null, withDate: tonight.value.date, message: "" });
    if (!ok) {
      askProblem.value = rota.writeError || "That did not send. Try again in a moment.";
      return;
    }
  }
  if (!(await sendChat(REPLIES[ask.need]))) return;
  replied.value = { ...replied.value, [ask.key]: new Date().toISOString() };
  writeJson(storeKey("reply"), replied.value);
}
const askAnswered = computed(() => Boolean(theirAsk.value && replied.value[theirAsk.value.key]));

const highFirst = (list) => [...list].reverse();

const meters = computed(() => {
  const e = savedEntry.value;
  if (!e) return [];
  return [
    { key: "energy", name: "Energy", value: e.energy, word: labelOf(ENERGY_LINES, e.energy) },
    { key: "stress", name: "In your head", value: e.stress, word: labelOf(STRESS_LINES, e.stress), load: true },
    { key: "close", name: `With ${partnerFirst.value || "your partner"}`, value: e.closeness, word: labelOf(CLOSE_LINES, e.closeness) },
  ];
});
</script>

<template>
  <div class="wl">
    <header class="wl__banner-hero">
      <p class="wl__eyebrow">Daily check-in</p>
      <h1 class="wl__h1">Wellness</h1>
      <p class="wl__lead">A few minutes to notice how you really are.</p>
      <p class="wl__pill"><span class="wl__pill-dot" aria-hidden="true"></span>{{ privacyLine }}</p>
    </header>

    <div v-if="supportNeeded" class="wl__banner" role="status">
      <p class="wl__banner-text">
        Your last few check-ins have been hard. You do not have to carry this alone, and this is not a diagnosis.
      </p>
      <AppButton variant="outline" size="md" :to="ROUTES.SUPPORT">See support options</AppButton>
    </div>

    <!-- What your partner asked of you today, with the one action that answers it -->
    <section v-if="theirAsk" class="wl__card wl__asked" :class="{ 'is-answered': askAnswered }" aria-labelledby="wl-asked">
      <p class="wl__label">{{ partnerFirst }} asked you for something · {{ theirAsk.when }}</p>
      <h2 id="wl-asked" class="nt-heading wl__sec">
        {{ theirAsk.need === "coverTonight" ? `${partnerFirst} needs you to take over tonight` : theirAsk.need === "giveSpace" ? `${partnerFirst} needs some space` : `${partnerFirst} would like you to check in` }}
      </h2>
      <ul class="wl__asked-facts">
        <li><strong>Today</strong> {{ theirAsk.mood }}</li>
        <li v-if="theirAsk.energy"><strong>The last 24 hours</strong> {{ theirAsk.energy }}</li>
        <li v-if="theirAsk.took"><strong>Taking up room</strong> {{ theirAsk.took }}</li>
        <li v-if="theirAsk.need === 'coverTonight' && theirAsk.range"><strong>Their hours tonight</strong> {{ theirAsk.range }}</li>
      </ul>
      <template v-if="theirAsk.need === 'coverTonight' && theirCoverSwap">
        <div v-if="theirCoverSwap.status === 'pending'" class="wl__asked-actions">
          <AppButton variant="primary" size="md" type="button" @click="answerCover(true)">Accept, take tonight</AppButton>
          <AppButton variant="outline" size="md" type="button" @click="answerCover(false)">Decline</AppButton>
          <router-link class="app-link" :to="ROUTES.ROTA">Open the sleep rota</router-link>
        </div>
        <p v-else-if="theirCoverSwap.status === 'accepted'" class="wl__asked-done" role="status">You are taking tonight. The sleep rota now shows you on, and {{ partnerFirst }} has been told.</p>
        <p v-else class="wl__asked-done" role="status">You said no to tonight, and {{ partnerFirst }} has been told.</p>
      </template>
      <p v-else-if="askAnswered" class="wl__asked-done" role="status">You answered, and {{ partnerFirst }} can see it.</p>
      <div v-else class="wl__asked-actions">
        <AppButton v-if="theirAsk.need === 'coverTonight' && theirAsk.range && rota?.settings" variant="primary" size="md" type="button" :disabled="offered" @click="answerAsk('offer')">
          {{ offered ? `Offer sent. Waiting for ${partnerFirst}` : `Take tonight, ${theirAsk.range}` }}
        </AppButton>
        <AppButton v-else variant="primary" size="md" type="button" @click="answerAsk('reply')">
          {{ theirAsk.need === "coverTonight" ? `Tell ${partnerFirst} you have got tonight` : theirAsk.need === "giveSpace" ? "Tell them you will give space" : "Send a kind message" }}
        </AppButton>
        <router-link v-if="theirAsk.need === 'coverTonight'" class="app-link" :to="ROUTES.ROTA">Open the sleep rota</router-link>
      </div>
      <p v-if="askProblem" class="app-error-text" role="alert">{{ askProblem }}</p>
    </section>

    <!-- The check-in -->
    <form
      v-if="view === 'steps'"
      class="wl__box"
      aria-labelledby="wl-step-title"
      novalidate
      @submit.prevent="current === 'review' ? save() : next()"
    >
      <div class="wl__top">
        <section v-if="partnerName" class="wl__sbs" aria-labelledby="wl-day">
          <h2 id="wl-day" class="nt-heading wl__h">Today, side by side</h2>
          <p class="wl__sbs-sub">A short report from each of you. It fills in as you both check in.</p>
          <div class="wl__sbs-grid">
            <article v-for="p in todayReports" :key="p.key" class="wl__sbs-card" :class="[`wl__sbs-card--${p.key}`, { 'is-hard': p.report && p.report.hard }]">
              <header class="wl__sbs-head">
                <span class="wl__sbs-avatar" aria-hidden="true">{{ p.name.charAt(0) }}</span>
                <div>
                  <p class="wl__sbs-name">{{ p.name }}</p>
                  <p class="wl__sbs-time">{{ p.report ? `Checked in${p.report.time ? ` at ${p.report.time}` : ""}` : "No check-in yet today" }}</p>
                </div>
              </header>
              <template v-if="p.report">
                <p class="wl__sbs-mood">Feeling {{ p.report.mood.toLowerCase() }}</p>
                <dl class="wl__sbs-rows">
                  <div v-for="row in p.report.rows" :key="row.name">
                    <dt>{{ row.name }}</dt>
                    <dd>{{ row.value }}</dd>
                  </div>
                </dl>
                <p v-if="p.report.took" class="wl__sbs-line"><strong>Took the most</strong> {{ p.report.took }}</p>
                <p v-if="p.report.gave" class="wl__sbs-line"><strong>Gave a little back</strong> {{ p.report.gave }}</p>
                <p v-if="p.report.need" class="wl__sbs-line"><strong>Would help</strong> {{ p.report.need }}</p>
              </template>
              <p v-else class="wl__sbs-empty">Nothing to read yet.</p>
            </article>
          </div>
        </section>

        <p class="wl__label">{{ partnerName ? `Shared with ${partnerName}` : "Daily check-in" }}</p>
        <p class="wl__count-step">{{ step + 1 }} of {{ STEPS.length }}</p>
      </div>
      <div class="wl__progress" aria-hidden="true"><span :style="{ width: `${((step + 1) / STEPS.length) * 100}%` }" /></div>

      <p v-if="savedEntry && step === 0" class="wl__earlier">
        You checked in today{{ savedTime ? ` at ${savedTime}` : "" }}. Going through it again replaces it.
        <button type="button" class="app-textbtn" @click="showSummary">Read today's summary</button>
      </p>

      <h2 id="wl-step-title" ref="heading" class="nt-heading wl__question" tabindex="-1">{{ titles[current] }}</h2>
      <p v-if="HINTS[current]" class="wl__hint">{{ HINTS[current] }}</p>

      <!-- 1 to 3 and 5. The sentence questions: pick the line that is closest to today -->
      <div v-if="STATEMENTS" class="wl__picks" role="radiogroup" :aria-label="STATEMENTS.label">
        <button
          v-for="o in orderedLines"
          :key="o.value"
          type="button"
          role="radio"
          class="wl__pick"
          :class="`wl__pick--tone${toneOf(o.value)}`"
          :aria-checked="lineValue === o.value ? 'true' : 'false'"
          @click="setLine(o.value)"
        >
          <span class="wl__pick-mark" aria-hidden="true"></span>
          <span class="wl__pick-text">{{ o.label }}<span v-if="o.sub" class="wl__pick-sub">{{ o.sub }}</span></span>
        </button>
      </div>

      <!-- 6. What took and what gave -->
      <div v-else-if="current === 'weigh'" class="wl__weigh">
        <fieldset class="wl__group">
          <legend class="wl__legend">
            Taking up room
            <span class="wl__muted-inline">Pick up to {{ MAX_CONCERNS }}</span>
          </legend>
          <div class="wl__chips" role="group" aria-label="Taking up room">
            <button
              v-for="c in CONCERN_ITEMS"
              :key="c.value"
              type="button"
              class="app-chip"
              :aria-pressed="concerns.includes(c.value) ? 'true' : 'false'"
              :disabled="atLimit && !concerns.includes(c.value)"
              @click="toggleConcern(c.value)"
            >
              {{ c.label }}
            </button>
          </div>
        </fieldset>
        <fieldset class="wl__group">
          <legend class="wl__legend">Gave something back</legend>
          <div class="wl__chips" role="group" aria-label="Gave a little back">
            <button
              v-for="l in LIFT_ITEMS"
              :key="l.value"
              type="button"
              class="app-chip"
              :aria-pressed="lifts.includes(l.value) ? 'true' : 'false'"
              @click="toggleLift(l.value)"
            >
              {{ l.label }}
            </button>
          </div>
        </fieldset>
      </div>

      <!-- 7. What would help -->
      <div v-else-if="current === 'need'" class="wl__options wl__options--wide" role="radiogroup" aria-label="What would help most">
        <button
          v-for="o in NEED_OPTIONS"
          :key="o.value"
          type="button"
          role="radio"
          class="wl__option"
          :aria-checked="need === o.value ? 'true' : 'false'"
          @click="need = need === o.value ? null : o.value"
        >
          <span class="wl__option-label">{{ o.label }}</span>
          <span class="wl__option-sub">{{ o.sub }}</span>
        </button>
      </div>

      <!-- 8. Review -->
      <div v-else class="wl__review">
        <ul class="wl__ledger">
          <li>
            <button type="button" class="wl__tile" @click="goTo('light')">
              <span class="wl__tile-text">
                <span class="wl__tile-name">Today</span>
                <span class="wl__tile-value">{{ labelOf(MOOD_LINES, mood) || "Not answered" }}</span>
              </span>
              <span class="wl__change">Change</span>
            </button>
          </li>
          <li>
            <button type="button" class="wl__tile" @click="goTo('tank')">
              <span class="wl__tile-text">
                <span class="wl__tile-name">The last 24 hours</span>
                <span class="wl__tile-value" :class="{ 'is-skipped': !energy }">{{ labelOf(ENERGY_LINES, energy) || "Skipped" }}</span>
              </span>
              <span class="wl__change">Change</span>
            </button>
          </li>
          <li>
            <button type="button" class="wl__tile" @click="goTo('stones')">
              <span class="wl__tile-text">
                <span class="wl__tile-name">In my head</span>
                <span class="wl__tile-value">{{ labelOf(STRESS_LINES, stress) || "Not answered" }}</span>
              </span>
              <span class="wl__change">Change</span>
            </button>
          </li>
          <li>
            <button type="button" class="wl__tile" @click="goTo('close')">
              <span class="wl__tile-text">
                <span class="wl__tile-name">With {{ partnerFirst || "your partner" }}</span>
                <span class="wl__tile-value" :class="{ 'is-skipped': !closeness }">{{ labelOf(CLOSE_LINES, closeness) || "Skipped" }}</span>
              </span>
              <span class="wl__change">Change</span>
            </button>
          </li>
          <li>
            <button type="button" class="wl__tile" @click="goTo('weigh')">
              <span class="wl__tile-text">
                <span class="wl__tile-name">Taking up room</span>
                <span class="wl__tile-value" :class="{ 'is-skipped': !concerns.length }">{{ labelsOf(CONCERN_ITEMS, concerns) || "Nothing picked" }}</span>
                <span class="wl__tile-name wl__tile-name--gap">Gave something back</span>
                <span class="wl__tile-value" :class="{ 'is-skipped': !lifts.length }">{{ labelsOf(LIFT_ITEMS, lifts) || "Nothing yet" }}</span>
              </span>
              <span class="wl__change">Change</span>
            </button>
          </li>
          <li>
            <button type="button" class="wl__tile" @click="goTo('need')">
              <span class="wl__tile-text">
                <span class="wl__tile-name">If today is hard</span>
                <span class="wl__tile-value" :class="{ 'is-skipped': !need }">{{ labelOf(NEED_OPTIONS, need) || "Check on me (the default)" }}</span>
              </span>
              <span class="wl__change">Change</span>
            </button>
          </li>
        </ul>
        <p class="nt-heading wl__kind">{{ kind }}</p>
      </div>

      <p v-if="reflection" class="wl__reflect" aria-live="polite">{{ reflection }}</p>
      <p v-if="error" class="app-error-text" role="alert">{{ error }}</p>

      <div class="wl__nav">
        <button v-if="step > 0" type="button" class="app-textbtn wl__back" @click="go(step - 1)">Back</button>
        <span class="wl__spacer" />
        <template v-if="current === 'review'">
          <router-link class="app-link" :to="ROUTES.HOME">Not now</router-link>
          <AppButton size="md" type="submit">Save check-in</AppButton>
        </template>
        <template v-else>
          <button v-if="isOptional" type="button" class="app-textbtn" @click="go(step + 1)">Skip</button>
          <AppButton variant="outline" size="md" type="submit">Next</AppButton>
        </template>
      </div>
    </form>

    <!-- The summary, after saving: one card per question the parent is likely to ask. -->
    <div v-else-if="reading" class="wl__summary">
      <!-- 1. The headline: the answer you gave, then three readings and what shaped the day -->
      <div class="wl__sum">
      <section class="wl__sh" aria-labelledby="wl-summary-title">
        <h2 id="wl-summary-title" ref="summaryHeading" class="visually-hidden" tabindex="-1">What today says</h2>
        <div class="wl__sh-top">
          <p class="wl__sh-when" role="status">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
            Checked in {{ savedDay }}{{ savedTime ? `, ${savedTime}` : "" }}
          </p>
          <button type="button" class="wl__sh-link" @click="goTo('review')">Change answers</button>
        </div>
        <p class="wl__sh-eyebrow">Today, in your words</p>
        <p class="wl__sh-quote">&ldquo;{{ labelOf(MOOD_LINES, savedEntry.mood) }}&rdquo;</p>
        <p class="wl__sh-note">{{ partnerName ? `${partnerName} can see this.` : "Your partner will see this once they join." }}</p>
        <p v-if="saveNote" class="app-error-text" role="alert">{{ saveNote }}</p>

      </section>

      <!-- 1a. The readings, on the cream half of the same card -->
      <section class="wl__rd" aria-label="Your answers at a glance">
        <ul class="wl__rd-grid">
          <li v-for="m in meters" :key="m.key" class="wl__rd-card" :class="{ 'is-load': m.load }">
            <span class="wl__rd-name">{{ m.name }}</span>
            <span class="wl__rd-word" :class="{ 'is-skipped': !m.value }">{{ m.value ? m.word : "Skipped" }}</span>
            <span class="wl__rd-dots" aria-hidden="true">
              <span v-for="n in 5" :key="n" class="wl__rd-dot" :class="{ 'is-on': m.value && n <= m.value }" />
            </span>
            <span class="visually-hidden">{{ m.value ? `${m.value} of 5` : "" }}</span>
          </li>
        </ul>
        <div v-if="savedEntry.concerns.length || savedEntry.lifts.length" class="wl__rd-tags">
          <div v-if="savedEntry.concerns.length" class="wl__rd-tagbox wl__rd-tagbox--took">
            <p class="wl__rd-name">Took the most</p>
            <p class="wl__rd-chips"><span v-for="c in savedEntry.concerns" :key="c" class="wl__rd-chip">{{ labelOf(CONCERN_ITEMS, c) }}</span></p>
          </div>
          <div v-if="savedEntry.lifts.length" class="wl__rd-tagbox wl__rd-tagbox--gave">
            <p class="wl__rd-name">Gave something back</p>
            <p class="wl__rd-chips"><span v-for="l in savedEntry.lifts" :key="l" class="wl__rd-chip">{{ labelOf(LIFT_ITEMS, l) }}</span></p>
          </div>
        </div>
      </section>
      </div>

      <!-- 1b. What you asked for, sent to your partner -->
      <section v-if="partnerName" class="wl__card wl__ask" aria-labelledby="wl-ask">
        <p class="wl__label">Tonight</p>
        <h3 id="wl-ask" class="nt-heading wl__sec">What would help most from {{ partnerFirst }}?</h3>
        <div class="wl__ask-opts" role="group" aria-label="What you are asking for. You can pick more than one.">
          <button
            v-for="o in NEED_OPTIONS"
            :key="o.value"
            type="button"
            role="checkbox"
            class="wl__option wl__ask-opt"
            :aria-checked="isAsked(o.value) ? 'true' : 'false'"
            :disabled="sendingAsk"
            @click="changeAsk(o.value)"
          >
            <span class="wl__option-label">{{ o.label }}</span>
            <span class="wl__option-sub">{{ o.sub }}</span>
          </button>
        </div>
        <template v-if="askedList.length">
          <ul class="wl__ask-sent" role="status">
            <li v-for="a in askedList" :key="a.value" class="wl__ask-status">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
              <span><strong>{{ a.label }}</strong> sent to {{ partnerFirst }}{{ a.time ? ` at ${a.time}` : "" }}</span>
            </li>
          </ul>
          <p class="wl__body">{{ partnerFirst }} sees each one at the top of their Home, and the ones that are messages in the chat too.</p>
          <template v-for="a in askedList" :key="`say-${a.value}`">
            <figure v-if="!(a.value === 'coverTonight' && myHoursTonight)" class="wl__say">
              <figcaption>{{ partnerFirst }} reads, for {{ a.label.toLowerCase() }}</figcaption>
              <blockquote>“{{ askText(savedEntry, a.value) }}”</blockquote>
            </figure>
          </template>
          <template v-if="isAsked('coverTonight')">
            <p v-if="!myHoursTonight" class="wl__body">You are not down for the night shift tonight, so there is nothing to hand over. Check the plan on the sleep rota.</p>
            <div v-else-if="myCoverSwap" class="wl__cover" :class="`is-${myCoverSwap.status}`" role="status">
              <template v-if="myCoverSwap.status === 'pending'">
                <strong>Waiting for {{ partnerFirst }} to accept or decline.</strong>
                <span>You asked them to take your hours tonight, {{ myHoursTonight }}. They get an alert if their notifications are on.</span>
              </template>
              <template v-else-if="myCoverSwap.status === 'accepted'">
                <strong>{{ partnerFirst }} is taking tonight.</strong>
                <span>The sleep rota now shows {{ partnerFirst }} on for {{ myHoursTonight }}. You can rest.</span>
              </template>
              <template v-else>
                <strong>{{ partnerFirst }} cannot take tonight.</strong>
                <span>Nothing has changed on the sleep rota. You could ask again later, or ask someone else.</span>
                <AppButton variant="outline" size="md" type="button" @click="requestCover(true)">Ask again</AppButton>
              </template>
            </div>
            <p v-else class="wl__ask-wait">Sending your request to {{ partnerFirst }}...</p>
            <ul v-if="offersToMe.length" class="wl__offers">
              <li v-for="offer in offersToMe" :key="offer.id" class="wl__offer">
                <span>{{ partnerFirst }} offers to take tonight's shift.</span>
                <span class="wl__offer-btns">
                  <AppButton variant="primary" size="md" type="button" @click="answerOffer(offer, true)">Accept the offer</AppButton>
                  <AppButton variant="outline" size="md" type="button" @click="answerOffer(offer, false)">Not this time</AppButton>
                </span>
              </li>
            </ul>
            <router-link class="app-link" :to="ROUTES.ROTA">Open the sleep rota</router-link>
          </template>
        </template>
        <p v-else class="wl__body">Tap what you need. You can pick more than one, and each is sent to {{ partnerFirst }} on its own.</p>
        <p v-if="askProblem" class="app-error-text" role="alert">{{ askProblem }}</p>
      </section>

      <!-- 3. Suggestions to try, as a checklist -->
      <section aria-labelledby="wl-plan" class="wl__ck">
        <div class="wl__ck-head">
          <div>
            <h3 id="wl-plan" class="wl__h">Try these next</h3>
            <p class="wl__sg-sub">Small things for the next 24 hours. Tick them off as you go.</p>
          </div>
          <span class="wl__ck-count">{{ done.length }} of {{ reading.plan.length }} done</span>
        </div>
        <div class="wl__ck-bar" aria-hidden="true"><span :style="{ width: `${(done.length / reading.plan.length) * 100}%` }" /></div>
        <ul class="wl__ck-list">
          <li v-for="p in reading.plan" :key="p.id" class="wl__ck-row" :class="{ 'is-done': done.includes(p.id) }">
            <button
              type="button"
              class="wl__ck-box"
              role="checkbox"
              :aria-checked="done.includes(p.id) ? 'true' : 'false'"
              :aria-label="p.title"
              @click="toggleDone(p.id)"
            >
              <svg v-if="done.includes(p.id)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
            </button>
            <div class="wl__ck-main">
              <p class="wl__ck-title">{{ p.title }}</p>
              <p class="wl__ck-text">{{ p.body }}</p>
            </div>
            <button v-if="p.to === ROUTES.HOME" type="button" class="wl__ck-go" @click="nudgeState?.openChat()">{{ p.action }}</button>
            <router-link v-else-if="p.to" class="wl__ck-go" :to="p.to">{{ p.action }}</router-link>
          </li>
        </ul>
      </section>

      <!-- 4. What it might mean -->
      <section aria-labelledby="wl-mean" class="wl__sg">
        <div class="wl__sg-head">
          <div>
            <h3 id="wl-mean" class="wl__h">What it might mean</h3>
            <p class="wl__sg-sub">Read from the answers you just gave. Not a diagnosis.</p>
          </div>
        </div>
        <ul class="wl__in-grid">
          <li v-for="i in reading.insights" :key="i.title" class="wl__in-card">
            <div class="wl__in-photo"><SuggestionArt :kind="i.art" /></div>
            <div class="wl__in-body">
              <p v-if="i.from" class="wl__in-from">{{ i.from }}</p>
              <h4 class="wl__in-title">{{ i.title }}</h4>
              <p class="wl__in-text">{{ i.body }}</p>
            </div>
            <div v-if="i.tip" class="wl__in-tip">
              <span class="wl__in-tiplabel">Try this</span>
              <p>{{ i.tip }}</p>
            </div>
          </li>
        </ul>
      </section>

      <!-- 7. Support: always offered after a check-in, stronger when the day or week was hard -->
      <section class="wl__card wl__lead-out" :class="{ 'is-hard': !!reading.talk }" aria-labelledby="wl-support">
        <div class="wl__lead-out-text">
          <h3 id="wl-support" class="nt-heading wl__sec">{{ reading.talk ? "Please talk to someone" : "Support is here when you need it" }}</h3>
          <p class="wl__body">
            {{ reading.talk ? "You do not have to carry this alone. Helplines, a short self check and pumping rooms are all in one place." : "Helplines, a short self check, pumping rooms and ideas for the hard days. Nothing to fill in, have a look whenever you like." }}
          </p>
        </div>
        <AppButton variant="outline" size="md" :to="ROUTES.SUPPORT">Go to Support</AppButton>
      </section>

      <div class="wl__nav">
        <span class="wl__spacer" />
        <router-link class="app-link" :to="ROUTES.HOME">Back to Home</router-link>
      </div>
    </div>

    <p class="wl__disclaimer">
      For reflection, not diagnosis. Your check-ins are shared with your partner. If you feel unsafe, contact emergency services or a
      healthcare professional.
    </p>
  </div>
</template>

<style scoped>
.wl { display: flex; flex-direction: column; gap: 24px; max-width: 760px; font-size: 1rem; color: var(--nt-ink); }
.wl__head { display: flex; flex-direction: column; gap: 8px; }
.wl__sub { margin: 0; color: var(--nt-muted); }

/* The butter "Yours alone" box, for the check-in and its summary. */
.wl__box { display: flex; flex-direction: column; gap: 16px; padding: 24px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 12px; }
.wl__top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px; }
.wl__label { display: inline-flex; align-items: center; gap: 6px; margin: 0; }
.wl__count-step { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.wl__progress { height: 2px; background: var(--nt-line); }
.wl__progress span { display: block; height: 100%; background: var(--nt-plum); transition: width 0.3s ease; }
.wl__earlier { margin: 4px 0 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.wl__earlier .app-textbtn { margin-left: 4px; }
.wl__question { margin-top: 8px; font-size: 1.75rem; line-height: 1.25; }
.wl__question:focus { outline: none; }
.wl__hint { margin: -8px 0 4px; font-size: 0.9375rem; line-height: 1.5; color: var(--nt-muted); }

.wl__stage { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: center; gap: 24px; }
.wl__picture { display: flex; justify-content: center; width: 100%; max-width: 280px; margin: 0 auto; }
.wl__picture--narrow { max-width: 170px; }
.wl__options { display: flex; flex-direction: column; gap: 8px; }
.wl__option { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; min-height: 48px; padding: 10px 16px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 8px; font-family: inherit; text-align: left; color: var(--nt-ink); cursor: pointer; transition: background-color 0.15s, border-color 0.15s; }
.wl__option:hover { background: var(--nt-gray); }
.wl__option[aria-checked="true"] { background: var(--nt-gray); border-color: var(--nt-plum); box-shadow: inset 0 0 0 0.5px var(--nt-plum); }
.wl__option[aria-checked="true"] .wl__option-label { color: var(--nt-plum); font-weight: 600; }
.wl__option-label { font-size: 0.9375rem; font-weight: 500; }
.wl__option-sub { font-size: 0.875rem; color: var(--nt-muted); }
.wl__option:focus-visible, .wl__pair:focus-visible, .wl__tile:focus-visible, .wl__tick:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.wl__chips { display: flex; flex-wrap: wrap; align-content: center; gap: 8px; }
.wl__chips .app-chip:disabled { opacity: 0.45; cursor: not-allowed; }

.wl__close { display: flex; flex-direction: column; gap: 12px; }
.wl__legend-row { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.wl__swatch { display: inline-block; width: 12px; height: 12px; border-radius: 50%; }
.wl__swatch--you { background: var(--nt-powder); border: 1.5px solid var(--nt-powder-d); }
.wl__swatch--them { margin-left: 12px; background: var(--nt-apricot); border: 1.5px solid var(--nt-apricot-d); }
.wl__pairs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.wl__pair { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 8px 12px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 8px; font-family: inherit; color: var(--nt-ink); cursor: pointer; }
.wl__pair:hover { background: var(--nt-gray); }
.wl__pair[aria-checked="true"] { background: var(--nt-gray); border-color: var(--nt-plum); }
.wl__pair[aria-checked="true"] .wl__option-label { color: var(--nt-plum); font-weight: 600; }
.wl__pair .wl__option-label { font-size: 0.875rem; text-align: center; }
.wl__faces { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.wl__face :deep(svg) { width: 100%; max-width: 72px; transition: transform 0.2s ease; }
.wl__face:hover :deep(svg), .wl__face[aria-checked="true"] :deep(svg) { transform: scale(1.08); }

.wl__options--wide { max-width: 34rem; }
.wl__option-sub { text-align: right; }
.wl__weigh { display: flex; flex-direction: column; gap: 20px; }
.wl__group { display: flex; flex-direction: column; gap: 10px; min-width: 0; margin: 0; padding: 0; border: 0; }
.wl__legend { float: none; width: auto; margin: 0 0 10px; padding: 0; font-size: 0.9375rem; font-weight: 600; color: var(--nt-ink); }
.wl__muted-inline { margin-left: 6px; font-weight: 400; color: var(--nt-muted); }

.wl__reflect { margin: 4px 0 0; max-width: 56ch; font-size: 0.9375rem; line-height: 1.6; color: var(--nt-ink); }

.wl__review { display: flex; flex-direction: column; gap: 20px; }
/* The review reads like a receipt: one panel, a row per answer. */
.wl__ledger { margin: 0; padding: 0 16px; list-style: none; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 12px; }
.wl__ledger li + li { border-top: 1px solid var(--nt-line); }
.wl__tile { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; align-items: center; gap: 16px; width: 100%; padding: 12px 0; background: none; border: 0; font-family: inherit; text-align: left; color: var(--nt-ink); cursor: pointer; }
.wl__tile-pic { display: flex; align-items: center; justify-content: center; height: 48px; }
.wl__tile-pic :deep(svg) { width: auto; max-width: 100%; height: 100%; }
.wl__tile-pic--face :deep(svg) { height: 40px; }
.wl__tile-pic--pair :deep(svg) { height: 28px; }
.wl__tile-text { display: flex; flex-direction: column; min-width: 0; }
.wl__tile-name { font-size: 0.875rem; color: var(--nt-muted); }
.wl__tile-name--gap { margin-top: 6px; }
.wl__tile-value { font-size: 0.9375rem; font-weight: 600; }
.wl__tile-value.is-skipped { font-weight: 400; color: var(--nt-muted); }
.wl__change { font-size: 0.875rem; color: var(--nt-muted); text-decoration: underline; text-underline-offset: 3px; }
.wl__tile:hover .wl__change { color: var(--nt-plum); }
.wl__kind { margin: 4px 0 0; font-size: 1.25rem; line-height: 1.4; }

.wl__nav { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; padding-top: 8px; }
.wl__spacer { flex: 1; }
.wl__back::before { content: "\2190\00a0"; }

/* The summary: a journal page. Labels on the left, plain writing on the right. */
.wl__summary { gap: 24px; }
.wl__sum-title { font-size: 1.75rem; line-height: 1.2; }
.wl__sum-title:focus { outline: none; }
.wl__plan { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.wl__plan-item { display: flex; align-items: flex-start; gap: 12px; }
.wl__plan-item.is-done .wl__plan-body { color: var(--nt-muted); }
.wl__plan-item.is-done .wl__plan-body strong { text-decoration: line-through; }
.wl__plan-body .app-link { margin-left: 4px; white-space: nowrap; }
.wl__summary { display: flex; flex-direction: column; gap: 16px; }
.wl__chip { display: inline-flex; align-items: center; gap: 6px; margin: 0; padding: 4px 10px; border-radius: 999px; font-size: 0.875rem; font-weight: 500; }
.wl__chip--done { background: #ccfbf1; color: #115e59; }
.wl__hero { flex-direction: row; align-items: center; gap: 24px; background: rgb(92 122 158 / 18%); }
.wl__hero-face { flex: none; width: 96px; }
.wl__hero-text { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; min-width: 0; }
.wl__story { margin: 0; font-size: 1.0625rem; line-height: 1.6; }
.wl__hero-note { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.wl__sec { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 1.25rem; line-height: 1.3; }
.wl__tone { background: var(--tint); border-color: var(--edge); }
.wl__tone--glance { --tint: rgb(92 122 158 / 14%); --edge: rgb(92 122 158 / 40%); --accent: #dbeafe; --ink: #1e40af; }
.wl__tone--mean { --tint: rgb(227 165 132 / 12%); --edge: rgb(227 165 132 / 38%); --accent: #f6d8c6; --ink: #7a3f1f; }
.wl__tone--plan { --tint: rgb(20 184 166 / 12%); --edge: rgb(20 184 166 / 38%); --accent: #ccfbf1; --ink: #115e59; }
.wl__tone--partner { --tint: rgb(230 216 234 / 9%); --edge: rgb(230 216 234 / 30%); --accent: #e6dce9; --ink: #3b2f3f; }
.wl__tone--week { --tint: rgb(255 255 255 / 5%); --edge: rgb(255 255 255 / 16%); --accent: #e5e7eb; --ink: #374151; }
.wl__sec-icon { display: grid; flex: none; place-items: center; width: 32px; height: 32px; background: var(--accent, var(--nt-gray)); border-radius: 8px; color: var(--ink, var(--nt-plum)); }
.wl__tone .wl__stat, .wl__tone .wl__plan-item.is-done, .wl__tone .wl__say, .wl__tone .wl__trend { background: var(--nt-surface, #fff); }
.wl__tone .wl__insight { background: var(--nt-surface, #fff); }
.wl__tone .wl__plan-item { background: var(--nt-surface, #fff); border-color: var(--edge); }
.wl__tone .wl__plan-item.is-done { background: rgb(255 255 255 / 35%); }
.wl__tone .wl__meter { background: var(--nt-surface, #fff); }
.wl__tone--plan .wl__meter span { background: #14b8a6; }
.wl__tone .wl__insight-from { background: var(--accent); color: var(--ink); }
.wl__tone .wl__insight-tip strong { color: var(--ink); }
.wl__sec-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.wl__glance { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.wl__stat { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 14px 8px 12px; background: var(--nt-gray); border-radius: 12px; text-align: center; }
.wl__stat-pic { display: flex; align-items: center; justify-content: center; height: 56px; margin-bottom: 6px; }
.wl__stat-pic :deep(svg) { width: auto; max-width: 100%; height: 100%; }
.wl__stat-pic--face :deep(svg) { height: 48px; }
.wl__stat-pic--pair :deep(svg) { height: 30px; }
.wl__stat-name { font-size: 0.875rem; color: var(--nt-muted); }
.wl__stat-value { font-size: 0.9375rem; font-weight: 600; }
.wl__stat-value.is-skipped { font-weight: 400; color: var(--nt-muted); }
.wl__tags { display: flex; flex-direction: column; gap: 10px; margin: 0; }
.wl__tags > div { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.wl__tags dt { flex: 0 0 9rem; font-size: 0.875rem; font-weight: 400; color: var(--nt-muted); }
.wl__tags dd { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
.wl__tag { padding: 3px 10px; border-radius: 999px; font-size: 0.875rem; font-weight: 500; }
.wl__tag--body { background: #dce6f2; color: #34506f; }
.wl__tag--took { background: #f6d8c6; color: #7a3f1f; }
.wl__tag--gave { background: #ccfbf1; color: #115e59; }
.wl__insights { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; margin: 0; padding: 0; list-style: none; }
.wl__insight { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; background: var(--nt-gray); border-left: 4px solid #5c7a9e; border-radius: 8px; }
.wl__insight:nth-child(2) { border-left-color: #e3a584; }
.wl__insight:nth-child(3) { border-left-color: #14b8a6; }
.wl__insight-title { font-size: 1rem; }
.wl__insight-from { align-self: flex-start; padding: 2px 10px; background: var(--nt-surface, #fff); border-radius: 999px; font-size: 0.875rem; color: var(--nt-muted); }
.wl__insight-tip { padding-top: 8px; border-top: 1px solid var(--nt-line); font-size: 0.9375rem; line-height: 1.55; }
.wl__insight-tip strong { margin-right: 4px; color: var(--nt-plum); }
.wl__insight-body { font-size: 0.9375rem; line-height: 1.55; color: var(--nt-ink); }
.wl__progress-label { font-size: 0.875rem; color: var(--nt-muted); white-space: nowrap; }
.wl__meter { height: 6px; background: var(--nt-line); border-radius: 999px; overflow: hidden; }
.wl__meter span { display: block; height: 100%; background: var(--nt-plum); transition: width 0.3s ease; }
.wl__plan { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.wl__plan-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border: 1px solid var(--nt-line); border-radius: 8px; }
.wl__plan-item.is-done { background: var(--nt-gray); }
.wl__plan-item.is-done .wl__plan-body { color: var(--nt-muted); }
.wl__plan-item.is-done .wl__plan-title { text-decoration: line-through; }
.wl__plan-body { display: flex; flex-direction: column; gap: 2px; font-size: 0.9375rem; line-height: 1.55; }
.wl__plan-body .app-link { align-self: flex-start; margin-top: 2px; }
.wl__tone.wl__partner.is-hard { --tint: rgb(227 165 132 / 18%); --edge: #e3a584; --accent: #f6d8c6; --ink: #7a3f1f; }
.wl__partner-row { display: flex; align-items: center; gap: 14px; }
.wl__partner-face { flex: none; width: 52px; }
.wl__partner-name { margin: 0; font-weight: 600; }
.wl__partner-text { margin: 0; font-size: 0.9375rem; line-height: 1.5; }
.wl__reach { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; background: var(--nt-surface, #fff); border: 1px solid #e3a584; border-radius: 8px; }
.wl__reach-text { flex: 1 1 14rem; margin: 0; font-size: 0.9375rem; line-height: 1.5; }
.wl__say { margin: 0; padding: 14px 16px; background: var(--nt-gray); border-radius: 8px; }
.wl__say figcaption { margin-bottom: 6px; font-size: 0.875rem; color: var(--nt-muted); }
.wl__say blockquote { margin: 0; font-size: 1rem; line-height: 1.6; }
.wl__trend { display: flex; align-items: center; gap: 12px; margin: 0; padding: 12px 14px; background: var(--nt-gray); border-radius: 8px; font-size: 0.9375rem; line-height: 1.5; }
.wl__trend-arrow { display: grid; flex: none; place-items: center; width: 28px; height: 28px; background: var(--nt-surface, #fff); border-radius: 50%; font-size: 1.125rem; font-weight: 600; }
.wl__trend--lighter .wl__trend-arrow { color: #115e59; }
.wl__trend--heavier .wl__trend-arrow { color: #c0553b; }
.wl__callout { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 14px 16px; border: 1px solid var(--nt-line); border-left: 4px solid #c0553b; border-radius: 8px; font-size: 0.9375rem; line-height: 1.55; }
.wl__callout p { margin: 0; }
.wl__tick { display: grid; flex: none; place-items: center; width: 20px; height: 20px; margin-top: 3px; padding: 0; background: var(--nt-surface, #fff); border: 1.5px solid var(--nt-muted); border-radius: 50%; color: #fff; cursor: pointer; }
.wl__tick[aria-pressed="true"] { background: var(--nt-plum); border-color: var(--nt-plum); }

/* Cards */
.wl__card { display: flex; flex-direction: column; gap: 12px; padding: 24px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 12px; }
.wl__card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.wl__h { font-size: 1.375rem; line-height: 1.3; }
.wl__body { margin: 0; font-size: 0.9375rem; line-height: 1.55; color: var(--nt-ink); }
.wl__legend-inline { display: inline-flex; align-items: center; gap: 6px; font-size: 0.875rem; color: var(--nt-muted); white-space: nowrap; }
.wl__dot--them { left: 62%; background: var(--nt-apricot-d); }
.wl__dot--solo { left: 50%; }
.wl__line--them path { stroke: var(--nt-apricot-d); }

/* Week plot: mood as one dot a day, joined where days are consecutive. */
.wl__chart { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; margin-top: 8px; }
.wl__axis { position: relative; width: 4.5rem; height: 120px; margin-top: 10px; }
.wl__axis span { position: absolute; right: 0; transform: translateY(-50%); font-size: 0.875rem; color: var(--nt-muted); white-space: nowrap; }
.wl__plot-wrap { position: relative; min-width: 0; }
.wl__plot-area { position: absolute; top: 10px; left: 0; right: 0; height: 120px; }
.wl__guide { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--nt-line); }
.wl__line { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.wl__line path { fill: none; stroke: var(--nt-plum); stroke-width: 1.5; stroke-linejoin: round; opacity: 0.45; }
.wl__days { position: relative; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; }
.wl__day { display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 0; }
.wl__col { position: relative; display: block; width: 100%; height: 140px; }
.wl__dot { position: absolute; left: 38%; width: 12px; height: 12px; background: var(--nt-plum); border: 2px solid #fff; border-radius: 50%; transform: translate(-50%, -50%); }
.wl__weekday { padding-bottom: 2px; font-size: 0.875rem; color: var(--nt-muted); border-bottom: 2px solid transparent; }
.wl__weekday.is-today { font-weight: 600; color: var(--nt-ink); border-bottom-color: var(--nt-coral); }

.wl__disclaimer { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }

/* Pictures (the render functions at the top) */
/* :where() keeps this default weaker than the tile and strip sizes above. */
.wl :deep(:where(svg[class^="pic-"])) { display: block; width: 100%; height: auto; }
.wl :deep(.pic-move) { transition: transform 0.7s ease, opacity 0.6s ease; }
.wl :deep(.pic-stones) { overflow: visible; }
.wl :deep(.pic-stone) { opacity: 0; transform-box: fill-box; transform-origin: center; transition: opacity 0.35s ease, transform 0.45s ease; }
.wl :deep(.pic-stone.is-on) { opacity: 1; }
.wl :deep(.pic-area) { fill: #3b2f3f; fill-opacity: 0.06; stroke: #3b2f3f; stroke-opacity: 0.25; stroke-width: 1.5; stroke-dasharray: 3 3; cursor: pointer; transition: fill-opacity 0.2s ease, stroke-opacity 0.2s ease; }
.wl :deep(.pic-area:hover) { fill-opacity: 0.14; }
.wl :deep(.pic-area.is-on) { fill-opacity: 0.3; stroke-opacity: 0.9; stroke-dasharray: none; }
.wl :deep(.pic-body.is-static .pic-area) { cursor: default; }
.wl :deep(.pic-body.is-static .pic-area:not(.is-on)) { fill-opacity: 0; stroke-opacity: 0; }
.wl :deep(.pic-pair circle) { mix-blend-mode: multiply; }
.wl :deep(.pic-pair.is-faded), .wl :deep(.pic-face.is-faded) { opacity: 0.35; }

@media (max-width: 991px) { .wl__title { font-size: 2rem; } }
@media (max-width: 640px) {
  .wl__glance { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wl__hero { flex-direction: column; align-items: flex-start; }
  .wl__tags dt { flex-basis: 100%; }
  .wl__stage { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .wl__picture--narrow { max-width: 130px; }
  .wl__picture { max-width: 220px; }
  .wl__pairs { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .wl__faces { gap: 6px; }
  .wl__face { padding: 10px 4px; }
  .wl__tile { grid-template-columns: 44px minmax(0, 1fr) auto; gap: 12px; }
}
@media (max-width: 575px) {
  .wl__box, .wl__card { padding: 20px 16px; }
  .wl__question { font-size: 1.5rem; }
  .wl__axis { display: none; }
  .wl__chart { grid-template-columns: minmax(0, 1fr); }
}

/* ===== The same look as the Sleep rota, Care log and Checklist: a navy hero, cream cards with a sand edge ===== */
.wl { --navy: #243560; --navy-2: #2d3f70; --ink: #1f2a52; --cream: #fdf9f0; --sand: #e9d9b8; --apricot: #f2a477; width: 100%; max-width: 1020px; margin: 0 auto; gap: 20px; color: var(--ink); }
.wl__banner-hero { display: flex; flex-direction: column; gap: 10px; padding: 32px 40px; background: var(--navy-2); border-radius: 28px; border-bottom: 5px solid #182246; color: #fff; }
.wl__eyebrow { margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--apricot); }
.wl__h1 { margin: 0; font-family: var(--nt-serif); font-size: 2.5rem; line-height: 1.05; font-weight: 700; color: #fff; }
.wl__lead { margin: 0; font-size: 1.0625rem; color: #dfe5f7; }
.wl__pill { display: inline-flex; align-items: center; align-self: flex-start; gap: 8px; margin: 6px 0 0; padding: 8px 16px; border: 1px solid rgb(255 255 255 / 35%); border-radius: 999px; background: rgb(255 255 255 / 8%); font-size: 0.9375rem; color: #fff; }
.wl__pill-dot { width: 10px; height: 10px; border-radius: 50%; background: #8fd19e; }

.wl__box { padding: 28px 32px 32px; background: var(--cream); border: 1px solid var(--sand); border-bottom-width: 4px; border-radius: 24px; }
.wl__label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #c4642f; }
.wl__count-step { padding: 4px 14px; background: var(--navy); border-radius: 999px; font-size: 0.875rem; font-weight: 600; color: #fff; }
.wl__progress { height: 8px; background: #efe4c9; border-radius: 999px; overflow: hidden; }
.wl__progress span { background: var(--navy); border-radius: 999px; }
.wl__question { font-family: var(--nt-serif); font-weight: 700; color: var(--ink); }
.wl__hint, .wl__earlier { color: #6b7392; }

.wl__option, .wl__pair, .wl .app-chip { background: #fffdf8; border: 1.5px solid var(--sand); border-bottom-width: 3px; border-radius: 16px; color: var(--ink); }
.wl .app-chip { border-radius: 999px; }
.wl__option:hover, .wl__pair:hover, .wl .app-chip:hover { background: #fff; border-color: var(--navy); }
.wl__option[aria-checked="true"], .wl__pair[aria-checked="true"], .wl .app-chip[aria-checked="true"], .wl .app-chip[aria-pressed="true"] { background: #fff; border-color: var(--navy); box-shadow: 0 0 0 3px rgb(36 53 96 / 12%); color: var(--navy); }
.wl__option[aria-checked="true"] .wl__option-label, .wl__pair[aria-checked="true"] .wl__option-label { color: var(--navy); font-weight: 700; }
.wl__option:focus-visible, .wl__pair:focus-visible, .wl__tile:focus-visible, .wl__tick:focus-visible, .wl .app-chip:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
.wl__option-sub, .wl__tile-name, .wl__change, .wl__legend-row, .wl__hero-note { color: #6b7392; }

.wl__ledger { background: #fffdf8; border: 1.5px solid var(--sand); border-radius: 20px; }
.wl__ledger li + li { border-top-color: var(--sand); }
.wl__tile:hover .wl__change { color: var(--navy); }

.wl__tone { border-bottom-width: 4px; border-radius: 24px; }
.wl__banner { background: #fff1e2; border: 1px solid #f0cfa8; border-bottom-width: 4px; border-radius: 24px; color: var(--ink); }

.wl__asked { display: flex; flex-direction: column; gap: 10px; background: #fff1e2; border-color: #f0cfa8; }
.wl__asked.is-answered { background: #fffdf8; border-color: var(--sand); }
.wl__asked-facts { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; font-size: 0.9375rem; }
.wl__asked-facts strong { margin-right: 8px; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: #c4642f; }
.wl__asked-actions, .wl__offer-btns { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.wl__asked-done, .wl__ask-status { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 0.9375rem; color: #1f6b3a; }
.wl__ask { display: flex; flex-direction: column; gap: 12px; }
.wl__ask-opts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.wl__ask-opt { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px 16px; text-align: left; font-family: inherit; cursor: pointer; }
.wl__ask-opt:disabled { opacity: 0.6; cursor: default; }
.wl__ask-wait { margin: 0; font-size: 0.9375rem; color: #6b7392; }
.wl__offers { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.wl__offer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; background: #fff; border: 1.5px solid var(--navy); border-radius: 16px; }
.wl .wl__lead-out { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 20px; padding: 22px 28px; text-align: left; background: #fffdf8; }
.wl .wl__lead-out.is-hard { background: #fff1e2; border-color: #f0cfa8; }
.wl__lead-out-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.wl__lead-out-text .wl__body { margin: 0; }
.wl__lead-out :deep(.app-btn), .wl__lead-out > :last-child { flex-shrink: 0; }

@media (max-width: 640px) {
  .wl__ask-opts { grid-template-columns: 1fr; }
  .wl .wl__lead-out { flex-direction: column; align-items: stretch; }
  .wl__banner-hero { padding: 24px 22px; border-radius: 22px; }
  .wl__h1 { font-size: 2rem; }
  .wl__box { padding: 20px 18px 24px; border-radius: 20px; }
}

/* Today, side by side: each parent's own short report */
.wl__sbs { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-bottom: 8px; }
.wl__sbs-sub { margin: 0; font-size: 0.9375rem; color: #6b7392; }
.wl__sbs-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.wl__sbs-card { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px 18px; background: #fffdf8; border: 1.5px solid var(--sand); border-bottom-width: 3px; border-radius: 18px; }
.wl__sbs-card.is-hard { border-color: #e0a37a; background: #fff6ee; }
.wl__sbs-head { display: flex; align-items: center; gap: 12px; }
.wl__sbs-avatar { display: grid; flex: none; place-items: center; width: 38px; height: 38px; border: 1.5px solid #5c7a9e; border-radius: 50%; background: #dce6f2; font-weight: 700; color: var(--navy); }
.wl__sbs-card--partner .wl__sbs-avatar { border-color: #e3a584; background: #f6d8c6; color: #5a2a14; }
.wl__sbs-name { margin: 0; font-size: 1rem; font-weight: 700; color: var(--ink); }
.wl__sbs-time { margin: 0; font-size: 0.875rem; color: #6b7392; }
.wl__sbs-mood { margin: 0; font-family: var(--nt-serif); font-size: 1.375rem; font-weight: 600; line-height: 1.25; color: var(--navy); }
.wl__sbs-rows { display: flex; flex-direction: column; margin: 0; }
.wl__sbs-rows > div { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-top: 1px dashed var(--sand); font-size: 0.9375rem; }
.wl__sbs-rows dt { font-weight: 400; color: #6b7392; }
.wl__sbs-rows dd { margin: 0; font-weight: 600; text-align: right; color: var(--ink); }
.wl__sbs-line { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: var(--ink); }
.wl__sbs-line strong { display: block; font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #8a7a55; }
.wl__sbs-empty { margin: 0; font-size: 0.9375rem; color: #6b7392; }
@media (max-width: 640px) { .wl__sbs-grid { grid-template-columns: minmax(0, 1fr); } }

/* The sentence questions: wide rows to read, one to pick */
.wl__picks { display: flex; flex-direction: column; gap: 10px; max-width: 46rem; }
.wl__pick { display: flex; align-items: flex-start; gap: 14px; width: 100%; min-height: 60px; padding: 14px 18px; background: #fffdf8; border: 1.5px solid var(--sand); border-bottom-width: 3px; border-radius: 16px; font-family: inherit; font-size: 1.0625rem; line-height: 1.4; text-align: left; color: var(--ink); cursor: pointer; }
.wl__pick:hover { background: #fff; border-color: var(--navy); }
.wl__pick:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
.wl__pick-text { display: flex; flex-direction: column; gap: 2px; }
.wl__pick-sub { font-size: 0.9375rem; font-weight: 400; line-height: 1.4; color: #6b7392; }
.wl__pick-mark { flex: none; width: 20px; height: 20px; margin-top: 2px; border: 2px solid #b9a98a; border-radius: 50%; background: #fff; }
.wl__pick[aria-checked="true"] { background: #fff; border-color: var(--navy); box-shadow: 0 0 0 3px rgb(36 53 96 / 12%); font-weight: 600; color: var(--navy); }
.wl__pick[aria-checked="true"] .wl__pick-mark { border-color: var(--navy); background: radial-gradient(circle, var(--navy) 0 5px, #fff 5.5px); }
.wl__tile { grid-template-columns: minmax(0, 1fr) auto; }
.wl__hero { gap: 0; }
.wl__hero-quote { margin: 2px 0 4px; font-family: var(--nt-serif); font-size: 1.375rem; font-weight: 600; line-height: 1.35; color: var(--navy); }
.wl__partner-row { gap: 0; }

/* ===== One type scale, the same as the Sleep rota and the other pages =====
   Serif (headings only): 2.5rem page title, 1.75rem the question, 1.5rem section headings, 1.25rem card headings, all bold.
   Sans: 1rem for reading text, 0.875rem for small notes, 0.75rem for uppercase labels. Emphasis is always 600. */
.wl__question { font-family: var(--nt-serif); font-size: 1.75rem; font-weight: 700; line-height: 1.25; }
.wl__sum-title, .wl__h, .wl__sec { font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 700; line-height: 1.25; color: var(--ink); }
.wl__sbs-mood, .wl__hero-quote, .wl__kind { font-family: var(--nt-serif); font-size: 1.25rem; font-weight: 700; line-height: 1.3; }
.wl__lead, .wl__story, .wl__pick, .wl__hint, .wl__option-label, .wl__pair .wl__option-label, .wl__pick-sub, .wl__reflect, .wl__body, .wl__tile-value,
.wl__stat-value, .wl__insight-title, .wl__insight-tip, .wl__insight-body, .wl__plan-body, .wl__partner-text, .wl__reach-text, .wl__say blockquote,
.wl__trend, .wl__callout, .wl__legend, .wl__asked-facts, .wl__asked-done, .wl__ask-status, .wl__ask-wait, .wl__sbs-sub, .wl__sbs-rows > div,
.wl__sbs-line, .wl__sbs-empty, .wl__sbs-name, .wl__pill { font-size: 1rem; }
.wl__option-sub, .wl__legend-row, .wl__tile-name, .wl__change, .wl__chip, .wl__stat-name, .wl__tags dt, .wl__tag, .wl__insight-from, .wl__progress-label,
.wl__say figcaption, .wl__legend-inline, .wl__axis span, .wl__weekday, .wl__disclaimer, .wl__hero-note, .wl__earlier, .wl__count-step, .wl__sbs-time,
.wl__sbs-line strong { font-size: 0.875rem; }
.wl__eyebrow, .wl__label, .wl__asked-facts strong { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.wl__chip, .wl__tag, .wl__sbs-name, .wl__legend, .wl__tile-value, .wl__stat-value, .wl__partner-name, .wl__sbs-rows dd, .wl__sbs-line strong,
.wl__option-label, .wl__trend-arrow, .wl__weekday.is-today, .wl__count-step { font-weight: 600; }
.wl__option[aria-checked="true"] .wl__option-label, .wl__pair[aria-checked="true"] .wl__option-label, .wl__pick[aria-checked="true"] { font-weight: 600; }
.wl__tile-value.is-skipped, .wl__stat-value.is-skipped, .wl__pick-sub, .wl__tags dt, .wl__sbs-rows dt, .wl__muted-inline { font-weight: 400; }
@media (max-width: 640px) {
  .wl__question { font-size: 1.5rem; }
  .wl__sum-title, .wl__h, .wl__sec { font-size: 1.375rem; }
}

/* ===== The summary after the quiz: one navy panel, read top to bottom ===== */
.wl__sh { display: flex; flex-direction: column; gap: 6px; padding: 24px 32px 28px; background: var(--navy-2); border-bottom: 5px solid #182246; border-radius: 28px; color: #fff; }
.wl__sh-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.wl__sh-when { display: inline-flex; align-items: center; gap: 8px; margin: 0; font-size: 0.875rem; font-weight: 600; color: #b9c3e6; }
.wl__sh-link { padding: 0; background: none; border: 0; font: inherit; font-size: 0.875rem; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; color: #fff; cursor: pointer; }
.wl__sh-eyebrow { margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #f2a477; }
.wl__sh-quote { max-width: 24ch; margin: 0; font-family: var(--nt-serif); font-size: 2.25rem; font-weight: 700; line-height: 1.15; color: #fff; text-wrap: balance; }
.wl__sh-note { margin: 4px 0 0; font-size: 0.875rem; color: #b9c3e6; }
.wl__sum { overflow: hidden; background: var(--cream); border-bottom: 5px solid #182246; border-radius: 28px; }
.wl__sum .wl__sh { border-bottom: 0; border-radius: 0; }
.wl__rd { display: flex; flex-direction: column; gap: 0; padding: 4px 32px 28px; }
.wl__rd-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; }
.wl__rd-card { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 22px 24px 20px; }
.wl__rd-card:first-child { padding-left: 0; }
.wl__rd-card + .wl__rd-card { border-left: 1px solid var(--sand); }
.wl__rd-name { margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #4a6a58; }
.wl__rd-card.is-load .wl__rd-name { color: #a4532a; }
.wl__rd-word { font-family: var(--nt-serif); font-size: 1.25rem; font-weight: 700; line-height: 1.3; color: var(--ink); }
.wl__rd-word.is-skipped { font-family: inherit; font-size: 1rem; font-weight: 400; color: #6b7392; }
.wl__rd-dots { display: flex; gap: 6px; margin-top: auto; padding-top: 6px; }
.wl__rd-dot { width: 14px; height: 14px; background: #fff; border: 1.5px solid #8fbfa2; border-radius: 50%; }
.wl__rd-dot.is-on { background: #3f8f63; border-color: #3f8f63; }
.wl__rd-card.is-load .wl__rd-dot { border-color: #e3a584; }
.wl__rd-card.is-load .wl__rd-dot.is-on { background: #c4642f; border-color: #c4642f; }
.wl__rd-tags { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 32px; padding-top: 20px; border-top: 1px solid var(--sand); }
.wl__rd-tagbox { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.wl__rd-tagbox .wl__rd-name { color: #6b7392; }
.wl__rd-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; }
.wl__rd-chip { padding: 6px 14px; border-radius: 999px; font-size: 0.875rem; font-weight: 600; color: var(--ink); }
.wl__rd-tagbox--took .wl__rd-chip { background: #fbe6d4; }
.wl__rd-tagbox--gave .wl__rd-chip { background: #e4f1e8; }

.wl__sg { display: flex; flex-direction: column; gap: 14px; }
.wl__sg-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.wl__sg-head .wl__h { margin: 0; }
.wl__sg-sub { margin: 4px 0 0; font-size: 0.875rem; color: #6b7392; }
.wl__sg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
.wl__sg-card { display: flex; flex-direction: column; overflow: hidden; background: var(--cream); border: 1px solid var(--sand); border-bottom-width: 4px; border-radius: 24px; transition: border-color 0.18s ease, transform 0.18s ease; }
.wl__sg-card:hover { border-color: var(--navy); transform: translateY(-2px); }
.wl__sg-card.is-done { background: #f4f6ee; border-color: #b9d3b4; }
.wl__sg-card.is-done .wl__sg-art { opacity: 0.55; }
.wl__sg-art { position: relative; height: 132px; }
.wl__sg-art--short { height: 96px; }
.wl__sg-num { position: absolute; top: 10px; left: 10px; display: grid; place-items: center; width: 28px; height: 28px; background: var(--navy); border-radius: 50%; font-size: 0.875rem; font-weight: 700; color: #fff; }
.wl__sg-body { display: flex; flex: 1; flex-direction: column; gap: 6px; padding: 16px 18px 18px; }
.wl__sg-title { margin: 0; font-family: var(--nt-serif); font-size: 1.25rem; font-weight: 700; line-height: 1.3; color: var(--ink); }
.wl__sg-from { margin: 0; font-size: 0.875rem; font-weight: 600; color: #c4642f; }
.wl__sg-text { margin: 0; font-size: 1rem; line-height: 1.5; color: #3b4468; }
.wl__sg-tip { margin: 4px 0 0; padding: 10px 12px; background: #fff1e2; border-radius: 12px; font-size: 0.875rem; line-height: 1.45; color: var(--ink); }
.wl__sg-tip strong { margin-right: 6px; color: #c4642f; }
.wl__sg-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 10px; }
.wl__sg-go { font-size: 0.875rem; font-weight: 600; color: var(--navy); text-decoration: underline; text-underline-offset: 3px; }
.wl__sg-tick { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: transparent; border: 1.5px solid var(--navy); border-radius: 999px; font-family: inherit; font-size: 0.875rem; font-weight: 600; color: var(--navy); cursor: pointer; transition: background-color 0.18s ease, color 0.18s ease; }
.wl__sg-tick:hover { background: #fff; }
.wl__sg-tick[aria-pressed="true"] { background: var(--navy); color: #fff; }
.wl__sg-tick:focus-visible, .wl__sg-go:focus-visible, .wl__sh-link:focus-visible { outline: 3px solid #f2a477; outline-offset: 2px; }
.wl__duo { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; align-items: start; }

@media (max-width: 760px) {
  .wl__sh { padding: 20px 20px 24px; border-radius: 22px; }
  .wl__sh-quote { font-size: 1.75rem; }
  .wl__sum { border-radius: 22px; }
  .wl__rd { padding: 4px 20px 22px; }
  .wl__rd-grid, .wl__rd-tags { grid-template-columns: 1fr; }
  .wl__rd-card, .wl__rd-card:first-child { padding: 16px 0; }
  .wl__rd-card + .wl__rd-card { border-top: 1px solid var(--sand); border-left: 0; }
}

/* The "Try these next" checklist: one card, one row per suggestion */
.wl__ck { display: flex; flex-direction: column; gap: 14px; padding: 24px 28px 12px; background: var(--cream); border: 1px solid var(--sand); border-bottom-width: 4px; border-radius: 24px; }
.wl__ck-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.wl__ck-head .wl__h { margin: 0; }
.wl__ck-count { font-size: 0.875rem; font-weight: 600; color: var(--navy); }
.wl__ck-bar { height: 8px; overflow: hidden; background: #efe4c9; border-radius: 999px; }
.wl__ck-bar span { display: block; height: 100%; background: #3f8f63; border-radius: 999px; transition: width 0.25s ease; }
.wl__ck-list { margin: 0; padding: 0; list-style: none; }
.wl__ck-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 16px; padding: 18px 0; }
.wl__ck-row + .wl__ck-row { border-top: 1px solid var(--sand); }
.wl__ck-box { display: grid; flex: none; place-items: center; width: 28px; height: 28px; margin-top: 2px; padding: 0; background: #fff; border: 2px solid var(--navy); border-radius: 8px; color: #fff; cursor: pointer; transition: background-color 0.15s ease, border-color 0.15s ease; }
.wl__ck-box:hover { background: #eef2fb; }
.wl__ck-box[aria-checked="true"] { background: #3f8f63; border-color: #3f8f63; }
.wl__ck-box:focus-visible, .wl__ck-go:focus-visible { outline: 3px solid #f2a477; outline-offset: 2px; }
.wl__ck-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.wl__ck-title { margin: 0; font-size: 1.0625rem; font-weight: 600; line-height: 1.35; color: var(--ink); }
.wl__ck-text { margin: 0; font-size: 1rem; line-height: 1.5; color: #3b4468; }
.wl__ck-row.is-done .wl__ck-title { text-decoration: line-through; text-decoration-color: #8fbfa2; color: #6b7392; }
.wl__ck-row.is-done .wl__ck-text { color: #8a90ab; }
.wl__ck-go { align-self: center; padding: 6px 14px; border: 1.5px solid var(--navy); border-radius: 999px; font-size: 0.875rem; font-weight: 600; white-space: nowrap; color: var(--navy); text-decoration: none; }
.wl__ck-go:hover { background: #fff; }
button.wl__ck-go { background: transparent; font-family: inherit; cursor: pointer; }
@media (max-width: 640px) {
  .wl__ck { padding: 20px 18px 8px; }
  .wl__ck-row { grid-template-columns: auto minmax(0, 1fr); }
  .wl__ck-go { grid-column: 2; justify-self: start; }
}

/* "What it might mean": a photo, the reading, then a tip strip pinned to the bottom of every card */
.wl__in-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
.wl__in-card { display: flex; flex-direction: column; overflow: hidden; background: var(--cream); border: 1px solid var(--sand); border-bottom-width: 4px; border-radius: 24px; }
.wl__in-photo { height: 176px; }
.wl__in-body { display: flex; flex: 1; flex-direction: column; gap: 8px; padding: 18px 22px 20px; }
.wl__in-from { margin: 0; font-size: 0.875rem; font-weight: 600; color: #c4642f; }
.wl__in-title { margin: 0; font-family: var(--nt-serif); font-size: 1.375rem; font-weight: 700; line-height: 1.25; color: var(--ink); text-wrap: balance; }
.wl__in-text { margin: 0; font-size: 1rem; line-height: 1.6; color: #3b4468; }
.wl__in-tip { display: flex; flex-direction: column; gap: 4px; min-height: 104px; padding: 14px 22px 18px; background: #fff1e2; border-top: 1px solid #f0cfa8; }
.wl__in-tiplabel { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #c4642f; }
.wl__in-tip p { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--ink); }

.wl__cover { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 14px 18px; background: #fff; border: 1.5px solid var(--navy); border-radius: 16px; font-size: 1rem; line-height: 1.5; color: var(--ink); }
.wl__cover strong { font-weight: 600; }
.wl__cover.is-accepted { background: #e4f1e8; border-color: #8fbfa2; }
.wl__cover.is-declined { background: #fff1e2; border-color: #f0cfa8; }

/* Every answer row is colour coded, from green (feeling good) through amber to coral (feeling hard) */
.wl__pick--tone5 { --tone: #3f8f63; --tone-bg: #eef7f1; }
.wl__pick--tone4 { --tone: #7fae5a; --tone-bg: #f3f8ec; }
.wl__pick--tone3 { --tone: #d3a03a; --tone-bg: #fcf6e6; }
.wl__pick--tone2 { --tone: #e0884a; --tone-bg: #fdf0e4; }
.wl__pick--tone1 { --tone: #c0553b; --tone-bg: #fbe9e4; }
.wl__pick[class*="wl__pick--tone"] { background: var(--tone-bg); border-color: color-mix(in srgb, var(--tone) 30%, #fff); border-left: 8px solid var(--tone); }
.wl__pick[class*="wl__pick--tone"] .wl__pick-mark { border-color: var(--tone); }
.wl__pick[class*="wl__pick--tone"]:hover { background: #fff; border-color: var(--tone); }
.wl__pick[class*="wl__pick--tone"][aria-checked="true"] { background: #fff; border-color: var(--tone); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tone) 25%, transparent); color: var(--ink); }
.wl__pick[class*="wl__pick--tone"][aria-checked="true"] .wl__pick-mark { border-color: var(--tone); background: radial-gradient(circle, var(--tone) 0 5px, #fff 5.5px); }

.wl__ask-sent { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.wl__ask-sent strong { font-weight: 600; }

/* "Today, side by side": two navy report cards, white text on a dark ground so it reads easily at any hour */
.wl__sbs-card { gap: 14px; padding: 22px 24px 24px; background: var(--navy-2); border: 0; border-bottom: 5px solid #182246; border-radius: 24px; color: #fff; }
.wl__sbs-card.is-hard { background: var(--navy-2); border-color: #182246; box-shadow: inset 0 5px 0 #f2a477; }
.wl__sbs-head { gap: 14px; }
.wl__sbs-avatar { width: 44px; height: 44px; font-size: 1.125rem; border-color: #b9c3e6; background: #dce6f2; color: var(--navy); }
.wl__sbs-card--partner .wl__sbs-avatar { border-color: #f2a477; background: #f6d8c6; color: #5a2a14; }
.wl__sbs-name { font-size: 1.0625rem; font-weight: 600; color: #fff; }
.wl__sbs-time { font-size: 0.875rem; color: #b9c3e6; }
.wl__sbs-mood { margin-top: 2px; font-size: 1.625rem; font-weight: 700; line-height: 1.2; color: #f2a477; }
.wl__sbs-rows > div { align-items: baseline; padding: 10px 0; border-top: 1px solid rgb(255 255 255 / 16%); font-size: 1rem; }
.wl__sbs-rows dt { font-size: 0.875rem; font-weight: 400; color: #b9c3e6; }
.wl__sbs-rows dd { font-size: 1rem; font-weight: 600; color: #fff; }
.wl__sbs-line { padding-top: 12px; border-top: 1px solid rgb(255 255 255 / 16%); font-size: 1rem; line-height: 1.55; color: #fff; }
.wl__sbs-line strong { margin-bottom: 4px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; color: #b9c3e6; }
.wl__sbs-empty { font-size: 1rem; color: #b9c3e6; }
</style>
