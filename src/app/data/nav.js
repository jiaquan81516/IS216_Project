import { ROUTES } from "@/app/routes";

// Sidebar items. All nine point to App pages. The checklist sits just above Handover, because
// Handover passes its open tasks on, and Handover sits between the care log and the sleep rota
// because it is the boundary between two shifts.
export const NAV = Object.freeze([
  { key: "today", label: "Home", icon: "home", to: ROUTES.HOME },
  { key: "care-log", label: "Care log", icon: "clock", to: ROUTES.CARE_LOG },
  { key: "checklist", label: "Checklist", icon: "check", to: ROUTES.CHECKLIST },
  { key: "handover", label: "Handover", icon: "handover", to: ROUTES.HANDOVER },
  { key: "rota", label: "Sleep rota", icon: "moon", to: ROUTES.ROTA },
  { key: "return-to-work", label: "Return to work", icon: "briefcase", to: ROUTES.RETURN_TO_WORK },
  { key: "calendar", label: "Calendar", icon: "calendar", to: ROUTES.CALENDAR },
  { key: "wellness", label: "Wellness", icon: "heart", to: ROUTES.WELLNESS },
  { key: "support", label: "Support", icon: "lifebuoy", to: ROUTES.SUPPORT },
]);
