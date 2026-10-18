export const ROUTES = Object.freeze({
  LANDING: "/",
  JOURNEY: "/start",
  ROLE: "/role",
  ACCOUNT: "/account",
  SIGN_IN: "/signin",
  HOUSEHOLD: "/household",
  HOME: "/home",
  CARE_LOG: "/care-log",
  CHECKLIST: "/checklist",
  ROTA: "/rota",
  WELLNESS: "/wellness",
  SUPPORT: "/support",
  ROOMS: "/support/rooms",
  KIDS_CARE: "/support/kids-care",
  RETURN_TO_WORK: "/return-to-work",
  CALENDAR: "/calendar",
  SETTINGS: "/settings",
  PROFILE: "/profile",
  CARE_BRIEF: "/care-brief",
});

export const JOURNEYS = Object.freeze(["preparing", "newborn", "return-to-work"]);
// Onboarding asks only whether someone is a parent or a caregiver. More specific
// caregiver roles and permissions are selected when a parent invites them.
export const ROLES = Object.freeze(["parent", "caregiver"]);
