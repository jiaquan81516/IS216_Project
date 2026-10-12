// The real calls: list our events on Google, plan with the pure planSync, then insert,
// patch and delete. Also reads upcoming Google events for the read only layer.
import { calendarFetch } from "@/api/googleCalendarClient";
import {
  addDaysIso,
  desiredAppointments,
  desiredNights,
  APP_PROP,
  APP_VALUE,
  keyOf,
  mapGoogleEvents,
  NIGHT_COUNT,
  parseRotaKey,
  planSync,
  singaporeToday,
} from "@/app/utils/googleCalendarClientHelpers";

const EVENTS = "/calendars/primary/events";
const midnight = (date) => `${date}T00:00:00+08:00`;
const query = (params) =>
  Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

// Every event NurtureTrack wrote that overlaps [from, to], across result pages.
async function listManaged(from, to) {
  const found = [];
  let pageToken = "";
  for (let page = 0; page < 5; page += 1) {
    const params = {
      privateExtendedProperty: `${APP_PROP}=${APP_VALUE}`,
      timeMin: midnight(from),
      timeMax: midnight(to),
      singleEvents: "true",
      showDeleted: "false",
      maxResults: "250",
    };
    if (pageToken) params.pageToken = pageToken;
    const data = await calendarFetch(`${EVENTS}?${query(params)}`);
    for (const event of data?.items ?? []) {
      const key = keyOf(event);
      if (key && event.id) found.push({ id: event.id, key, event });
    }
    pageToken = data?.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return found;
}

// ctx: { householdId, uid, rotaView, handoverTime, events }, toggles: { rota, appointments }
export async function runSync(ctx, toggles, now = new Date()) {
  const today = singaporeToday(now);
  const from = addDaysIso(today, -1);
  const to = addDaysIso(today, 365);
  const lastNight = addDaysIso(today, NIGHT_COUNT - 1);
  const { householdId, uid } = ctx;
  if (!toggles.rota && !toggles.appointments) return { added: 0, updated: 0, removed: 0, unchanged: 0, wanted: 0 };

  const desired = [];
  if (toggles.rota) desired.push(...desiredNights({ householdId, uid, rotaView: ctx.rotaView, handoverTime: ctx.handoverTime, today }));
  if (toggles.appointments) desired.push(...desiredAppointments({ householdId, events: ctx.events, from, to }));

  const existing = (await listManaged(from, to)).filter((item) => {
    const night = parseRotaKey(item.key);
    if (night) return toggles.rota && night.householdId === householdId && night.uid === uid;
    return toggles.appointments && item.key.startsWith(`event:${householdId}:`);
  });

  const isManaged = (key) => {
    const night = parseRotaKey(key);
    if (night) return night.date >= today && night.date <= lastNight;
    return true;
  };
  const plan = planSync({ desired, existing, isManaged });

  for (const item of plan.inserts) await calendarFetch(EVENTS, { method: "POST", body: item.body });
  for (const item of plan.patches) {
    await calendarFetch(`${EVENTS}/${encodeURIComponent(item.id)}`, { method: "PATCH", body: item.body });
  }
  for (const item of plan.deletes) {
    try {
      await calendarFetch(`${EVENTS}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    } catch (cause) {
      if (cause?.status !== 404 && cause?.status !== 410) throw cause;
    }
  }
  return { added: plan.inserts.length, updated: plan.patches.length, removed: plan.deletes.length, unchanged: plan.unchanged, wanted: desired.length };
}

// Upcoming events (next 14 days) from the primary calendar, mapped for the read only layer.
export async function fetchUpcoming(now = new Date()) {
  const today = singaporeToday(now);
  const params = {
    timeMin: midnight(today),
    timeMax: midnight(addDaysIso(today, 14)),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  };
  const data = await calendarFetch(`${EVENTS}?${query(params)}`);
  return mapGoogleEvents(data?.items);
}
