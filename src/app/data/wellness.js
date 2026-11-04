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

// Top 6 shown as chips. Anything else is typed in through the "Something else" option.
export const LIFTS = Object.freeze([
  { value: "sleep", label: "Some sleep" },
  { value: "food", label: "Food I enjoyed" },
  { value: "outside", label: "Fresh air" },
  { value: "laugh", label: "A laugh" },
  { value: "hug", label: "A hug" },
  { value: "baby", label: "A moment with the baby" },
]);

// What a parent can ask for, on a hard day. Optional. A kind check-in is assumed when nothing is chosen.
export const NEED_OPTIONS = Object.freeze([
  { value: "coverTonight", label: "Cover tonight", sub: "Take over tonight's shift so I can sleep" },
  { value: "checkOnMe", label: "Check on me", sub: "A kind message, and ask how I am" },
  { value: "giveSpace", label: "Give me space", sub: "Some quiet, and no questions yet" },
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

// Top 6 shown as chips. Anything else is typed in through the "Something else" option.
export const CONCERNS = Object.freeze([
  { value: "exhausted", label: "Tiredness" },
  { value: "overwhelmed", label: "Feeling overwhelmed" },
  { value: "anxious", label: "Worry" },
  { value: "isolated", label: "Feeling alone" },
  { value: "disconnected", label: "Distance between us" },
  { value: "body-image", label: "My body" },
]);

const guide = (id) => ({ path: ROUTES.SUPPORT, query: { guide: id } });

// Two ideas per concern. `to` is optional: some ideas are something to do, not somewhere to go.
export const IDEAS = Object.freeze({
  exhausted: [
    { title: "Take one block of sleep tonight", body: "Agree who has the baby from 10 PM to 2 AM, then put your phone in another room. Four hours in a row beats eight in pieces.", action: "Open sleep rota", to: ROUTES.ROTA },
    { title: "Cut tomorrow's list to three things", body: "Feeds, medication, one proper meal. Everything else can move to the weekend.", action: "Read the guide", to: guide("sleep") },
  ],
  overwhelmed: [
    { title: "Sort the list into now, today, later", body: "Write every worry in one of three piles. Only the \"now\" pile needs you before you sleep.", action: "Read the guide", to: guide("more-than-tired") },
    { title: "Ask for one specific job", body: "\"Can you do the 6 AM feed?\" gets a yes more often than \"I need help\".", action: "Message your partner", to: ROUTES.HOME },
  ],
  anxious: [
    { title: "Is it a call-the-doctor thing?", body: "If something feels medically wrong, call your doctor or nurse now. If it is a worry, write it as one question to ask at the next visit.", action: "Read the guide", to: guide("more-than-tired") },
    { title: "Ground yourself for one minute", body: "Feet flat on the floor. Name five things you can see, then breathe out for longer than you breathe in, five times.", action: "Read: Scary thoughts", to: guide("scary-thoughts") },
  ],
  isolated: [
    { title: "Message one person who has been there", body: "One line is enough: \"Rough day, can I call you later?\"", action: "See support options", to: ROUTES.SUPPORT },
    { title: "Tell your partner it is company you want", body: "Try: \"I do not need a job done. Can you sit with me for ten minutes?\"", action: "Message your partner", to: ROUTES.HOME },
  ],
  disconnected: [
    { title: "Swap three answers", body: "Ask each other what was hardest today, what helped, and what you need tomorrow. Two minutes each, and no fixing.", action: "Read the guide", to: guide("us") },
    { title: "Name one thing they did well", body: "Pick something you noticed today that is not on the to-do list, and say it out loud.", action: "Message your partner", to: ROUTES.HOME },
  ],
  "body-image": [
    { title: "Wear what fits today", body: "Clothes that fit now, a hot shower and a proper meal. Healing has no deadline.", action: "Read the guide", to: guide("body") },
    { title: "Bring it up at your check-up", body: "If something does not feel like it is healing, note when it started and ask at your next appointment.", action: "Open calendar", to: ROUTES.CALENDAR },
  ],
  "provider-pressure": [
    { title: "Say the worry out loud", body: "Name the one thing you are afraid will happen, such as money in the first year, and tell your partner. A named worry can be planned for.", action: "Read the guide", to: guide("dads") },
    { title: "Hand one job over for a week", body: "Pick a job you carry without saying so, and agree who owns it for the next seven days.", action: "Review shared tasks", to: ROUTES.CHECKLIST },
  ],
  "return-to-work": [
    { title: "Plan the first week back", body: "Who does drop-off, who does pick-up, and who stays home if the baby is unwell. Decide it once, together.", action: "Open the checklist", to: ROUTES.CHECKLIST },
    { title: "Say which feeling is louder", body: "Guilt and relief can both be true. Tell your partner which one is louder today." },
  ],
  pumping: [
    { title: "Find a room near work", body: "Check rooms near your office before day one: a plug, a lock, and somewhere to store milk.", action: "Find a pumping room", to: ROUTES.ROOMS },
    { title: "Pack the backup kit the night before", body: "Spare parts, bags, labels and a cooler bag, by the door.", action: "Read the guide", to: guide("back-to-work") },
  ],
  "parenting-confidence": [
    { title: "Scroll back through the care log", body: "Every feed and settle that went fine is in there. There are more than it feels like today.", action: "Open care log", to: ROUTES.CARE_LOG },
    { title: "Ask the nurse early", body: "If something feels off, your nurse or doctor would rather hear about it early than late.", action: "See support options", to: ROUTES.SUPPORT },
  ],
});

export const HARD_DAY_IDEA = Object.freeze({
  title: "Be gentle with today",
  body: "You do not have to fix how you feel tonight. Get one glass of water, one proper snack, and ask for twenty minutes off duty.",
  action: "Ask for a break",
  to: ROUTES.HOME,
});

export const STEADY_DAY_IDEA = Object.freeze({
  title: "Tell your partner what worked",
  body: "Something went right today. Saying what it was makes it easier to repeat.",
  action: "Message your partner",
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

// One concrete way to repeat each thing that gave something back, keyed by the lift's value.
const GIVE_AGAIN = {
  sleep: "Pick tomorrow's sleep block now and put it on the rota, so it does not depend on how the day goes.",
  food: "Decide tomorrow's lunch tonight: something you can eat with one hand, ready by midday.",
  outside: "Plan ten minutes outside after the first feed tomorrow. Put the pram by the door tonight.",
  laugh: "Save the show or voice note that made you laugh for tomorrow's late feed.",
  hug: "Ask for a proper hug when your partner finishes tomorrow, before anything else is discussed.",
  baby: "Set aside one feed tomorrow with the phone away, just the two of you.",
  alone: "Book twenty minutes alone tomorrow at a fixed time, and tell your partner when.",
  friend: "Message the same person tomorrow, even one line.",
};

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

  // What it might mean. Each one says what in the answers led to it ("from"), what it may mean
  // ("body") and one small thing to try ("tip"). At most three are shown, the most pressing first.
  const who = partner === "your partner" ? partner : capital(partner);
  const insights = [];
  const moodWord = labelFor(MOODS, mood).toLowerCase();
  const tankWord = energy ? labelFor(ENERGY, energy).toLowerCase() : "";
  const stressWord = labelFor(STRESS, stress).toLowerCase();
  if (mood <= 2 && energy && energy <= 2) {
    insights.push({
      title: "Low mood and an empty tank", art: "sleep",
      from: `Mood ${moodWord}, tank ${tankWord}`,
      body: "After weeks of broken sleep, feeling low and feeling empty usually arrive together. It says more about the hours you have slept than about how you are doing as a parent.",
      tip: `Eat something now, drink a glass of water, and ask ${who} for one stretch of sleep tonight that nobody interrupts.`,
    });
  } else if (mood <= 2) {
    insights.push({
      title: "Low, and not only tired", art: "breathe",
      from: `Mood ${moodWord}${energy ? ` while your tank is ${tankWord}` : ""}`,
      body: "Tiredness does not explain all of this. Low mood is common after birth and one day is not a worry, but if most days this week look like this, tell someone.",
      tip: "Tell one person today how you actually are, in one sentence. The Support page has a short check if it carries on.",
    });
  } else if (energy && energy <= 2 && mood >= 3) {
    insights.push({
      title: "Coping, but nearly empty", art: "water",
      from: `Tank ${tankWord}, mood ${moodWord}`,
      body: "You are managing, which means nobody can see how little is left. That is usually when something small, like a spilled bottle, tips you over.",
      tip: "Book one rest block tonight, before the evening fills up.",
    });
  }
  if (stress >= 4 && areas.length) {
    insights.push({
      title: "Your body is carrying it too", art: "breathe",
      from: `Carrying ${stressWord}, tension in your ${joinAnd(areas)}`,
      body: `Stress tends to settle in the ${joinAnd(areas)} first, and feeding and carrying a baby loads the same spots.`,
      tip: "Do the two-minute release below, or take a warm shower.",
    });
  } else if (stress >= 4) {
    insights.push({
      title: "A lot on your plate", art: "note",
      from: `Carrying ${stressWord}`,
      body: "The list is long, and most of it is probably waiting on you. The aim is to take one job off it, not to get better at carrying all of them.",
      tip: `Pick one job that does not have to be yours and ask ${who} to take it until tomorrow evening.`,
    });
  } else if (stress <= 2 && mood >= 3) {
    insights.push({
      title: "A lighter day", art: "walk",
      from: `Carrying ${stressWord}`,
      body: "Not much is pressing on you today, which is worth noticing.",
      tip: `Think back: did someone take a job, did you nap, was a feed easy? Tell ${who} so it can happen again.`,
    });
  }
  if (took.length && !gave.length) {
    insights.push({
      title: `Most of today went on ${joinAnd(took.slice(0, 2))}`, art: "tea",
      from: `You picked ${joinAnd(took)}`,
      body: "Nothing has given anything back yet, which is why today feels one-sided.",
      tip: "Before bed, do one small thing that is only for you. Ten minutes is enough.",
    });
  }
  if (closeness && closeness <= 2) {
    insights.push({
      title: `You and ${who} feel apart`, art: "apart",
      from: `You feel ${CLOSE_PHRASE[closeness]} ${who}`,
      body: "When you are both short on sleep, the time you had for each other goes first. It usually means there has been no room, not that something is wrong.",
      tip: `Ten minutes together tonight that is not about the baby: tea on the sofa, a short walk, one episode.`,
    });
  } else if (closeness >= 4 && (mood <= 2 || stress >= 4)) {
    insights.push({
      title: `${capital(who)} is close right now`, art: "hug",
      from: `You feel ${CLOSE_PHRASE[closeness]} ${who}, even on a hard day`,
      body: "Feeling close on a hard day makes it easier to ask for help.",
      tip: `Ask ${who} for one specific thing today, such as the next feed or tonight's dinner.`,
    });
  }
  if (gave.length) {
    insights.push({
      title: "What helped today", art: "sun",
      from: `${capital(joinAnd(gave))} gave something back`,
      body: "Things that helped once usually help again, and you only find out which by noticing.",
      tip: GIVE_AGAIN[lifts[0]] ?? "Pick a set time tomorrow for it, so it does not depend on how the day goes.",
    });
  }
  if (mood >= 4 && stress <= 3 && insights.length < 3) {
    insights.push({
      title: "A steadier day", art: "walk",
      from: `Mood ${moodWord}, carrying ${stressWord}`,
      body: "Mood is good and the load is manageable. Note what made today work so you can repeat it on a harder day.",
      tip: "Write one line in your phone notes about what made today work.",
    });
  }
  if (!insights.length) {
    insights.push({
      title: "An in-between day", art: "breathe",
      from: `Mood ${moodWord}${energy ? `, tank ${tankWord}` : ""}, carrying ${stressWord}`,
      body: "Nothing here stands out as a worry. Most days in these months look like this.",
      tip: "Check in at about the same time each day. After a few days the week chart shows what is normal for you.",
    });
  }
  insights.splice(4);

  // Your next 24 hours
  const plan = [];
  const ideas = ideasFor(answers);
  plan.push({ id: "idea", title: ideas[0].title, body: ideas[0].body, action: ideas[0].action, to: ideas[0].to });
  if (areas.length) {
    plan.push({ id: "release", title: "A two-minute release", body: "Sit down, drop your shoulders and unclench your jaw. Breathe out slowly five times, then roll your shoulders back three times." });
  } else if (gave.length && GIVE_AGAIN[lifts[0]]) {
    plan.push({ id: "again", title: "Repeat what helped", body: GIVE_AGAIN[lifts[0]] });
  }
  if (closeness && closeness <= 2) {
    plan.push({ id: "together", title: "Ten minutes together", body: `Tonight, ten minutes with ${who} that is not about the baby. Tea, a short walk, or one episode.` });
  } else if (stress >= 4) {
    plan.push({ id: "handover", title: "Hand one job over", body: `Choose one job from your list, say which one, and ask ${who} to take it until tomorrow evening.`, action: "Message your partner", to: ROUTES.HOME });
  }
  if (plan.length < 3 && ideas[1]) plan.push({ id: "idea-2", title: ideas[1].title, body: ideas[1].body, action: ideas[1].action, to: ideas[1].to });
  if (plan.length < 3 && !plan.some((p) => p.to === ROUTES.ROTA)) {
    plan.push({ id: "rest", title: "Protect one block of sleep", body: `Agree with ${who} who has the baby for which hours tonight, so each of you gets one stretch that is properly off duty.`, action: "Open sleep rota", to: ROUTES.ROTA });
  }
  if (plan.length < 3) plan.push({ id: "tomorrow", title: "Check in again tomorrow", body: "One minute, at about the same time. A pattern is easier to read than a single day." });

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
