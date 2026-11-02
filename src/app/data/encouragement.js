// One short line of encouragement for the top of Home. Warm and plain, never a to-do or a score.
// The line changes once a day, and late at night it is a different set, written for 3 AM.

const DAY = Object.freeze([
  "You do not have to do this perfectly. You only have to keep showing up, and you are.",
  "A baby needs warm, steady and loved. You are already giving all three.",
  "Small things count: a feed, a cuddle, a glass of water for each other.",
  "You are learning a person who cannot tell you what they need. That takes time, and you are doing it.",
  "Rest when you can. The housework will still be there, and so will your baby.",
  "Two tired parents who care this much is a good start for any baby.",
  "Ask for help early. It is a sign you are looking after the whole family.",
  "You are not behind. There is no schedule you are meant to be keeping up with.",
  "Every day you get through is a day you have already won.",
  "It is allowed to find this hard and love your baby at the same time.",
  "Notice one thing that went right today, even if it was small.",
  "You are a team. Today does not have to be carried by one pair of hands.",
  "This stage is short, even when the nights are long.",
  "Be as kind to yourself as you are being to your baby.",
]);

const NIGHT = Object.freeze([
  "It is the quiet hours. You are not alone, and morning is coming.",
  "Feed, settle, breathe. You are doing the hardest shift, and doing it well.",
  "Nobody sees this part, and it matters most. Thank you for being up.",
  "Night feeds feel endless, and they end. Sleep will come back.",
  "Whatever you are feeling right now, it will look softer in daylight.",
  "You only need to get through this one feed. Then one more.",
]);

const dayOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
};

// Late evening to early morning counts as night.
export function isNight(date = new Date()) {
  const hour = date.getHours();
  return hour >= 22 || hour < 5;
}

export function encouragementFor(date = new Date()) {
  const list = isNight(date) ? NIGHT : DAY;
  return list[dayOfYear(date) % list.length];
}

