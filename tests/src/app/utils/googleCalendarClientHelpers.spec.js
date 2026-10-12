import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appointmentBody,
  desiredAppointments,
  desiredNights,
  describeCounts,
  eventKey,
  fromGoogleListEvent,
  isClientModeAvailable,
  KEY_PROP,
  mapHttpError,
  nightBody,
  NIGHT_TITLE,
  planSync,
  rotaKey,
  singaporeToday,
} from "@/app/utils/googleCalendarClientHelpers";

describe("isClientModeAvailable", () => {
  it("is true for a real looking id", () => {
    expect(isClientModeAvailable("123-abc.apps.googleusercontent.com")).toBe(true);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("is false for empty, missing and placeholders", () => {
    vi.stubEnv("VITE_GOOGLE_OAUTH_CLIENT_ID", "");
    for (const v of ["", "   ", undefined, null, "PASTE_YOUR_ID", "paste-here", "your-client-id.apps.googleusercontent.com"]) {
      expect(isClientModeAvailable(v)).toBe(false);
    }
  });
});

describe("keys", () => {
  it("builds the documented shapes", () => {
    expect(rotaKey("h1", "2026-10-14", "u1")).toBe("rota:h1:2026-10-14:u1");
    expect(eventKey("h1", "e9")).toBe("event:h1:e9");
  });
  it("reads Singapore today across the UTC date line", () => {
    expect(singaporeToday(new Date("2026-10-14T17:00:00Z"))).toBe("2026-10-15");
    expect(singaporeToday(new Date("2026-10-14T15:59:00Z"))).toBe("2026-10-14");
  });
});

describe("night mapping", () => {
  it("runs from the evening to the handover next morning in Asia/Singapore", () => {
    const body = nightBody("2026-10-14", "06:30", "k");
    expect(body.summary).toBe(NIGHT_TITLE);
    expect(body.start).toEqual({ dateTime: "2026-10-14T19:00:00+08:00", timeZone: "Asia/Singapore" });
    expect(body.end).toEqual({ dateTime: "2026-10-15T06:30:00+08:00", timeZone: "Asia/Singapore" });
    expect(body.extendedProperties.private[KEY_PROP]).toBe("k");
  });
  it("falls back to 07:00 for a bad handover time", () => {
    expect(nightBody("2026-10-14", "x", "k").end.dateTime).toBe("2026-10-15T07:00:00+08:00");
  });
  it("keeps only my nights in the next 14", () => {
    // Alternate, me first on Monday 12 October. Today is Wednesday 14 October (me).
    const rotaView = { pattern: "alternate", firstOnDuty: "me", startDate: "2026-10-12", overrides: {}, swaps: [] };
    const nights = desiredNights({ householdId: "h1", uid: "u1", rotaView, handoverTime: "07:00", today: "2026-10-14" });
    expect(nights.map((n) => n.date)).toEqual([
      "2026-10-14", "2026-10-16", "2026-10-18", "2026-10-20", "2026-10-22", "2026-10-24", "2026-10-26",
    ]);
    expect(nights[0].key).toBe("rota:h1:2026-10-14:u1");
  });
  it("returns nothing without a plan or a user", () => {
    expect(desiredNights({ householdId: "h1", uid: "", rotaView: {}, today: "2026-10-14" })).toEqual([]);
  });
});

describe("appointment mapping", () => {
  it("makes an all day event with an exclusive end date", () => {
    const b = appointmentBody({ id: "e1", title: "Clinic", date: "2026-10-14", endDate: "2026-10-15", allDay: true }, "h1");
    expect(b.start).toEqual({ date: "2026-10-14" });
    expect(b.end).toEqual({ date: "2026-10-16" });
    expect(b.extendedProperties.private[KEY_PROP]).toBe("event:h1:e1");
  });
  it("makes a timed event and repairs a missing or early end", () => {
    const timed = appointmentBody({ id: "e1", title: "Jab", date: "2026-10-14", allDay: false, start: "09:00", end: "10:30" }, "h1");
    expect(timed.end.dateTime).toBe("2026-10-14T10:30:00+08:00");
    const noEnd = appointmentBody({ id: "e1", title: "Jab", date: "2026-10-14", start: "23:30" }, "h1");
    expect(noEnd.end.dateTime).toBe("2026-10-15T00:30:00+08:00");
    const early = appointmentBody({ id: "e1", title: "Jab", date: "2026-10-14", start: "09:00", end: "08:00" }, "h1");
    expect(early.end.dateTime).toBe("2026-10-14T10:00:00+08:00");
  });
  it("skips events without an id, a date, or inside the window", () => {
    expect(appointmentBody({ id: "e1", title: "x", date: "bad" }, "h1")).toBeNull();
    const list = desiredAppointments({
      householdId: "h1",
      from: "2026-10-13",
      to: "2026-12-01",
      events: [
        { id: "a", title: "in", date: "2026-10-14" },
        { id: "b", title: "past", date: "2026-09-01" },
        { id: "c", title: "far", date: "2027-05-01" },
        { title: "no id", date: "2026-10-14" },
      ],
    });
    expect(list.map((x) => x.key)).toEqual(["event:h1:a"]);
  });
});

describe("planSync", () => {
  const want = (key, summary = "A") => ({
    key,
    body: { summary, description: "", start: { date: "2026-10-14" }, end: { date: "2026-10-15" } },
  });
  const have = (key, id, summary = "A") => ({
    id,
    key,
    event: { summary, description: "", start: { date: "2026-10-14" }, end: { date: "2026-10-15" } },
  });

  it("inserts what is missing", () => {
    const plan = planSync({ desired: [want("k1")], existing: [] });
    expect(plan.inserts.map((i) => i.key)).toEqual(["k1"]);
    expect(plan.patches).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });
  it("patches a changed event and leaves an identical one alone", () => {
    const plan = planSync({ desired: [want("k1", "New"), want("k2")], existing: [have("k1", "g1"), have("k2", "g2")] });
    expect(plan.patches).toEqual([{ id: "g1", key: "k1", body: want("k1", "New").body }]);
    expect(plan.unchanged).toBe(1);
    expect(plan.inserts).toEqual([]);
  });
  it("compares timed events by instant, not by string", () => {
    const body = { summary: "N", description: "", start: { dateTime: "2026-10-14T19:00:00+08:00" }, end: { dateTime: "2026-10-15T07:00:00+08:00" } };
    const event = { summary: "N", description: "", start: { dateTime: "2026-10-14T11:00:00Z" }, end: { dateTime: "2026-10-14T23:00:00Z" } };
    expect(planSync({ desired: [{ key: "k", body }], existing: [{ id: "g", key: "k", event }] }).unchanged).toBe(1);
  });
  it("deletes managed events that are no longer wanted, and only those", () => {
    const plan = planSync({
      desired: [],
      existing: [have("keep", "g1"), have("drop", "g2")],
      isManaged: (key) => key === "drop",
    });
    expect(plan.deletes).toEqual([{ id: "g2", key: "drop" }]);
  });
  it("heals a duplicate by deleting the extra copy", () => {
    const plan = planSync({ desired: [want("k1")], existing: [have("k1", "g1"), have("k1", "g2")] });
    expect(plan.deletes).toEqual([{ id: "g2", key: "k1" }]);
    expect(plan.inserts).toEqual([]);
  });
  it("is idempotent: planning the result of a plan changes nothing", () => {
    const desired = [want("k1"), want("k2")];
    const first = planSync({ desired, existing: [] });
    const existing = first.inserts.map((i, n) => ({ id: `g${n}`, key: i.key, event: i.body }));
    const second = planSync({ desired, existing });
    expect(second.inserts).toEqual([]);
    expect(second.patches).toEqual([]);
    expect(second.deletes).toEqual([]);
  });
});

describe("Google layer events", () => {
  it("maps all day and timed events and skips ours and cancelled ones", () => {
    expect(fromGoogleListEvent({ id: "1", summary: "Holiday", start: { date: "2026-10-20" }, end: { date: "2026-10-22" } })).toMatchObject({
      id: "google:1", source: "google", allDay: true, date: "2026-10-20", endDate: "2026-10-21",
    });
    expect(
      fromGoogleListEvent({ id: "2", summary: "Call", start: { dateTime: "2026-10-20T01:00:00Z" }, end: { dateTime: "2026-10-20T02:00:00Z" } }),
    ).toMatchObject({ date: "2026-10-20", start: "09:00", end: "10:00", allDay: false });
    expect(fromGoogleListEvent({ id: "3", status: "cancelled", start: { date: "2026-10-20" } })).toBeNull();
    expect(
      fromGoogleListEvent({ id: "4", start: { date: "2026-10-20" }, extendedProperties: { private: { [KEY_PROP]: "k" } } }),
    ).toBeNull();
  });
  it("gives an untitled event a title", () => {
    expect(fromGoogleListEvent({ id: "5", start: { date: "2026-10-20" }, end: { date: "2026-10-21" } }).title).toBe("Busy");
  });
});

describe("error mapping and counts", () => {
  it("maps statuses to codes with actionable text", () => {
    expect(mapHttpError(401).code).toBe("reconnect");
    const forbidden = mapHttpError(403, { error: { errors: [{ reason: "accessNotConfigured" }] } });
    expect(forbidden.code).toBe("forbidden");
    expect(forbidden.message).toMatch(/Google Calendar API/);
    expect(mapHttpError(429).code).toBe("rate");
    expect(mapHttpError(403, { error: { errors: [{ reason: "rateLimitExceeded" }] } }).code).toBe("rate");
    expect(mapHttpError(500).code).toBe("unknown");
  });
  it("describes counts", () => {
    expect(describeCounts({ added: 7, updated: 2, removed: 0 })).toBe("Added 7, updated 2, removed 0");
  });
});
