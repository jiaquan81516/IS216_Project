import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  addEvent as apiAddEvent,
  deleteEvent as apiDeleteEvent,
  migrateLegacyCalendar,
  subscribeEvents,
  updateEvent as apiUpdateEvent,
} from "@/api/calendar";
import { EVENT_TYPES, NOTES_MAX } from "@/app/utils/calendarHelpers";
import { isIsoDate } from "@/app/utils/rotaHelpers";

const TYPES = EVENT_TYPES.map((t) => t.value);
const TIME = /^\d{2}:\d{2}$/;

// Keeps a draft within the shapes the page and the rules expect. Returns null when the event
// cannot be repaired (no title or no valid start date).
export function cleanEvent(data, fallbackOwner = "both") {
  if (!data || typeof data !== "object") return null;
  const title = typeof data.title === "string" ? data.title.trim().slice(0, 80) : "";
  if (!title || !isIsoDate(data.date)) return null;
  const allDay = Boolean(data.allDay);
  return {
    title,
    date: data.date,
    endDate: isIsoDate(data.endDate) && data.endDate >= data.date ? data.endDate : data.date,
    allDay,
    start: !allDay && TIME.test(data.start ?? "") ? data.start : null,
    end: !allDay && TIME.test(data.end ?? "") ? data.end : null,
    owner: data.owner || fallbackOwner,
    type: TYPES.includes(data.type) ? data.type : "family",
    notes: typeof data.notes === "string" ? data.notes.slice(0, NOTES_MAX) : "",
    // [] means "all babies". Otherwise the ids of the babies the event is for.
    babyIds: Array.isArray(data.babyIds) ? data.babyIds.filter((x) => typeof x === "string").slice(0, 20) : [],
  };
}

// The shared calendar. Firestore is the only store: nothing is kept in localStorage.
export const useCalendarStore = defineStore("app-calendar", () => {
  const events = ref([]);
  const loading = ref(true);
  const error = ref(null); // { code } or null
  const writeError = ref("");
  const householdId = ref("");
  const meUid = ref("");
  const partnerUid = ref("");

  let stop = null;
  let migrating = false;
  let run = 0;

  function unbind() {
    run += 1;
    if (stop) stop();
    stop = null;
    events.value = [];
    loading.value = true;
    error.value = null;
    writeError.value = "";
    householdId.value = "";
  }

  function fail(cause) {
    loading.value = false;
    error.value = { code: cause?.code ?? "unknown" };
  }

  async function migrate() {
    if (migrating || !householdId.value || !meUid.value) return;
    migrating = true;
    await migrateLegacyCalendar(householdId.value, meUid.value, partnerUid.value);
  }

  function bind(id, uid = "", partner = "") {
    unbind();
    const current = run;
    meUid.value = uid;
    partnerUid.value = partner;
    if (!id) return;
    householdId.value = id;
    try {
      stop = subscribeEvents(
        id,
        (list) => {
          if (current !== run) return;
          events.value = list;
          loading.value = false;
          error.value = null;
          migrate();
        },
        (cause) => {
          if (current === run) fail(cause);
        },
      );
    } catch (cause) {
      console.error("[app calendar]", cause?.code, cause);
      fail(cause);
    }
  }

  function setPartnerUid(uid) {
    partnerUid.value = uid ?? "";
  }

  const byDate = computed(() => [...events.value].sort((a, b) => String(a.date).localeCompare(String(b.date))));

  async function attempt(action, message) {
    if (!householdId.value) return false;
    writeError.value = "";
    try {
      await action();
      return true;
    } catch (cause) {
      console.error("[app calendar]", cause?.code, cause);
      writeError.value = message;
      return false;
    }
  }

  async function addEvent(data) {
    const event = cleanEvent(data, meUid.value || "both");
    if (!event) return null;
    const ok = await attempt(
      () => apiAddEvent(householdId.value, meUid.value, event),
      "We could not save the event. Check your connection and try again.",
    );
    return ok ? event : null;
  }

  async function updateEvent(id, patch) {
    const existing = events.value.find((e) => e.id === id);
    if (!existing) return null;
    const event = cleanEvent({ ...existing, ...patch }, meUid.value || "both");
    if (!event) return null;
    const ok = await attempt(
      () => apiUpdateEvent(householdId.value, id, event),
      "We could not save the event. Check your connection and try again.",
    );
    return ok ? { id, ...event } : null;
  }

  function removeEvent(id) {
    return attempt(
      () => apiDeleteEvent(householdId.value, id),
      "We could not delete the event. Check your connection and try again.",
    );
  }

  return {
    events,
    byDate,
    loading,
    error,
    writeError,
    householdId,
    meUid,
    partnerUid,
    bind,
    unbind,
    setPartnerUid,
    addEvent,
    updateEvent,
    removeEvent,
  };
});
