import { V3_ROUTES } from "@/v3/routes";

// Sidebar items. All seven point to V3 pages.
export const V3_NAV = Object.freeze([
  { key: "today", label: "Today", icon: "home", to: V3_ROUTES.HOME },
  { key: "care-log", label: "Care log", icon: "clock", to: V3_ROUTES.CARE_LOG },
  { key: "rota", label: "Sleep rota", icon: "moon", to: V3_ROUTES.ROTA },
  { key: "return-to-work", label: "Return to work", icon: "briefcase", to: V3_ROUTES.RETURN_TO_WORK },
  { key: "calendar", label: "Calendar", icon: "calendar", to: V3_ROUTES.CALENDAR },
  { key: "wellness", label: "Wellness", icon: "heart", to: V3_ROUTES.WELLNESS },
  { key: "support", label: "Support", icon: "lifebuoy", to: V3_ROUTES.SUPPORT },
]);
