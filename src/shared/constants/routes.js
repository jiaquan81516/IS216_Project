export const ROUTES = Object.freeze({
  LANDING: "/",
  SIGN_UP: "/signup",
  SIGN_IN: "/signin",
  GOOGLE: "/signin/google",
  JOIN: "/join/:code?",

  SETUP_ABOUT: "/setup/about",
  SETUP_BABY: "/setup/baby",
  SETUP_PARTNER: "/setup/partner",
  SETUP_NIGHTS: "/setup/nights",

  HOME: "/home",
  CARE_LOG: "/care-log",
  ADD_ENTRY: "/care-log/new",
  HANDOVER: "/handover",
  HANDOVER_RECEIVED: "/handover/received",
  ROTA: "/rota",
  CALENDAR: "/calendar",
  CHECK_IN: "/check-in",
  HELP: "/help",
  HELP_READING: "/help/reading",
  GUIDE: "/help/guide/:topic?",
  RETURN_TO_WORK: "/return-to-work",
  PUMPING: "/pumping-rooms",
  PUMPING_NEW: "/pumping-rooms/new",
  PUMPING_DETAIL: "/pumping-rooms/:id",
});

// Build a concrete path from a pattern, e.g. path(ROUTES.GUIDE, { topic: "settle" }).
export function path(pattern, params = {}) {
  return pattern.replace(/:(\w+)\??/g, (_, key) => params[key] ?? "").replace(/\/$/, "") || "/";
}
