// Pure helpers for the chat. No Vue, Pinia or Firebase imports.
import { toDate } from "./entryHelpers";
import { localKey } from "./stream";
import { weeklyPrompt } from "./loadHelpers";

export const MAX_SUGGESTIONS = 3;

// One tap things to say, chosen from what the app can see. Each is { text, kind, label, nudgeId }.
// `label` is what the button says. It is the message itself, except for a thank you, which says
// "Send a thank you".
// `kind` is "thanks" for a thank you, so the weekly summary can count it. A suggestion that
// answers a prompt in the chat carries its id, so sending it hides that prompt for the day.
//   nudges        the prompts buildNudges() returned
//   messages      the chat, oldest first
//   uid           the signed in parent
//   partnerLogs   how many logs the partner made in the last day
// Nothing here reads the partner's private check-ins. Anything already sent today is left out.
export function suggestionsFor({ nudges = [], messages = [], uid = "", partnerLogs = 0, now = new Date() } = {}) {
  const day = localKey(now);
  const sentToday = new Set(
    (messages ?? [])
      .filter((m) => m?.from === uid && toDate(m.createdAt) && localKey(toDate(m.createdAt)) === day)
      .map((m) => String(m.text ?? "").trim().toLowerCase()),
  );
  const kinds = new Map((nudges ?? []).map((n) => [n.kind, n]));
  const out = [];
  const add = (text, kind, nudge) =>
    out.push({ text, kind, label: kind === "thanks" && nudge ? "Send a thank you" : text, nudgeId: nudge?.id ?? null });

  const heavy = kinds.get("partner-heavy");
  const hard = kinds.get("partner-feeling");
  if (heavy) {
    add("Thank you for carrying that", "thanks", heavy);
    add("I can take the next one", "text", heavy);
  }
  if (hard) {
    add("Thinking of you", "text", hard);
    add("I have got tonight", "text", hard);
  }
  if (!heavy && !hard) {
    if (partnerLogs > 0) add("Thank you for everything today", "thanks", null);
    add(weeklyPrompt(now), "text", null);
  }
  return out.filter((s) => !sentToday.has(s.text.toLowerCase())).slice(0, MAX_SUGGESTIONS);
}
