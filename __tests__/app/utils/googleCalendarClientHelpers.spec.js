import { describe, it, expect } from "vitest";
import {
  TIME_ZONE, KEY_PROP, APP_PROP, APP_VALUE, NIGHT_TITLE, NIGHT_START, NIGHT_COUNT,
  TITLE_MAX, NOTES_MAX, isClientModeAvailable, rotaKey, eventKey, parseRotaKey,
  addDaysIso, singaporeToday, fromSingaporeIso, nightBody, desiredNights, appointmentBody,
  desiredAppointments, sameBody, keyOf, planSync, fromGoogleListEvent, mapGoogleEvents,
  GoogleCalendarError, ERROR_TEXT, errorOf, googleSaid, mapHttpError, describeCounts,
} from "@/app/utils/googleCalendarClientHelpers";

describe("constants", () => {
  it("exposes the expected fixed values", () => {
    expect(TIME_ZONE).toBe("Asia/Singapore");
    expect(NIGHT_TITLE).toBe("Night duty (NurtureTrack)");
    expect(NIGHT_START).toBe("19:00");
    expect(NIGHT_COUNT).toBe(14);
  });
});

describe("isClientModeAvailable", () => {
  it("is false for empty or non-string ids", () => {
    expect(isClientModeAvailable("")).toBe(false);
    expect(isClientModeAvailable(null)).toBe(false);
    expect(isClientModeAvailable(42)).toBe(false);
  });
  it("falls back to VITE_GOOGLE_OAUTH_CLIENT_ID when no id is given", () => {
    // In this project's .env a real-looking client id is configured, so the default param
    // (reading import.meta.env) resolves truthy -- this documents that fallback, not a literal "false".
    expect(typeof isClientModeAvailable()).toBe("boolean");
  });
  it("is false for placeholder-looking ids", () => {
    expect(isClientModeAvailable("paste-your-client-id-here")).toBe(false);
    expect(isClientModeAvailable("your-client-id.apps.googleusercontent.com")).toBe(false);
  });
  it("is true for a real-looking id", () => {
    expect(isClientModeAvailable("123456-abc.apps.googleusercontent.com")).toBe(true);
  });
  it("trims whitespace before checking", () => {
    expect(isClientModeAvailable("   ")).toBe(false);
    expect(isClientModeAvailable("  123456-abc.apps.googleusercontent.com  ")).toBe(true);
  });
});

describe("rotaKey / eventKey / parseRotaKey", () => {
  it("builds and parses a rota key", () => {
    const key = rotaKey("house1", "2026-10-14", "uid1");
    expect(key).toBe("rota:house1:2026-10-14:uid1");
    expect(parseRotaKey(key)).toEqual({ householdId: "house1", date: "2026-10-14", uid: "uid1" });
  });
  it("builds an event key", () => {
    expect(eventKey("house1", "ev1")).toBe("event:house1:ev1");
  });
  it("returns null for a key that doesn't match the rota shape", () => {
    expect(parseRotaKey("event:house1:ev1")).toBeNull();
    expect(parseRotaKey("")).toBeNull();
    expect(parseRotaKey(null)).toBeNull();
    expect(parseRotaKey("rota:house1:not-a-date:uid1")).toBeNull();
  });
});

describe("addDaysIso", () => {
  it("adds and subtracts days, UTC based", () => {
    expect(addDaysIso("2026-10-14", 1)).toBe("2026-10-15");
    expect(addDaysIso("2026-10-14", -1)).toBe("2026-10-13");
  });
  it("rolls over month and year boundaries", () => {
    expect(addDaysIso("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("is a no-op for 0 days", () => {
    expect(addDaysIso("2026-10-14", 0)).toBe("2026-10-14");
  });
});

describe("singaporeToday", () => {
  it("reports the SG wall-clock date for a UTC instant still 'today' in UTC", () => {
    expect(singaporeToday(new Date("2026-10-14T10:00:00Z"))).toBe("2026-10-14");
  });
  it("rolls to the next SG day for a late-UTC instant that is already tomorrow in SG (+8)", () => {
    // 2026-10-14T20:00Z + 8h = 2026-10-15T04:00 SG wall clock
    expect(singaporeToday(new Date("2026-10-14T20:00:00Z"))).toBe("2026-10-15");
  });
});

describe("fromSingaporeIso", () => {
  it("round-trips a SG-offset dateTime back to its own date/time", () => {
    expect(fromSingaporeIso("2026-10-14T19:00:00+08:00")).toEqual({ date: "2026-10-14", time: "19:00" });
  });
  it("converts a UTC Z instant into the SG wall-clock date/time", () => {
    // 2026-10-14T16:30:00Z is 2026-10-15T00:30 SG time
    expect(fromSingaporeIso("2026-10-14T16:30:00Z")).toEqual({ date: "2026-10-15", time: "00:30" });
  });
  it("returns null for unparseable input", () => {
    expect(fromSingaporeIso("not a date")).toBeNull();
    expect(fromSingaporeIso(undefined)).toBeNull();
    expect(fromSingaporeIso(null)).toBeNull();
  });
});

describe("nightBody", () => {
  it("builds a night-duty event from 19:00 to the handover time next morning", () => {
    const body = nightBody("2026-10-14", "07:30", "rota:h:2026-10-14:u");
    expect(body.summary).toBe(NIGHT_TITLE);
    expect(body.start).toEqual({ dateTime: "2026-10-14T19:00:00+08:00", timeZone: TIME_ZONE });
    expect(body.end).toEqual({ dateTime: "2026-10-15T07:30:00+08:00", timeZone: TIME_ZONE });
    expect(body.extendedProperties.private[KEY_PROP]).toBe("rota:h:2026-10-14:u");
    expect(body.extendedProperties.private[APP_PROP]).toBe(APP_VALUE);
  });
  it("defaults the handover time to 07:00 when invalid or missing", () => {
    expect(nightBody("2026-10-14", "", "k").end.dateTime).toBe("2026-10-15T07:00:00+08:00");
    expect(nightBody("2026-10-14", "25:99", "k").end.dateTime).toBe("2026-10-15T07:00:00+08:00");
    expect(nightBody("2026-10-14", undefined, "k").end.dateTime).toBe("2026-10-15T07:00:00+08:00");
  });
});

describe("desiredNights", () => {
  const manualRota = (overrides) => ({ pattern: "manual", startDate: "2026-10-01", overrides, swaps: [] });

  it("returns [] when required params are missing or today is invalid", () => {
    expect(desiredNights({ householdId: "", uid: "u", rotaView: {}, today: "2026-10-14" })).toEqual([]);
    expect(desiredNights({ householdId: "h", uid: "", rotaView: {}, today: "2026-10-14" })).toEqual([]);
    expect(desiredNights({ householdId: "h", uid: "u", rotaView: null, today: "2026-10-14" })).toEqual([]);
    expect(desiredNights({ householdId: "h", uid: "u", rotaView: {}, today: "bad-date" })).toEqual([]);
  });

  it("includes only the nights where I am on duty (whole or split), within the window", () => {
    const overrides = {
      "2026-10-14": "me",
      "2026-10-15": "partner",
      "2026-10-16": "open",
    };
    const out = desiredNights({ householdId: "h", uid: "u", rotaView: manualRota(overrides), today: "2026-10-14", count: 3 });
    expect(out.map((n) => n.date)).toEqual(["2026-10-14"]);
    expect(out[0].key).toBe(rotaKey("h", "2026-10-14", "u"));
    expect(out[0].body.summary).toBe(NIGHT_TITLE);
  });

  it("includes a split night where I only take the second half", () => {
    // split pattern: the stored `who` takes the first half, `second` is the other person
    const rota = { pattern: "split", firstOnDuty: "partner", startDate: "2026-10-14", overrides: {}, swaps: [] };
    const out = desiredNights({ householdId: "h", uid: "u", rotaView: rota, today: "2026-10-14", count: 1 });
    expect(out).toHaveLength(1); // day 0: firstOnDuty=partner is first half, "me" is second half -> included
  });

  it("respects a count that isn't a multiple of 7 (the >= cutoff guard)", () => {
    const overrides = Object.fromEntries(
      Array.from({ length: 14 }, (_, i) => [addDaysIso("2026-10-14", i), "me"]),
    );
    const out = desiredNights({ householdId: "h", uid: "u", rotaView: manualRota(overrides), today: "2026-10-14", count: 10 });
    expect(out).toHaveLength(10);
    expect(out.at(-1).date).toBe(addDaysIso("2026-10-14", 9));
  });

  it("defaults count to NIGHT_COUNT (14)", () => {
    const overrides = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [addDaysIso("2026-10-14", i), "me"]),
    );
    const out = desiredNights({ householdId: "h", uid: "u", rotaView: manualRota(overrides), today: "2026-10-14" });
    expect(out).toHaveLength(14);
  });
});

describe("appointmentBody", () => {
  it("returns null for a missing or invalid date", () => {
    expect(appointmentBody(null, "h")).toBeNull();
    expect(appointmentBody({ date: "bad" }, "h")).toBeNull();
  });

  it("builds an all-day body with Google's exclusive end date", () => {
    const body = appointmentBody({ id: "e1", date: "2026-10-14", allDay: true, title: "Checkup" }, "h");
    expect(body.start).toEqual({ date: "2026-10-14" });
    expect(body.end).toEqual({ date: "2026-10-15" });
    expect(body.extendedProperties.private[KEY_PROP]).toBe(eventKey("h", "e1"));
  });

  it("builds a multi-day all-day body spanning to the day after the end date", () => {
    const body = appointmentBody({ id: "e1", date: "2026-10-14", endDate: "2026-10-16", allDay: true, title: "Trip" }, "h");
    expect(body.start).toEqual({ date: "2026-10-14" });
    expect(body.end).toEqual({ date: "2026-10-17" });
  });

  it("builds a timed single-day body", () => {
    const body = appointmentBody({ id: "e1", date: "2026-10-14", start: "09:00", end: "10:30", title: "Meet" }, "h");
    expect(body.start).toEqual({ dateTime: "2026-10-14T09:00:00+08:00", timeZone: TIME_ZONE });
    expect(body.end).toEqual({ dateTime: "2026-10-14T10:30:00+08:00", timeZone: TIME_ZONE });
  });

  it("defaults a missing end time to 60 minutes after start, same day", () => {
    const body = appointmentBody({ id: "e1", date: "2026-10-14", start: "09:00", title: "Meet" }, "h");
    expect(body.end).toEqual({ dateTime: "2026-10-14T10:00:00+08:00", timeZone: TIME_ZONE });
  });

  it("defaults an end time that is not after the start, same day", () => {
    const body = appointmentBody({ id: "e1", date: "2026-10-14", start: "09:00", end: "09:00", title: "Meet" }, "h");
    expect(body.end).toEqual({ dateTime: "2026-10-14T10:00:00+08:00", timeZone: TIME_ZONE });
  });

  it("rolls the default end time into the next day when start is close to midnight", () => {
    const body = appointmentBody({ id: "e1", date: "2026-10-14", start: "23:30", title: "Late" }, "h");
    expect(body.end).toEqual({ dateTime: "2026-10-15T00:30:00+08:00", timeZone: TIME_ZONE });
  });

  it("keeps a valid overnight multi-day timed event as given", () => {
    const body = appointmentBody(
      { id: "e1", date: "2026-10-14", endDate: "2026-10-15", start: "22:00", end: "06:00", title: "Overnight" },
      "h",
    );
    expect(body.start).toEqual({ dateTime: "2026-10-14T22:00:00+08:00", timeZone: TIME_ZONE });
    expect(body.end).toEqual({ dateTime: "2026-10-15T06:00:00+08:00", timeZone: TIME_ZONE });
  });

  it("defaults a missing end time on a multi-day event to the event's own last day, not the start day", () => {
    const body = appointmentBody(
      { id: "e1", date: "2026-10-14", endDate: "2026-10-16", start: "22:00", title: "Multi, no end" },
      "h",
    );
    expect(body.end).toEqual({ dateTime: "2026-10-16T23:00:00+08:00", timeZone: TIME_ZONE });
  });

  it("treats all-day as taking priority over any start/end times present", () => {
    const body = appointmentBody({ id: "e1", date: "2026-10-14", allDay: true, start: "09:00", end: "10:00" }, "h");
    expect(body.start).toEqual({ date: "2026-10-14" });
  });

  it("falls back to 'Untitled event' and trims/caps the title and notes", () => {
    const body1 = appointmentBody({ id: "e1", date: "2026-10-14", allDay: true, title: "   " }, "h");
    expect(body1.summary).toBe("Untitled event");
    const body2 = appointmentBody({ id: "e1", date: "2026-10-14", allDay: true, title: "x".repeat(100) }, "h");
    expect(body2.summary).toHaveLength(TITLE_MAX);
    const body3 = appointmentBody({ id: "e1", date: "2026-10-14", allDay: true, notes: "y".repeat(400) }, "h");
    expect(body3.description).toHaveLength(NOTES_MAX);
  });
});

describe("desiredAppointments", () => {
  const events = [
    { id: "e1", date: "2026-10-14", allDay: true, title: "In range" },
    { id: "e2", date: "2026-10-01", allDay: true, title: "Too early" },
    { id: "e3", date: "2026-11-01", allDay: true, title: "Too late" },
    { id: "e4", date: "2026-10-10", endDate: "2026-10-16", allDay: true, title: "Spans into range" },
    { date: "2026-10-14", allDay: true, title: "No id, skipped" },
  ];
  it("keeps only events overlapping the [from, to] window and with an id", () => {
    const out = desiredAppointments({ householdId: "h", events, from: "2026-10-12", to: "2026-10-20" });
    expect(out.map((o) => o.body.summary)).toEqual(["In range", "Spans into range"]);
  });
  it("handles an empty/missing events list", () => {
    expect(desiredAppointments({ householdId: "h", events: undefined, from: "2026-10-01", to: "2026-10-31" })).toEqual([]);
  });
});

describe("sameBody", () => {
  const start = { dateTime: "2026-10-14T09:00:00+08:00" };
  const end = { dateTime: "2026-10-14T10:00:00+08:00" };

  it("is false when either side is missing", () => {
    expect(sameBody(null, { summary: "x" })).toBe(false);
    expect(sameBody({ summary: "x" }, null)).toBe(false);
  });
  it("is true when summary, description, start and end all match", () => {
    expect(sameBody({ summary: "A", description: "d", start, end }, { summary: "A", description: "d", start, end })).toBe(true);
  });
  it("is false when the summary differs", () => {
    expect(sameBody({ summary: "A", start, end }, { summary: "B", start, end })).toBe(false);
  });
  it("is false when start/end times differ", () => {
    expect(sameBody({ summary: "A", start, end: { dateTime: "2026-10-14T11:00:00+08:00" } }, { summary: "A", start, end })).toBe(false);
  });
  it("treats missing summary/description as empty strings on both sides", () => {
    expect(sameBody({ start, end }, { start, end })).toBe(true);
  });
  it("compares all-day date-only moments too", () => {
    expect(sameBody({ summary: "A", start: { date: "2026-10-14" }, end: { date: "2026-10-15" } }, { summary: "A", start: { date: "2026-10-14" }, end: { date: "2026-10-15" } })).toBe(true);
    expect(sameBody({ summary: "A", start: { date: "2026-10-14" }, end: { date: "2026-10-15" } }, { summary: "A", start: { date: "2026-10-14" }, end: { date: "2026-10-16" } })).toBe(false);
  });
});

describe("keyOf", () => {
  it("reads the private key property", () => {
    expect(keyOf({ extendedProperties: { private: { [KEY_PROP]: "abc" } } })).toBe("abc");
  });
  it("returns null when absent", () => {
    expect(keyOf({})).toBeNull();
    expect(keyOf(null)).toBeNull();
  });
});

describe("planSync", () => {
  it("inserts a desired item with no existing match", () => {
    const { inserts, patches, deletes, unchanged } = planSync({ desired: [{ key: "a", body: { summary: "A" } }] });
    expect(inserts).toEqual([{ key: "a", body: { summary: "A" } }]);
    expect(patches).toEqual([]);
    expect(deletes).toEqual([]);
    expect(unchanged).toBe(0);
  });

  it("counts a matching existing item as unchanged", () => {
    const body = { summary: "A", start: { date: "2026-10-14" }, end: { date: "2026-10-15" } };
    const existing = [{ id: "g1", key: "a", event: body }];
    const { unchanged, inserts, patches } = planSync({ desired: [{ key: "a", body }], existing });
    expect(unchanged).toBe(1);
    expect(inserts).toEqual([]);
    expect(patches).toEqual([]);
  });

  it("patches an existing item whose body differs", () => {
    const existing = [{ id: "g1", key: "a", event: { summary: "Old" } }];
    const { patches } = planSync({ desired: [{ key: "a", body: { summary: "New" } }], existing });
    expect(patches).toEqual([{ id: "g1", key: "a", body: { summary: "New" } }]);
  });

  it("deletes a managed existing item that is no longer desired", () => {
    const existing = [{ id: "g1", key: "a", event: { summary: "Gone" } }];
    const { deletes } = planSync({ desired: [], existing, isManaged: () => true });
    expect(deletes).toEqual([{ id: "g1", key: "a" }]);
  });

  it("leaves an unmanaged existing item alone", () => {
    const existing = [{ id: "g1", key: "a", event: { summary: "Not ours" } }];
    const { deletes } = planSync({ desired: [], existing, isManaged: () => false });
    expect(deletes).toEqual([]);
  });

  it("de-dupes existing items that share a key, deleting the later copies", () => {
    const existing = [
      { id: "g1", key: "a", event: { summary: "First" } },
      { id: "g2", key: "a", event: { summary: "Dup" } },
    ];
    const { deletes, unchanged } = planSync({ desired: [{ key: "a", body: { summary: "First" } }], existing });
    expect(deletes).toEqual([{ id: "g2", key: "a" }]);
    expect(unchanged).toBe(1);
  });

  it("de-dupes desired items that share a key, keeping only the first", () => {
    const { inserts } = planSync({ desired: [{ key: "a", body: { summary: "First" } }, { key: "a", body: { summary: "Second" } }] });
    expect(inserts).toEqual([{ key: "a", body: { summary: "First" } }]);
  });

  it("handles a full mixed scenario", () => {
    const existing = [
      { id: "g1", key: "unchanged", event: { summary: "Same" } },
      { id: "g2", key: "stale", event: { summary: "Stale" } },
      { id: "g3", key: "changed", event: { summary: "Old" } },
    ];
    const desired = [
      { key: "unchanged", body: { summary: "Same" } },
      { key: "changed", body: { summary: "New" } },
      { key: "new", body: { summary: "Fresh" } },
    ];
    const result = planSync({ desired, existing });
    expect(result.unchanged).toBe(1);
    expect(result.patches).toEqual([{ id: "g3", key: "changed", body: { summary: "New" } }]);
    expect(result.inserts).toEqual([{ key: "new", body: { summary: "Fresh" } }]);
    expect(result.deletes).toEqual([{ id: "g2", key: "stale" }]);
  });
});

describe("fromGoogleListEvent", () => {
  it("returns null for a cancelled event, our own (keyed) event, or a missing event", () => {
    expect(fromGoogleListEvent(null)).toBeNull();
    expect(fromGoogleListEvent({ status: "cancelled" })).toBeNull();
    expect(fromGoogleListEvent({ extendedProperties: { private: { [KEY_PROP]: "x" } } })).toBeNull();
  });

  it("maps an all-day Google event, converting the exclusive end date", () => {
    const out = fromGoogleListEvent({ id: "g1", summary: "Holiday", start: { date: "2026-10-14" }, end: { date: "2026-10-17" } });
    expect(out).toMatchObject({ id: "google:g1", title: "Holiday", date: "2026-10-14", endDate: "2026-10-16", allDay: true, source: "google" });
  });

  it("treats a missing all-day end date as a single day", () => {
    const out = fromGoogleListEvent({ id: "g1", summary: "X", start: { date: "2026-10-14" } });
    expect(out.endDate).toBe("2026-10-14");
  });

  it("maps a timed Google event using the SG wall clock", () => {
    const out = fromGoogleListEvent({
      id: "g1", summary: "Meeting",
      start: { dateTime: "2026-10-14T09:00:00+08:00" },
      end: { dateTime: "2026-10-14T10:00:00+08:00" },
    });
    expect(out).toMatchObject({ date: "2026-10-14", endDate: "2026-10-14", start: "09:00", end: "10:00", allDay: false });
  });

  it("returns null when the start dateTime can't be parsed", () => {
    expect(fromGoogleListEvent({ id: "g1", start: { dateTime: "nope" } })).toBeNull();
  });

  it("falls back to 'Busy' for an event with no summary", () => {
    expect(fromGoogleListEvent({ id: "g1", start: { date: "2026-10-14" } }).title).toBe("Busy");
  });
});

describe("mapGoogleEvents", () => {
  it("maps a list and drops nulls (cancelled/own events)", () => {
    const items = [
      { id: "g1", summary: "Keep", start: { date: "2026-10-14" } },
      { id: "g2", status: "cancelled" },
      null,
    ];
    expect(mapGoogleEvents(items).map((e) => e.id)).toEqual(["google:g1"]);
  });
  it("handles a missing list", () => {
    expect(mapGoogleEvents(undefined)).toEqual([]);
  });
});

describe("GoogleCalendarError / errorOf", () => {
  it("builds a named error carrying a code and status", () => {
    const err = errorOf("reconnect", 401);
    expect(err).toBeInstanceOf(GoogleCalendarError);
    expect(err.name).toBe("GoogleCalendarError");
    expect(err.code).toBe("reconnect");
    expect(err.status).toBe(401);
    expect(err.message).toBe(ERROR_TEXT.reconnect);
  });
  it("falls back to the 'unknown' message for an unrecognised code", () => {
    expect(errorOf("nope").message).toBe(ERROR_TEXT.unknown);
  });
});

describe("googleSaid", () => {
  it("joins reason and message", () => {
    expect(googleSaid({ error: { errors: [{ reason: "rateLimitExceeded" }], message: "Too many requests" } }))
      .toBe("rateLimitExceeded: Too many requests");
  });
  it("falls back to error.status when no errors array reason is present", () => {
    expect(googleSaid({ error: { status: "PERMISSION_DENIED", message: "nope" } })).toBe("PERMISSION_DENIED: nope");
  });
  it("collapses whitespace and caps the message length", () => {
    const long = "x".repeat(300);
    expect(googleSaid({ error: { message: `a  \n  b ${long}` } }).length).toBeLessThanOrEqual(220);
  });
  it("returns '' when there's nothing to say", () => {
    expect(googleSaid({})).toBe("");
    expect(googleSaid(undefined)).toBe("");
  });
});

describe("mapHttpError", () => {
  it("maps 401 to reconnect", () => {
    expect(mapHttpError(401, {}).code).toBe("reconnect");
  });
  it("maps 429 to rate", () => {
    expect(mapHttpError(429, {}).code).toBe("rate");
  });
  it("maps a rate-limit reason to rate even on a non-429 status", () => {
    expect(mapHttpError(403, { error: { errors: [{ reason: "rateLimitExceeded" }] } }).code).toBe("rate");
  });
  it("maps 403 to forbidden and appends what Google said", () => {
    const err = mapHttpError(403, { error: { errors: [{ reason: "insufficientPermissions" }], message: "Nope." } });
    expect(err.code).toBe("forbidden");
    expect(err.message).toContain(ERROR_TEXT.forbidden);
    expect(err.message).toContain("Google said: insufficientPermissions: Nope.");
  });
  it("leaves the message unchanged on 403 when Google said nothing", () => {
    expect(mapHttpError(403, {}).message).toBe(ERROR_TEXT.forbidden);
  });
  it("falls back to unknown for any other status", () => {
    expect(mapHttpError(500, {}).code).toBe("unknown");
    expect(mapHttpError(0, undefined).code).toBe("unknown");
  });
});

describe("describeCounts", () => {
  it("formats the three counts", () => {
    expect(describeCounts({ added: 7, updated: 2, removed: 1 })).toBe("Added 7, updated 2, removed 1");
  });
  it("defaults missing counts to 0", () => {
    expect(describeCounts()).toBe("Added 0, updated 0, removed 0");
    expect(describeCounts({ added: 3 })).toBe("Added 3, updated 0, removed 0");
  });
});
