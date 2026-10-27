import { DOCTOR_CALL, guides } from "@/constants/help";

// Guides reuse the V2 help content as is (src/data/help.js). Nothing is added here.
export const SUPPORT_GUIDES = Object.freeze(
  guides.map((g) => ({
    slug: g.slug,
    title: g.title,
    blurb: g.blurb,
    intro: g.intro,
    steps: g.steps,
    callIf: g.callIf ?? DOCTOR_CALL,
  })),
);

// Contacts copied from the V2 Help side panel. The team has not verified these numbers or hours.
export const TRUSTED_RESOURCES = Object.freeze([
  {
    id: "emergency",
    name: "Local emergency number",
    purpose: "If you or your partner feel unsafe, or are thinking about self-harm, call straight away.",
    tel: null,
    telLabel: "",
  },
  {
    id: "doctor",
    name: "Your doctor or clinic",
    purpose: "For mood, sleep or feeding concerns that last more than two weeks.",
    tel: null,
    telLabel: "",
  },
  {
    id: "sos",
    name: "Samaritans of Singapore",
    purpose: "24-hour helpline for anyone who needs to talk.",
    tel: "tel:1767",
    telLabel: "1767",
  },
  {
    id: "imh",
    name: "IMH Mental Health Helpline",
    purpose: "Mental health support and advice.",
    tel: "tel:+6563892222",
    telLabel: "6389 2222",
  },
]);

// A phone link for a contact. Saved contacts keep only the number as typed, so the link is
// built from its digits; the built-in ones carry their own link.
export function contactHref(contact) {
  if (contact.tel) return contact.tel;
  const digits = String(contact.telLabel ?? "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}
