import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { EVENT_OWNERS, EVENT_TYPES, NOTES_MAX } from "@/v3/api/calendarHelpers";
import { isIsoDate } from "@/v3/api/rotaHelpers";

export const CALENDAR_KEY = "nt.v3.calendar";

const TYPES = EVENT_TYPES.map((t) => t.value);
const TIME = /^\d{2}:\d{2}$/;

function makeId() {
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Returns a clean event, or null when it cannot be repaired (no title or no valid date).
function cleanEvent(e) {
  if (!e || typeof e !== "object") return null;
  const title = typeof e.title === "string" ? e.title.trim().slice(0, 80) : "";
  if (!title || !isIsoDate(e.date)) return null;
  const endDate = isIsoDate(e.endDate) && e.endDate >= e.date ? e.endDate : e.date;
  const allDay = Boolean(e.allDay);
  return {
    id: String(e.id ?? makeId()),
    title,
    date: e.date,
    endDate,
    allDay,
    start: !allDay && TIME.test(e.start ?? "") ? e.start : null,
    end: !allDay && TIME.test(e.end ?? "") ? e.end : null,
    owner: EVENT_OWNERS.includes(e.owner) ? e.owner : "both",
    type: TYPES.includes(e.type) ? e.type : "family",
    notes: typeof e.notes === "string" ? e.notes.slice(0, NOTES_MAX) : "",
  };
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(CALENDAR_KEY) || "null");
    if (!Array.isArray(data)) return [];
    return data.map(cleanEvent).filter(Boolean);
  } catch {
    return [];
  }
}

// Local only until Firestore and Google Calendar sync exist. Persisted under nt.v3.calendar.
export const useCalendarStore = defineStore("v3-calendar", () => {
  const events = ref(load());

  watch(
    events,
    (value) => {
      try {
        localStorage.setItem(CALENDAR_KEY, JSON.stringify(value));
      } catch {
        // Storage can be blocked; events then live in memory only.
      }
    },
    { deep: true, flush: "sync" },
  );

  function addEvent(data) {
    const event = cleanEvent({ ...data, id: makeId() });
    if (!event) return null;
    events.value = [...events.value, event];
    return event;
  }
  function updateEvent(id, patch) {
    const index = events.value.findIndex((e) => e.id === id);
    if (index === -1) return null;
    const next = cleanEvent({ ...events.value[index], ...patch, id });
    if (!next) return null;
    events.value = events.value.map((e, i) => (i === index ? next : e));
    return next;
  }
  function removeEvent(id) {
    events.value = events.value.filter((e) => e.id !== id);
  }
  function reset() {
    events.value = [];
  }

  return { events, addEvent, updateEvent, removeEvent, reset };
});
