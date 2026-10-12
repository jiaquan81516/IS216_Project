import { reactive } from "vue";

// Placeholder sample data for the handover flow. Not real care log entries.
export const SHIFT_ROWS = Object.freeze([
  {
    key: "feeds",
    label: "Feeds",
    title: "4 feeds",
    detail: "8:20 AM, 11:10 AM, 3:05 PM, 5:30 PM",
  },
  {
    key: "nappies",
    label: "Nappies",
    title: "5 changes",
    detail: "2 wet, 3 dirty. Mild redness, cream used at 2 PM.",
    receivedDetail: "Mild redness, cream used at 2 PM.",
  },
  {
    key: "sleep",
    label: "Sleep",
    title: "3 h 40 min in two naps",
    detail: "1:30 PM for 1 h 40 min, 4:00 PM for 2 h",
  },
  {
    key: "medication",
    label: "Medication",
    title: "Vitamin D drops at 8:15 AM",
    detail: "Given as on the label.",
  },
]);

export const DEFAULT_NOTE = "Baby was fussy after the 3 PM feed but settled by 4. Prefers the left side.";

export const DEFAULT_NEXT_UP = Object.freeze([
  "Feed due about 8 PM",
  "Bath at 7:30 PM, water is already out",
  "Run the sterilised bottles through the cupboard",
]);

// Shared between Daniel's send page and Mei's received page.
export const handover = reactive({
  sentAt: null,
  note: DEFAULT_NOTE,
  needsAttention: false,
  nextUp: [...DEFAULT_NEXT_UP],
  acceptedAt: null,
  draft: false,
});

function timeNow() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function sendHandover({ note, needsAttention = false, nextUp } = {}) {
  handover.note = note ?? handover.note;
  handover.needsAttention = Boolean(needsAttention);
  if (nextUp) handover.nextUp = [...nextUp];
  handover.sentAt = timeNow();
  handover.acceptedAt = null;
  handover.draft = false;
}

export function saveDraft({ note, needsAttention = false, nextUp } = {}) {
  handover.note = note ?? handover.note;
  handover.needsAttention = Boolean(needsAttention);
  if (nextUp) handover.nextUp = [...nextUp];
  handover.draft = true;
}

export function acceptHandover() {
  handover.acceptedAt = timeNow();
}
