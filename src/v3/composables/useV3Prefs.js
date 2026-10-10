import { computed, ref } from "vue";
import { DEFAULT_SETTINGS, weekStartIndex } from "@/v3/api/settingsHelpers";
import { pad2, toDate } from "@/v3/api/entryHelpers";

// The display preferences from users/{uid}.settings.display, in one small module level
// store so any V3 page can read them without loading the profile again. V3AppShell fills it
// once through useV3Home; the Settings page updates it as soon as a chip is tapped, so the
// calendar and the care log change straight away.
const display = ref({ ...DEFAULT_SETTINGS.display });

// "9:05 PM" in 12h, "21:05" in 24h. Same on every browser, like formatTime in entryHelpers.
export function formatPrefTime(value, timeFormat = "12h") {
  const date = toDate(value);
  if (!date) return "";
  const h = date.getHours();
  if (timeFormat === "24h") return `${pad2(h)}:${pad2(date.getMinutes())}`;
  return `${h % 12 || 12}:${pad2(date.getMinutes())} ${h >= 12 ? "PM" : "AM"}`;
}

function applyMotion(reduce) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (reduce) root.setAttribute("data-v3-motion", "reduce");
  else root.removeAttribute("data-v3-motion");
}

export function setV3Display(next) {
  display.value = { ...DEFAULT_SETTINGS.display, ...next };
  applyMotion(display.value.reduceMotion);
}

export function resetV3Display() {
  setV3Display(DEFAULT_SETTINGS.display);
}

export function useV3Prefs() {
  const timeFormat = computed(() => display.value.timeFormat);
  const weekStartsOn = computed(() => display.value.weekStartsOn);
  const reduceMotion = computed(() => display.value.reduceMotion);
  const weekStart = computed(() => weekStartIndex(weekStartsOn.value));
  const formatTime = (value) => formatPrefTime(value, timeFormat.value);
  return { display, timeFormat, weekStartsOn, weekStart, reduceMotion, formatTime, setV3Display };
}
