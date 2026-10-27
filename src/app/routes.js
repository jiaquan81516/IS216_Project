// The administrator sign in lives at /signin/admin/<key>. The key comes from VITE_ADMIN_SIGNIN_KEY
// (at least 12 letters, digits, _ or -). With no valid key the page does not exist at all.
// A VITE_ value is built into the site's script, so this only hides the link from visitors
// and scanners. The admin claim and the Firestore rules are what keep the data safe.
const ADMIN_KEY = String(import.meta.env?.VITE_ADMIN_SIGNIN_KEY ?? "").trim();
const ADMIN_SIGN_IN = /^[A-Za-z0-9_-]{12,}$/.test(ADMIN_KEY) ? `/signin/admin/${ADMIN_KEY}` : "";

export const ROUTES = Object.freeze({
  LANDING: "/",
  JOURNEY: "/start",
  ROLE: "/role",
  ACCOUNT: "/account",
  SIGN_IN: "/signin",
  ADMIN_SIGN_IN,
  ADMIN: "/admin",
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
