import { ROUTES } from "@/app/routes";

// Wellness check-in content. "Read the guide" links open a guide on the Support page by its id
// in src/app/data/supportGuides.js.

// Mood, shown as a drawn face.
export const MOODS = Object.freeze([
  { value: 1, label: "Very low" },
  { value: 2, label: "Low" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
]);

// Energy, shown as a jar.
export const ENERGY = Object.freeze([
  { value: 1, label: "Empty" },
  { value: 2, label: "Running low" },
  { value: 3, label: "Half full" },
  { value: 4, label: "Mostly full" },
  { value: 5, label: "Full" },
]);

// Stress is stored from 1 (very little) to 5 (too much), shown as that many stones.
export const STRESS = Object.freeze([
  { value: 1, label: "Very little" },
  { value: 2, label: "A little" },
  { value: 3, label: "Some" },
  { value: 4, label: "A lot" },
  { value: 5, label: "Too much" },
]);

// Closeness to the partner, shown as two circles.
export const CLOSENESS = Object.freeze([
  { value: 1, label: "Far apart" },
  { value: 2, label: "A bit apart" },
  { value: 3, label: "Side by side" },
  { value: 4, label: "Close" },
  { value: 5, label: "Very close" },
]);

export const BODY_AREAS = Object.freeze([
  { value: "head", label: "Head" },
  { value: "jaw", label: "Jaw" },
  { value: "shoulders", label: "Shoulders" },
  { value: "chest", label: "Chest" },
  { value: "stomach", label: "Stomach" },
  { value: "hands", label: "Hands" },
  { value: "back", label: "Back" },
]);

export const LIFTS = Object.freeze([
  { value: "sleep", label: "Some sleep" },
  { value: "food", label: "Food I enjoyed" },
  { value: "outside", label: "Fresh air" },
  { value: "laugh", label: "A laugh" },
  { value: "hug", label: "A hug" },
  { value: "baby", label: "A moment with the baby" },
  { value: "alone", label: "Time to myself" },
  { value: "friend", label: "Talking to someone" },
]);

// What each answer says back. The point is to make the parent notice, not to grade them.
export const REFLECT = Object.freeze({
  mood: {
    1: "That is a really hard place to be. You do not have to fix it tonight. Just get through the next few hours, with help.",
    2: "A low one. Is it tiredness, worry, or something heavier? They each need something different.",
    3: "Somewhere in between. What one thing would tip today a little better?",
    4: "A good one. What helped? It is worth noticing so you can do it again.",
    5: "A bright one. Hold on to what made it so.",
  },
  energy: {
    1: "Running on empty is not a character flaw. It means you need refuelling, not more effort.",
    2: "Running low. What would add even a little: food, water, twenty minutes off duty?",
    3: "Enough to get by, with not much to spare. Worth protecting.",
    4: "Mostly full. Notice what is filling it.",
    5: "A full tank. Could you share some of it with your partner tonight?",
  },
  stress: {
    1: "Not much to carry today. Enjoy that.",
    2: "A little to carry. Which stone is it?",
    3: "A fair load. Is any of it something that could wait until tomorrow?",
    4: "A heavy load. Which one stone could someone else hold for a while?",
    5: "That is more than one person should hold. Pick one stone to hand over today, even a small one.",
  },
  closeness: {
    1: "Far apart. That is common when you are both running on empty, and it does come back. Ten minutes together that is not about the baby helps more than one big talk.",
    2: "A bit apart. What small thing would bring you closer: a hug, a thank you, a cup of tea together?",
    3: "Side by side. Working as a team, maybe with little room for each other. That is normal right now.",
    4: "Close. Tell them. It means something to hear it.",
    5: "Very close. Remember this on the harder days.",
  },
});

export const BODY_PROMPT = "Try it now: drop your shoulders, unclench your jaw, and breathe out slowly. Did anything shift?";

// One kind sentence for the summary, from the hardest thing the answers show.
export function kindWords({ mood, energy, stress, lifts = [] }) {
  if (mood <= 2 || energy === 1) return "You are doing a hard thing on very little. That counts.";
  if (stress >= 4) return "You are carrying a lot. Putting one thing down is allowed.";
  if (lifts.length) return "Something gave back today. Try to make room for it again tomorrow.";
  return "You stopped for a minute to check on yourself. That counts too.";
}

export const MAX_CONCERNS = 3;

export const CONCERNS = Object.freeze([
  { value: "exhausted", label: "Tiredness" },
  { value: "overwhelmed", label: "Feeling overwhelmed" },
  { value: "anxious", label: "Worry" },
  { value: "isolated", label: "Feeling alone" },
  { value: "disconnected", label: "Distance between us" },
  { value: "body-image", label: "My body" },
  { value: "provider-pressure", label: "Pressure to provide" },
  { value: "return-to-work", label: "Going back to work" },
  { value: "pumping", label: "Pumping" },
  { value: "parenting-confidence", label: "Unsure as a parent" },
]);

const guide = (id) => ({ path: ROUTES.SUPPORT, query: { guide: id } });

// Two ideas per concern. `to` is optional: some ideas are something to do, not somewhere to go.
export const IDEAS = Object.freeze({
  exhausted: [
    { title: "Hand over the next stretch", body: "Pick a block tonight where your partner owns everything, so you can switch off properly, not just lie down.", action: "Open sleep rota", to: ROUTES.ROTA },
    { title: "Drop one thing from tomorrow", body: "Postpone one task that can wait. Feeding, medication and rest come first.", action: "Read the guide", to: guide("sleep") },
  ],
  overwhelmed: [
    { title: "Shrink it to the next hour", body: "Keep only feeding, medication and anything urgent. Everything else can wait until you have slept.", action: "Read the guide", to: guide("more-than-tired") },
    { title: "Ask for one specific thing", body: "A clear ask is easier to say yes to: \"Can you take the next feed so I can shower and eat?\"", action: "Write to your partner", to: ROUTES.HOME },
  ],
  anxious: [
    { title: "Urgent, or a worry?", body: "If something feels medically wrong, call your doctor. If not, write the worry down as one question to ask later.", action: "Read the guide", to: guide("more-than-tired") },
    { title: "Slow your body first", body: "Feet on the floor, name five things you can see, then five slow breaths with a longer breath out.", action: "Read: Scary thoughts", to: guide("scary-thoughts") },
  ],
  isolated: [
    { title: "Reach one person today", body: "A friend, a relative or a parent group. A two line message counts.", action: "See support options", to: ROUTES.SUPPORT },
    { title: "Say it at home too", body: "Try: \"I need some company, not only help with tasks.\"", action: "Write to your partner", to: ROUTES.HOME },
  ],
  disconnected: [
    { title: "Three questions, three minutes", body: "What was hard today, what helped, and what do you need tomorrow? Ask, then swap.", action: "Read the guide", to: guide("us") },
    { title: "Add a kind word to your handover", body: "Name one thing you noticed your partner doing well. Keep it separate from the to do list.", action: "Open handover", to: ROUTES.HANDOVER },
  ],
  "body-image": [
    { title: "Comfort before correction", body: "Clothes that fit today, a proper meal, a warm shower. Recovery is not a deadline.", action: "Read the guide", to: guide("body") },
    { title: "Bring it to your check-up", body: "If something does not feel like it is healing, note when it started and ask at your next appointment.", action: "Open calendar", to: ROUTES.CALENDAR },
  ],
  "provider-pressure": [
    { title: "Name the one worry", body: "Not everything at once. The specific thing you are afraid will happen, so it can be talked about.", action: "Read the guide", to: guide("dads") },
    { title: "Share one load for a week", body: "Pick one task you carry quietly and agree who owns it for the next seven days.", action: "Review shared tasks", to: ROUTES.RETURN_TO_WORK },
  ],
  "return-to-work": [
    { title: "Plan the first week back", body: "Drop off, pick up, and who stays home if the baby is unwell. Decide it together once.", action: "Open return to work", to: ROUTES.RETURN_TO_WORK },
    { title: "Make room for the feelings", body: "Guilt and relief can both be true. Tell your partner which one is louder today." },
  ],
  pumping: [
    { title: "Find a room near work", body: "Check rooms near your office before day one, with power and somewhere to store milk.", action: "Find a pumping room", to: ROUTES.ROOMS },
    { title: "Pack the backup kit", body: "Spare parts, bags, labels and a cooler bag, ready the night before.", action: "Read the guide", to: guide("back-to-work") },
  ],
  "parenting-confidence": [
    { title: "Look back at what worked", body: "The care log holds every feed and settle that went fine. There are more than it feels like.", action: "Open care log", to: ROUTES.CARE_LOG },
    { title: "Ask early, not late", body: "When something feels off, your nurse or doctor would rather hear from you early.", action: "See support options", to: ROUTES.SUPPORT },
  ],
});

export const HARD_DAY_IDEA = Object.freeze({
  title: "Be gentle with today",
  body: "You do not need to fix how you feel. Choose one small thing: water, food, or twenty minutes off duty.",
  action: "Ask for a break",
  to: ROUTES.HOME,
});

export const STEADY_DAY_IDEA = Object.freeze({
  title: "Note what helped",
  body: "Something went right today. Telling your partner makes it easier to repeat.",
  action: "Write to your partner",
  to: ROUTES.HOME,
});

// First idea of every chosen concern, then the second ones. An empty tank or feeling far apart
// adds those ideas too. Falls back to one idea from the scales.
export function ideasFor({ mood, stress, energy, closeness, concerns = [] }) {
  const keys = [...concerns];
  if (energy && energy <= 2 && !keys.includes("exhausted")) keys.push("exhausted");
  if (closeness && closeness <= 2 && !keys.includes("disconnected")) keys.push("disconnected");
  const lists = keys.map((c) => IDEAS[c]).filter(Boolean);
  const ideas = [...lists.map((l) => l[0]), ...lists.flatMap((l) => l.slice(1))];
  if (ideas.length) return ideas;
  return [mood <= 2 || stress >= 4 ? HARD_DAY_IDEA : STEADY_DAY_IDEA];
}

// The summary shown after saving: what the answers say, what they might mean, a short plan, how
// today compares with the week, and when to talk to someone. Plain rules, no scoring.
const MOOD_PHRASE = { 1: "Today feels really hard", 2: "Today feels low", 3: "Today feels somewhere in between", 4: "Today feels fairly good", 5: "Today feels bright" };
const ENERGY_PHRASE = { 1: "your tank is empty", 2: "your tank is running low", 3: "your tank is half full", 4: "your tank is mostly full", 5: "your tank is full" };
const STRESS_PHRASE = { 1: "you are carrying very little", 2: "you are carrying a little", 3: "you are carrying a fair amount", 4: "you are carrying a lot", 5: "you are carrying more than one person should" };
const CLOSE_PHRASE = { 1: "far apart from", 2: "a bit apart from", 3: "side by side with", 4: "close to", 5: "very close to" };

const labelFor = (list, value) => list.find((o) => o.value === value)?.label ?? "";
const joinAnd = (items) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const lower = (labels) => labels.map((l) => l.charAt(0).toLowerCase() + l.slice(1));

export function readingFor(answers, { partner = "your partner", earlier = [] } = {}) {
  const { mood, energy, stress, closeness, body = [], concerns = [], lifts = [] } = answers;
  const areas = lower(body.map((b) => labelFor(BODY_AREAS, b)).filter(Boolean));
  const took = lower(concerns.map((c) => labelFor(CONCERNS, c)).filter(Boolean));
  const gave = lower(lifts.map((l) => labelFor(LIFTS, l)).filter(Boolean));

  // What today says
  const story = [];
  const first = [MOOD_PHRASE[mood], energy ? ENERGY_PHRASE[energy] : null, STRESS_PHRASE[stress]].filter(Boolean);
  story.push(`${first.length === 3 ? `${first[0]}, ${first[1]}, and ${first[2]}` : `${first[0]} and ${first[1]}`}.`);
  if (areas.length) story.push(`You are holding it in your ${joinAnd(areas)}.`);
  if (closeness) story.push(`You feel ${CLOSE_PHRASE[closeness]} ${partner}.`);
  if (took.length && gave.length) story.push(`${capital(joinAnd(took))} took the most out of you, and ${joinAnd(gave)} gave a little back.`);
  else if (took.length) story.push(`${capital(joinAnd(took))} took the most out of you, and nothing has given back yet.`);
  else if (gave.length) story.push(`${capital(joinAnd(gave))} gave a little back.`);

  // What it might mean
  const insights = [];
  if (mood <= 2 && energy && energy <= 2) {
    insights.push({ title: "This looks like depletion", body: "Low mood and an empty tank often travel together. The first fix is usually rest, food and help, not trying harder." });
  } else if (mood <= 2) {
    insights.push({ title: "Low, and not only tired", body: "Your mood is lower than your energy explains. If days like this keep coming, that is worth paying attention to." });
  }
  if (stress >= 4 && areas.length) {
    insights.push({ title: "Stress is showing up in your body", body: `Tension in your ${joinAnd(areas)} is often where stress lands first. The two minute release in your plan can take the edge off.` });
  } else if (stress >= 4) {
    insights.push({ title: "A heavy load", body: "The aim is not to carry it better. It is to put one piece down, or hand it to someone else for a while." });
  }
  if (closeness && closeness <= 2) {
    insights.push({ title: "Some distance between you", body: "Feeling apart is common when you are both stretched. It usually needs a small moment together, not a big conversation." });
  } else if (closeness >= 4 && (mood <= 2 || stress >= 4)) {
    insights.push({ title: `${capital(partner)} is on your side`, body: "You feel close even on a hard day. Leaning on that is allowed." });
  }
  if (gave.length) {
    insights.push({ title: "You know what helps", body: `${capital(joinAnd(gave))} gave something back. What helped once usually helps again, so plan it in.` });
  }
  if (mood >= 4 && stress <= 2 && insights.length < 3) {
    insights.push({ title: "A steadier day", body: "Notice what made today work. It is useful to know on the harder days." });
  }
  if (!insights.length) {
    insights.push({ title: "A middle kind of day", body: "Nothing here stands out as a warning. Keep checking in, and patterns will start to show." });
  }

  // Your next 24 hours
  const plan = [];
  const ideas = ideasFor(answers);
  plan.push({ id: "idea", title: ideas[0].title, body: ideas[0].body, action: ideas[0].action, to: ideas[0].to });
  if (areas.length) {
    plan.push({ id: "release", title: "A two minute release", body: "Sit down. Drop your shoulders, unclench your jaw and breathe out slowly five times. Then roll your shoulders back three times." });
  } else if (gave.length) {
    plan.push({ id: "again", title: "Do it again on purpose", body: `Put ${gave[0]} into tomorrow at a set time, rather than hoping it happens.` });
  }
  if (closeness && closeness <= 2) {
    plan.push({ id: "together", title: "Ten minutes together", body: `Tonight, ten minutes with ${partner} that is not about the baby or logistics. Tea, a short walk, or just sitting together.` });
  } else if (stress >= 4) {
    plan.push({ id: "handover", title: "Hand one stone over", body: `Name one task and ask ${partner} to own it until tomorrow evening.`, action: "Write to your partner", to: ROUTES.HOME });
  }
  if (plan.length < 3 && ideas[1]) plan.push({ id: "idea-2", title: ideas[1].title, body: ideas[1].body, action: ideas[1].action, to: ideas[1].to });
  if (plan.length < 3 && !plan.some((p) => p.to === ROUTES.ROTA)) {
    plan.push({ id: "rest", title: "Protect one block of sleep", body: "Agree tonight who covers which hours, so each of you gets one stretch that is properly off duty.", action: "Open sleep rota", to: ROUTES.ROTA });
  }
  if (plan.length < 3) plan.push({ id: "tomorrow", title: "Check in again tomorrow", body: "One minute, around the same time. A pattern is easier to read than a single day." });

  // Compared with your week
  let compare;
  if (!earlier.length) {
    compare = "This is your first check-in this week. Come back tomorrow and a pattern will start to show.";
  } else {
    const average = earlier.reduce((sum, e) => sum + e.mood, 0) / earlier.length;
    const days = earlier.length === 1 ? "your other check-in" : `your other ${earlier.length} check-ins`;
    if (mood - average >= 1) compare = `Today is lighter than ${days} this week.`;
    else if (average - mood >= 1) compare = `Today is heavier than ${days} this week.`;
    else compare = `Today is about the same as ${days} this week.`;
  }

  // When to talk to someone
  const lowDays = [...earlier, answers].filter((e) => e.mood <= 2).length;
  let talk = null;
  if (mood === 1 || stress === 5) {
    talk = "That sounds like a heavy day. If it keeps feeling like this, or you feel unsafe, please talk to someone today.";
  } else if (lowDays >= 3) {
    talk = `You have had ${lowDays} low days this week. If that carries on for two weeks, it is worth seeing a doctor. The check on the Support page can help you decide.`;
  }

  // If you want to share
  let share;
  if (closeness && closeness <= 2) share = "I've been feeling a bit far from you lately. Could we have ten minutes tonight, just us?";
  else if (stress >= 4 || (energy && energy <= 2)) share = "I'm running low today. I don't need you to fix anything, but could you take the next feed so I can rest?";
  else if (mood >= 4) share = "Today was a better day. Thank you for your part in it.";
  else share = "I checked in with myself today. I'm okay, but I could do with a hug.";

  return { story: story.join(" "), insights: insights.slice(0, 3), plan: plan.slice(0, 3), compare, talk, share };
}
