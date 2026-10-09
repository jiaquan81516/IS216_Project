export const PARTNER_SEES = [
  "Care log and handover notes",
  "Night rota, swaps and overrides",
  "Shared calendar and appointments",
  "Baby’s name, birth date and feeding method",
];

export const STAYS_WITH_YOU = ["Mood and stress check-ins", "Confidence rating", "Private notes and reminders"];

export function inviteMessage(link) {
  return `Join me on NurtureTrack so we can share the nights: ${link}`;
}
