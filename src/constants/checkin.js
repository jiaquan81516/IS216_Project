// Check-ins are private to this device. Never read these from a shared store.
export const CHECKIN_KEY = "nt.checkins.v1";

export const QUESTIONS = Object.freeze([
  {
    key: "mood",
    title: "Mood",
    hint: "How you’ve felt today",
    options: ["Low", "Down", "Okay", "Good", "Great"],
  },
  {
    key: "stress",
    title: "Stress",
    hint: "How tense or under pressure you feel",
    options: ["None", "Low", "Medium", "High", "Very high"],
  },
  {
    key: "sleep",
    title: "Sleep quality",
    hint: "How well you slept last night",
    options: ["Very poor", "Poor", "Fair", "Good", "Very good"],
  },
  {
    key: "confidence",
    title: "Confidence as a parent",
    hint: "How sure you feel about caring for the baby",
    options: ["Not at all", "A little", "Somewhat", "Mostly", "Fully"],
  },
]);

export const CHART_ROWS = Object.freeze([
  { key: "mood", label: "Mood" },
  { key: "stress", label: "Stress" },
  { key: "sleep", label: "Sleep" },
  { key: "confidence", label: "Confidence" },
]);

// Placeholder history for the six days before today, oldest first (values 1 to 5).
export const SAMPLE_HISTORY = Object.freeze({
  mood: [2, 2, 3, 2, 3, 3],
  stress: [2, 2, 1, 2, 2, 1],
  sleep: [2, 2, 2, 1, 1, 1],
  confidence: [1, 1, 2, 2, 2, 2],
});

export function dateKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function loadCheckins() {
  try {
    const raw = localStorage.getItem(CHECKIN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCheckin(answers, date = new Date()) {
  const all = loadCheckins();
  all[dateKey(date)] = { ...answers, savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(CHECKIN_KEY, JSON.stringify(all));
  } catch {
    // Storage can be blocked. The check-in simply is not remembered.
  }
  return all;
}
