import { ROUTES } from "@/app/routes";

// Top bar items. All eight point to App pages. Primary ones sit on the bar for daily use;
// secondary ones live under "More" (and in their own group in the folded menu on phones).
export const NAV = Object.freeze([
  { group: "primary", key: "today", label: "Home", icon: "home", to: ROUTES.HOME },
  { group: "primary", key: "care-log", label: "Care log", icon: "clock", to: ROUTES.CARE_LOG },
  { group: "primary", key: "checklist", label: "Checklist", icon: "check", to: ROUTES.CHECKLIST },
  { group: "primary", key: "rota", label: "Duty", icon: "moon", to: ROUTES.ROTA },
  { group: "secondary", key: "return-to-work", label: "Return to work", icon: "briefcase", to: ROUTES.RETURN_TO_WORK },
  { group: "primary", key: "calendar", label: "Calendar", icon: "calendar", to: ROUTES.CALENDAR },
  { group: "secondary", key: "wellness", label: "Wellness", icon: "heart", to: ROUTES.WELLNESS },
  { group: "secondary", key: "support", label: "Support", icon: "lifebuoy", to: ROUTES.SUPPORT },
]);

// Sections of the administrator page, opened from the sidebar as /admin?tab=<id>.
export const ADMIN_SECTIONS = Object.freeze([
  { id: "pending", label: "Pending", icon: "clock" },
  { id: "live", label: "Live rooms", icon: "pin" },
  { id: "reviewed", label: "Reviewed", icon: "check" },
  { id: "support", label: "Support", icon: "lifebuoy" },
]);
