import { ref } from "vue";

// Shared search text for the Help pages (Right now and Reading).
export const helpQuery = ref("");

export const DEFAULT_GUIDE = "settle";

export const DOCTOR_CALL = [
  "Baby is under 3 months with a temperature of 38 C or higher",
  "Baby is hard to wake, floppy, or breathing fast",
  "Baby refuses feeds or has far fewer wet nappies",
  "Something just feels wrong to you",
];

export const guides = [
  {
    slug: "settle",
    title: "Baby won't settle",
    minutes: 4,
    blurb: "Check the basics, then try one calm thing at a time.",
    intro: "Crying is how a newborn talks. Try these two things, one at a time.",
    steps: [
      {
        title: "Offer a feed",
        body: "It has been 3 hours since the last one, so hunger is the most likely reason. Check the nappy and one layer of clothing while you are at it.",
      },
      {
        title: "Hold baby close and lower the lights",
        body: "Skin to skin or swaddled, with a fan or soft shushing in the background. Give it ten minutes before changing anything.",
      },
    ],
    callIf: DOCTOR_CALL,
  },
  {
    slug: "first-night",
    title: "First night on your own",
    minutes: 5,
    blurb: "How to set up, who to call, and what to skip.",
    intro: "Keep it small tonight. Two things will get you through.",
    steps: [
      {
        title: "Set up before it gets dark",
        body: "Put nappies, wipes, a spare outfit and a water bottle within arm's reach. Save your doctor's number in your phone so you are not searching for it later.",
      },
      {
        title: "Decide who to call",
        body: "Pick one person you can message at any hour and tell them tonight is your first on your own. Skip everything that is not feeding, changing or sleeping.",
      },
    ],
    callIf: DOCTOR_CALL,
  },
  {
    slug: "feeding",
    title: "Feeding is not going well",
    minutes: 6,
    blurb: "Latch, bottle refusal and when to ask for help.",
    intro: "Feeding can take time to learn. Start with these two steps.",
    steps: [
      {
        title: "Pause and reset",
        body: "Take a few slow breaths, check that baby is calm and awake, and try a different position. A short break often helps more than pushing on.",
      },
      {
        title: "Ask for hands-on help",
        body: "A lactation consultant, nurse or your doctor can watch a feed and spot what is hard. Asking early is normal, not a failure.",
      },
    ],
    callIf: DOCTOR_CALL,
  },
  {
    slug: "nappy-rash",
    title: "Nappy rash",
    minutes: 3,
    blurb: "What to try, and when it needs a doctor.",
    intro: "Most nappy rash settles with gentle care. Try these two things.",
    steps: [
      {
        title: "Keep the area clean and dry",
        body: "Change nappies often, clean gently with warm water, pat dry, and leave baby without a nappy for a few minutes when you can.",
      },
      {
        title: "Use a protective layer",
        body: "Apply a thin layer of barrier cream at each change. If the rash looks worse after a few days, ask your doctor or pharmacist.",
      },
    ],
    callIf: DOCTOR_CALL,
  },
  {
    slug: "fever",
    title: "Worried about a fever",
    minutes: 3,
    blurb: "Temperature thresholds and what to do.",
    intro: "A fever in a young baby needs care. Start with these two steps.",
    steps: [
      {
        title: "Take a reading",
        body: "Use a digital thermometer and note the number and the time. Dress baby in light clothing and keep the room comfortable, not hot.",
      },
      {
        title: "Know the threshold",
        body: "For a baby under 3 months, 38 C or higher means call your doctor or emergency number now. Do not wait for it to pass.",
      },
    ],
    callIf: DOCTOR_CALL,
  },
  {
    slug: "empty",
    title: "You are running on empty",
    minutes: 4,
    blurb: "Small things that help when you have slept badly.",
    intro: "Being this tired is hard. Try these two small things.",
    steps: [
      {
        title: "Hand over one block of sleep",
        body: "Ask your partner to take the next stretch, even if it is only two hours. Put your phone in another room and lie down.",
      },
      {
        title: "Eat and drink something",
        body: "Have water and a proper snack before anything else. If low mood or worry lasts more than two weeks, tell your doctor.",
      },
    ],
    callIf: DOCTOR_CALL,
  },
];

export const articles = [
  {
    id: "first-six-weeks",
    group: "For dads",
    title: "What the first six weeks actually look like",
    minutes: 6,
    blurb: "A plain timeline of feeds, sleep and what is normal.",
  },
  {
    id: "cannot-feed",
    group: "For dads",
    title: "How to help when you cannot feed the baby",
    minutes: 5,
    blurb: "Eight things to do that are not holding the baby.",
  },
  {
    id: "dad-low-mood",
    group: "For dads",
    title: "Dads get postnatal low mood too",
    minutes: 7,
    blurb: "Signs to watch for in yourself, and what helps.",
  },
  {
    id: "splitting-nights",
    group: "For both of you",
    title: "Splitting the nights without a fight",
    minutes: 4,
    blurb: "How to agree a rota and revisit it every week.",
  },
  {
    id: "how-you-are-doing",
    group: "For both of you",
    title: "Talking about how you are really doing",
    minutes: 3,
    blurb: "Three questions to ask each other, once a week.",
  },
];

export const ARTICLE_GROUPS = ["For dads", "For both of you"];

function matches(query, ...fields) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => String(f).toLowerCase().includes(q));
}

export function filterGuides(query) {
  return guides.filter((g) => matches(query, g.title, g.blurb));
}

export function filterArticles(query) {
  return articles.filter((a) => matches(query, a.title, a.blurb));
}

export function findGuide(slug) {
  return guides.find((g) => g.slug === slug) || guides.find((g) => g.slug === DEFAULT_GUIDE);
}
