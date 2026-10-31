import { reactive } from "vue";
import { ROUTES } from "@/app/routes";

// Shared state for page changes: whether one is in progress (the app shows a loading screen
// when it is slow) and which way the sign up steps should slide.
export const STEP_ORDER = Object.freeze([ROUTES.JOURNEY, ROUTES.ROLE, ROUTES.ACCOUNT, ROUTES.HOUSEHOLD]);

export const routeMotion = reactive({ pending: false, initial: true });

export const isStepPath = (path) => STEP_ORDER.includes(path);

// "forward" or "back" for a move between two sign up steps. Written to the page as
// data-step-dir so the CSS always reads the current direction, even for the page that is leaving.
export function directionBetween(fromPath, toPath) {
  const from = STEP_ORDER.indexOf(fromPath);
  const to = STEP_ORDER.indexOf(toPath);
  return from !== -1 && to !== -1 && to < from ? "back" : "forward";
}

export function setStepDirection(direction) {
  if (typeof document !== "undefined") document.documentElement.dataset.stepDir = direction;
}
