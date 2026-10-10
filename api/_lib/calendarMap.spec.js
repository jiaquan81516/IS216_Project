import { describe, expect, it } from "vitest";
import {
  addDays,
  fromGoogleEvent,
  fromSingaporeIso,
  resolveConflict,
  sameEvent,
  shiftTime,
  TIME_ZONE,
  toGoogleEvent,
  toMillis,
  toSingaporeIso,
} from "./calendarMap.js";

const timed = {
  title: "Six week check",
  date: "2026-10-14",
  endDate: "2026-10-14",
  allDay: false,
  start: "09:30",
  end: "10:15",
  owner: "uid-1",
  type: "appointment",
  notes: "Bring the health booklet.",
};

const allDay = {
  title: "Grandparents visiting",
  date: "2026-12-24",
  endDate: "2026-12-26",
  allDay: true,
  start: null,
  end: null,
  owner: "both",
  type: "family",
  notes: "",
};

describe("date helpers", () => {
  it("adds and takes away days across a month and a year", () => {
    expect(addDays("2026-10-14", 1)).toBe("2026-10-15");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("writes and reads a Singapore wall clock", () => {
    expect(toSingaporeIso("2026-10-14", "09:30")).toBe("2026-10-14T09:30:00+08:00");
    expect(fromSingaporeIso("2026-10-14T09:30:00+08:00")).toEqual({ date: "2026-10-14", time: "09:30" });
    // The same instant written in UTC is the same Singapore wall clock.
    expect(fromSingaporeIso("2026-10-14T01:30:00Z")).toEqual({ date: "2026-10-14", time: "09:30" });
    // And an instant sent from another zone is converted, not copied.
    expect(fromSingaporeIso("2026-10-13T22:30:00-03:00")).toEqual({ date: "2026-10-14", time: "09:30" });
    expect(fromSingaporeIso("not a date")).toBe(null);
  });

  it("crosses midnight when it adds minutes to a time", () => {
    expect(shiftTime("09:30", 60)).toEqual({ time: "10:30", dayShift: 0 });
    expect(shiftTime("23:30", 60)).toEqual({ time: "00:30", dayShift: 1 });
    expect(shiftTime("00:15", -30)).toEqual({ time: "23:45", dayShift: -1 });
  });
});

describe("a NurtureTrack event becomes a Google event", () => {
  it("sends a timed event with an explicit Asia/Singapore time zone", () => {
    const body = toGoogleEvent(timed, "ev-1");
    expect(body.summary).toBe("Six week check");
    expect(body.description).toBe("Bring the health booklet.");
    expect(body.start).toEqual({ dateTime: "2026-10-14T09:30:00+08:00", timeZone: TIME_ZONE });
    expect(body.end).toEqual({ dateTime: "2026-10-14T10:15:00+08:00", timeZone: TIME_ZONE });
    expect(body.extendedProperties.private).toEqual({
      ntEventId: "ev-1",
      ntType: "appointment",
      ntOwner: "uid-1",
    });
  });

  it("gives an all day event the exclusive end date Google wants", () => {
    const body = toGoogleEvent(allDay, "ev-2");
    expect(body.start).toEqual({ date: "2026-12-24" });
    expect(body.end).toEqual({ date: "2026-12-27" });
    expect(body.start.dateTime).toBeUndefined();
  });

  it("gives a single day all day event the next day as its end", () => {
    const body = toGoogleEvent({ ...allDay, endDate: "2026-12-24" }, "ev-3");
    expect(body.end).toEqual({ date: "2026-12-25" });
  });

  it("gives a timed event with no end an hour, across midnight if it has to", () => {
    expect(toGoogleEvent({ ...timed, end: null }, "ev-4").end.dateTime).toBe("2026-10-14T10:30:00+08:00");
    const late = toGoogleEvent({ ...timed, start: "23:30", end: null }, "ev-5");
    expect(late.end.dateTime).toBe("2026-10-15T00:30:00+08:00");
  });

  it("repairs an end that is not after the start on the same day", () => {
    const body = toGoogleEvent({ ...timed, end: "09:30" }, "ev-6");
    expect(body.end.dateTime).toBe("2026-10-14T10:30:00+08:00");
  });

  it("treats an event with no start time as all day, whatever the flag says", () => {
    const body = toGoogleEvent({ ...timed, allDay: false, start: null }, "ev-7");
    expect(body.start).toEqual({ date: "2026-10-14" });
  });

  it("caps the title and the notes and falls back to a readable title", () => {
    const body = toGoogleEvent({ ...timed, title: "x".repeat(200), notes: "y".repeat(400) }, "ev-8");
    expect(body.summary.length).toBe(80);
    expect(body.description.length).toBe(280);
    expect(toGoogleEvent({ ...timed, title: "   " }, "ev-9").summary).toBe("Untitled event");
  });

  it("refuses an event with no usable start date", () => {
    expect(() => toGoogleEvent({ ...timed, date: "" }, "ev-10")).toThrowError();
    expect(() => toGoogleEvent({ ...timed, date: "14/10/2026" }, "ev-11")).toThrowError();
  });

  it("falls back to a single day when the end date is before the start", () => {
    const body = toGoogleEvent({ ...allDay, endDate: "2026-12-01" }, "ev-12");
    expect(body.end).toEqual({ date: "2026-12-25" });
  });
});

describe("a Google event becomes a NurtureTrack event", () => {
  it("reads a timed event back into Singapore date and time", () => {
    const mapped = fromGoogleEvent({
      id: "g1",
      summary: "Six week check",
      description: "Bring the health booklet.",
      start: { dateTime: "2026-10-14T09:30:00+08:00", timeZone: TIME_ZONE },
      end: { dateTime: "2026-10-14T10:15:00+08:00", timeZone: TIME_ZONE },
      extendedProperties: { private: { ntEventId: "ev-1", ntType: "appointment", ntOwner: "uid-1" } },
    });
    expect(mapped).toMatchObject({
      title: "Six week check",
      date: "2026-10-14",
      endDate: "2026-10-14",
      allDay: false,
      start: "09:30",
      end: "10:15",
      type: "appointment",
      owner: "uid-1",
      googleEventId: "g1",
    });
  });

  it("turns Google's exclusive all day end back into the last day", () => {
    const mapped = fromGoogleEvent({
      id: "g2",
      summary: "Grandparents visiting",
      start: { date: "2026-12-24" },
      end: { date: "2026-12-27" },
    });
    expect(mapped).toMatchObject({ date: "2026-12-24", endDate: "2026-12-26", allDay: true, start: null, end: null });
  });

  it("treats an event made in Google as an appointment owned by both", () => {
    const mapped = fromGoogleEvent({
      id: "g3",
      summary: "Dentist",
      start: { dateTime: "2026-11-02T14:00:00+08:00" },
      end: { dateTime: "2026-11-02T15:00:00+08:00" },
    });
    expect(mapped.type).toBe("appointment");
    expect(mapped.owner).toBe("both");
    expect(mapped.notes).toBe("");
  });

  it("reads an event that was written in another time zone", () => {
    const mapped = fromGoogleEvent({
      id: "g4",
      summary: "Call from London",
      start: { dateTime: "2026-11-02T06:00:00Z", timeZone: "Europe/London" },
      end: { dateTime: "2026-11-02T07:00:00Z", timeZone: "Europe/London" },
    });
    expect(mapped.date).toBe("2026-11-02");
    expect(mapped.start).toBe("14:00");
    expect(mapped.end).toBe("15:00");
  });

  it("handles an overnight timed event", () => {
    const mapped = fromGoogleEvent({
      id: "g5",
      summary: "Night shift",
      start: { dateTime: "2026-11-02T22:00:00+08:00" },
      end: { dateTime: "2026-11-03T06:00:00+08:00" },
    });
    expect(mapped.date).toBe("2026-11-02");
    expect(mapped.endDate).toBe("2026-11-03");
    expect(mapped.start).toBe("22:00");
    expect(mapped.end).toBe("06:00");
  });

  it("gives nothing back for an event with neither a date nor a time", () => {
    expect(fromGoogleEvent({ id: "g6", summary: "Broken" })).toBe(null);
    expect(fromGoogleEvent(null)).toBe(null);
    expect(fromGoogleEvent({ id: "g7", start: { dateTime: "nonsense" } })).toBe(null);
  });

  it("falls back to a single day when Google sends no end", () => {
    expect(fromGoogleEvent({ id: "g8", start: { date: "2026-12-24" } }).endDate).toBe("2026-12-24");
    expect(fromGoogleEvent({ id: "g9", start: { dateTime: "2026-12-24T09:00:00+08:00" } }).end).toBe(null);
  });
});

describe("the two directions agree", () => {
  it("survives a round trip for a timed event", () => {
    const body = toGoogleEvent(timed, "ev-1");
    const back = fromGoogleEvent({ id: "g1", ...body });
    expect(sameEvent(back, timed)).toBe(true);
    expect(back.owner).toBe(timed.owner);
    expect(back.type).toBe(timed.type);
  });

  it("survives a round trip for a multi day all day event", () => {
    const body = toGoogleEvent(allDay, "ev-2");
    const back = fromGoogleEvent({ id: "g2", ...body });
    expect(sameEvent(back, allDay)).toBe(true);
  });

  it("notices a real difference", () => {
    expect(sameEvent(timed, { ...timed, start: "10:00" })).toBe(false);
    expect(sameEvent(timed, null)).toBe(false);
  });
});

describe("the conflict rule", () => {
  const early = new Date("2026-10-14T09:00:00Z");
  const late = new Date("2026-10-14T11:00:00Z");

  it("gives the later side the win", () => {
    expect(resolveConflict(early, late)).toBe("remote");
    expect(resolveConflict(late, early)).toBe("local");
  });

  it("gives a tie to NurtureTrack, so a second run changes nothing", () => {
    expect(resolveConflict(late, late)).toBe("local");
  });

  it("lets a side with a timestamp beat a side without one", () => {
    expect(resolveConflict(null, late)).toBe("remote");
    expect(resolveConflict(late, null)).toBe("local");
    expect(resolveConflict(null, null)).toBe("local");
  });

  it("reads a Date, a number, an ISO string and a Firestore timestamp the same way", () => {
    const ms = late.getTime();
    expect(resolveConflict(early.getTime(), late.toISOString())).toBe("remote");
    expect(resolveConflict({ toMillis: () => ms }, early)).toBe("local");
    expect(resolveConflict({ seconds: Math.floor(ms / 1000), nanoseconds: 0 }, early)).toBe("local");
  });

  it("reads milliseconds out of every shape it is given", () => {
    expect(toMillis(1234)).toBe(1234);
    expect(toMillis(new Date(1234))).toBe(1234);
    expect(toMillis("2026-10-14T09:00:00Z")).toBe(Date.parse("2026-10-14T09:00:00Z"));
    expect(toMillis({ toMillis: () => 99 })).toBe(99);
    expect(toMillis(null)).toBe(null);
    expect(toMillis("nonsense")).toBe(null);
    expect(toMillis(NaN)).toBe(null);
  });
});
