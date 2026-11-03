// The three things a parent can ask of their partner from the Wellness page, and the ready-made replies.
// An ask is sent as a chat message (or, for taking over a night, as a request in the sleep rota). The Home page
// finds asks again by the words in them, so the words here and the words sent must stay in step.
export const ASKS = Object.freeze([
  { need: "coverTonight", match: "take over tonight" },
  { need: "checkOnMe", match: "check in on me" },
  { need: "giveSpace", match: "give me some quiet" },
]);

export const REPLIES = Object.freeze({
  coverTonight: "I have got tonight. Rest, and do not worry about the baby.",
  coverDeclined: "I cannot take tonight, I am sorry. Can we work out another way?",
  checkOnMe: "I am thinking of you. How are you doing? I am here.",
  giveSpace: "Got it. I will give you space, and I am here whenever you want me.",
});

const CANNED = Object.values(REPLIES);

// Which kind of ask a message is, or null.
export function askKind(text) {
  const lower = String(text ?? "").toLowerCase();
  return ASKS.find((a) => lower.includes(a.match))?.need ?? null;
}

// Whether a message from the person who was asked answers an ask of this kind. A reply to one ask must not
// quietly close another, so the ready-made replies only count for their own kind. Any kind message answers a
// request to check in.
export function answersAsk(need, text) {
  const t = String(text ?? "").trim();
  if (need === "coverTonight") return t === REPLIES.coverTonight || t === REPLIES.coverDeclined;
  if (need === "giveSpace") return t === REPLIES.giveSpace;
  return t === REPLIES.checkOnMe || !CANNED.includes(t);
}
