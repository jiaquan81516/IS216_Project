// The Firestore modules for the shared pages: what they write, and the shape of the queries.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  addDoc: vi.fn(async () => ({ id: "new-id" })),
  deleteDoc: vi.fn(async () => {}),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  onSnapshot: vi.fn(() => () => {}),
  batch: { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) },
}));

vi.mock("@/app/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  addDoc: fs.addDoc,
  collection: (_db, ...path) => ({ kind: "collection", path }),
  deleteDoc: fs.deleteDoc,
  doc: (_db, ...path) => ({ kind: "doc", path }),
  getDoc: fs.getDoc,
  getDocs: fs.getDocs,
  limit: (n) => ({ limit: n }),
  onSnapshot: fs.onSnapshot,
  orderBy: (field, direction = "asc") => ({ orderBy: field, direction }),
  query: (ref, ...parts) => ({ kind: "query", ref, parts }),
  serverTimestamp: () => "STAMP",
  setDoc: fs.setDoc,
  updateDoc: fs.updateDoc,
  where: (field, op, value) => ({ where: field, op, value }),
  writeBatch: () => fs.batch,
}));

import * as rota from "@/app/api/rota";
import * as calendar from "@/app/api/calendar";
import * as rtw from "@/app/api/rtw";
import { LEGACY_CALENDAR_KEY, LEGACY_ROTA_KEY, LEGACY_RTW_KEY } from "@/app/api/legacy";

const HID = "h1";
const ME = "u1";
const PARTNER = "u2";

beforeEach(() => {
  localStorage.clear();
  for (const fn of [fs.addDoc, fs.deleteDoc, fs.setDoc, fs.updateDoc, fs.onSnapshot]) fn.mockClear();
  for (const fn of [fs.batch.set, fs.batch.update, fs.batch.commit]) fn.mockClear();
  fs.getDoc.mockResolvedValue({ exists: () => false });
  fs.getDocs.mockResolvedValue({ empty: true, docs: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("rota api", () => {
  it("listens to the settings document and reports null before the first save", () => {
    const onData = vi.fn();
    rota.subscribeRotaSettings(HID, onData);
    const [ref, handler] = fs.onSnapshot.mock.calls[0];
    expect(ref.path).toEqual(["households", HID, "rota", "settings"]);
    handler({ exists: () => false });
    expect(onData).toHaveBeenCalledWith(null);
    handler({ exists: () => true, data: () => ({ pattern: "split" }) });
    expect(onData).toHaveBeenLastCalledWith({ pattern: "split" });
  });

  it("asks for nights in a date range on one field, so no composite index is needed", () => {
    const onData = vi.fn();
    rota.subscribeNights(HID, "2026-10-01", "2026-10-31", onData);
    const [q, handler] = fs.onSnapshot.mock.calls[0];
    expect(q.ref.path).toEqual(["households", HID, "nights"]);
    expect(q.parts).toEqual([
      { where: "date", op: ">=", value: "2026-10-01" },
      { where: "date", op: "<=", value: "2026-10-31" },
      { orderBy: "date", direction: "asc" },
    ]);
    handler({ docs: [{ id: "2026-10-14", data: () => ({ onCall: ME }) }] });
    expect(onData).toHaveBeenCalledWith([{ date: "2026-10-14", onCall: ME }]);
  });

  it("asks for swaps newest first without filtering by status", () => {
    rota.subscribeSwaps(HID, vi.fn());
    const [q] = fs.onSnapshot.mock.calls[0];
    expect(q.parts).toEqual([{ orderBy: "createdAt", direction: "desc" }, { limit: 50 }]);
  });

  it("reports the error code and passes it on", () => {
    const onError = vi.fn();
    rota.subscribeRotaSettings(HID, vi.fn(), onError);
    const onSnapError = fs.onSnapshot.mock.calls[0][2];
    onSnapError({ code: "permission-denied" });
    expect(onError).toHaveBeenCalledWith({ code: "permission-denied" });
    expect(console.error).toHaveBeenCalledWith("[app rota]", "permission-denied", { code: "permission-denied" });
  });

  it("merges the settings so a missing document is created", async () => {
    await rota.saveRotaSettings(HID, ME, { pattern: "split" });
    const [ref, data, options] = fs.setDoc.mock.calls[0];
    expect(ref.path).toEqual(["households", HID, "rota", "settings"]);
    expect(data).toEqual({ pattern: "split", updatedAt: "STAMP", updatedBy: ME });
    expect(options).toEqual({ merge: true });
  });

  it("writes and clears one night", async () => {
    await rota.setNightOverride(HID, ME, "2026-10-14", PARTNER);
    expect(fs.setDoc.mock.calls[0][0].path).toEqual(["households", HID, "nights", "2026-10-14"]);
    expect(fs.setDoc.mock.calls[0][1]).toEqual({
      date: "2026-10-14",
      onCall: PARTNER,
      setBy: ME,
      setAt: "STAMP",
    });
    await rota.clearNightOverride(HID, "2026-10-14");
    expect(fs.deleteDoc.mock.calls[0][0].path).toEqual(["households", HID, "nights", "2026-10-14"]);
  });

  it("creates a pending swap in my own name", async () => {
    const id = await rota.requestSwap(HID, {
      date: "2026-10-14",
      withDate: "2026-10-16",
      from: ME,
      to: PARTNER,
      message: "I am unwell",
    });
    expect(id).toBe("new-id");
    expect(fs.addDoc.mock.calls[0][1]).toEqual({
      date: "2026-10-14",
      withDate: "2026-10-16",
      from: ME,
      to: PARTNER,
      status: "pending",
      message: "I am unwell",
      createdAt: "STAMP",
      respondedAt: null,
    });
  });

  it("accepting a swap applies the nights in the same batch", async () => {
    await rota.respondToSwap(HID, "s1", true, {
      uid: PARTNER,
      nights: [
        { date: "2026-10-14", onCall: PARTNER },
        { date: "2026-10-16", onCall: ME },
      ],
    });
    expect(fs.batch.update).toHaveBeenCalledTimes(1);
    expect(fs.batch.update.mock.calls[0][1]).toEqual({ status: "accepted", respondedAt: "STAMP" });
    expect(fs.batch.set).toHaveBeenCalledTimes(2);
    expect(fs.batch.set.mock.calls[0][0].path).toEqual(["households", HID, "nights", "2026-10-14"]);
    expect(fs.batch.set.mock.calls[0][1]).toMatchObject({ onCall: PARTNER, setBy: PARTNER });
    expect(fs.batch.set.mock.calls[1][1]).toMatchObject({ date: "2026-10-16", onCall: ME });
    expect(fs.batch.commit).toHaveBeenCalled();
  });

  it("declining changes nothing but the status, and cancelling is a plain update", async () => {
    await rota.respondToSwap(HID, "s1", false, { uid: PARTNER, nights: [{ date: "x", onCall: ME }] });
    expect(fs.batch.set).not.toHaveBeenCalled();
    expect(fs.batch.update.mock.calls[0][1]).toEqual({ status: "declined", respondedAt: "STAMP" });
    await rota.cancelSwap(HID, "s1");
    expect(fs.updateDoc.mock.calls[0][1]).toEqual({ status: "cancelled", respondedAt: "STAMP" });
  });
});

describe("calendar api", () => {
  it("asks for every event in date order, capped, with no window", () => {
    calendar.subscribeEvents(HID, vi.fn());
    const [q] = fs.onSnapshot.mock.calls[0];
    expect(q.ref.path).toEqual(["households", HID, "events"]);
    expect(q.parts).toEqual([{ orderBy: "date", direction: "asc" }, { limit: 500 }]);
  });

  it("narrows to a window on the one date field when asked", () => {
    calendar.subscribeEvents(HID, vi.fn(), undefined, { fromIso: "2026-10-01", toIso: "2026-10-31" });
    const [q] = fs.onSnapshot.mock.calls[0];
    expect(q.parts[0]).toEqual({ where: "date", op: ">=", value: "2026-10-01" });
    expect(q.parts[1]).toEqual({ where: "date", op: "<=", value: "2026-10-31" });
  });

  it("stamps the author and both times when adding", async () => {
    await calendar.addEvent(HID, ME, { title: "Health visitor", date: "2026-10-14", owner: "both" });
    expect(fs.addDoc.mock.calls[0][1]).toEqual({
      title: "Health visitor",
      date: "2026-10-14",
      owner: "both",
      createdBy: ME,
      createdAt: "STAMP",
      updatedAt: "STAMP",
      googleEventId: null,
    });
  });

  it("stamps updatedAt on an edit and deletes by id", async () => {
    await calendar.updateEvent(HID, "e1", { title: "Nurse" });
    expect(fs.updateDoc.mock.calls[0][0].path).toEqual(["households", HID, "events", "e1"]);
    expect(fs.updateDoc.mock.calls[0][1]).toEqual({ title: "Nurse", updatedAt: "STAMP" });
    await calendar.deleteEvent(HID, "e1");
    expect(fs.deleteDoc.mock.calls[0][0].path).toEqual(["households", HID, "events", "e1"]);
  });
});

describe("return to work api", () => {
  it("asks for tasks by due date and for the plan document", () => {
    rtw.subscribeTasks(HID, vi.fn());
    expect(fs.onSnapshot.mock.calls[0][0].parts).toEqual([{ orderBy: "due", direction: "asc" }, { limit: 200 }]);
    rtw.subscribeRtwPlan(HID, vi.fn());
    expect(fs.onSnapshot.mock.calls[1][0].path).toEqual(["households", HID, "rtw", "plan"]);
  });

  it("adds a task that is not done yet", async () => {
    await rtw.addTask(HID, ME, { title: "Book a trial", group: "childcare", owner: PARTNER, due: "2026-10-20" });
    expect(fs.addDoc.mock.calls[0][1]).toEqual({
      title: "Book a trial",
      group: "childcare",
      due: "2026-10-20",
      owner: PARTNER,
      done: false,
      doneAt: null,
      doneBy: null,
      notes: "",
      createdBy: ME,
      createdAt: "STAMP",
      updatedAt: "STAMP",
    });
  });

  it("records who ticked a task and clears that when it is unticked", async () => {
    await rtw.toggleTask(HID, "t1", true, ME);
    expect(fs.updateDoc.mock.calls[0][1]).toEqual({
      done: true,
      doneAt: "STAMP",
      doneBy: ME,
      updatedAt: "STAMP",
    });
    await rtw.toggleTask(HID, "t1", false, ME);
    expect(fs.updateDoc.mock.calls[1][1]).toEqual({ done: false, doneAt: null, doneBy: null, updatedAt: "STAMP" });
  });

  it("merges one responsibility and one pumping choice into the plan", async () => {
    await rtw.setResponsibility(HID, ME, "meals", PARTNER);
    expect(fs.setDoc.mock.calls[0][1]).toEqual({
      responsibilities: { meals: PARTNER },
      updatedAt: "STAMP",
      updatedBy: ME,
    });
    expect(fs.setDoc.mock.calls[0][2]).toEqual({ merge: true });
    await rtw.setPumping(HID, ME, { items: { "find-room": true } });
    expect(fs.setDoc.mock.calls[1][1]).toMatchObject({ pumping: { items: { "find-room": true } } });
  });
});

describe("the one time move out of localStorage", () => {
  it("lifts an old rota into the household and removes the key", async () => {
    localStorage.setItem(
      LEGACY_ROTA_KEY,
      JSON.stringify({
        pattern: "manual",
        firstOnDuty: "partner",
        startDate: "2026-10-12",
        handoverTime: "08:30",
        overrides: { "2026-10-14": "me", "2026-10-15": "partner", "2026-10-16": "open" },
      }),
    );
    expect(await rota.migrateLegacyRota(HID, ME, PARTNER)).toBe(true);
    expect(fs.setDoc.mock.calls[0][1]).toMatchObject({
      pattern: "manual",
      firstOnDuty: PARTNER,
      startDate: "2026-10-12",
      handoverTime: "08:30",
      updatedBy: ME,
    });
    const nights = fs.setDoc.mock.calls.slice(1).map((c) => c[1]);
    expect(nights).toEqual([
      { date: "2026-10-14", onCall: ME, setBy: ME, setAt: "STAMP" },
      { date: "2026-10-15", onCall: PARTNER, setBy: ME, setAt: "STAMP" },
      { date: "2026-10-16", onCall: "open", setBy: ME, setAt: "STAMP" },
    ]);
    expect(localStorage.getItem(LEGACY_ROTA_KEY)).toBeNull();
  });

  it("writes nothing when the household already has a plan, and still drops the key", async () => {
    localStorage.setItem(LEGACY_ROTA_KEY, JSON.stringify({ pattern: "split" }));
    fs.getDoc.mockResolvedValue({ exists: () => true });
    expect(await rota.migrateLegacyRota(HID, ME, PARTNER)).toBe(false);
    expect(fs.setDoc).not.toHaveBeenCalled();
    expect(localStorage.getItem(LEGACY_ROTA_KEY)).toBeNull();
  });

  it("does nothing at all when there is no old payload", async () => {
    expect(await rota.migrateLegacyRota(HID, ME, PARTNER)).toBe(false);
    expect(await calendar.migrateLegacyCalendar(HID, ME, PARTNER)).toBe(false);
    expect(await rtw.migrateLegacyRtw(HID, ME, PARTNER)).toBe(false);
    expect(fs.setDoc).not.toHaveBeenCalled();
    expect(fs.addDoc).not.toHaveBeenCalled();
  });

  it("lifts old events, turning me and partner into uids", async () => {
    localStorage.setItem(
      LEGACY_CALENDAR_KEY,
      JSON.stringify([
        { title: " Health visitor ", date: "2026-10-14", allDay: true, owner: "me", type: "appointment" },
        { title: "Theirs", date: "2026-10-15", allDay: false, start: "09:00", end: "10:00", owner: "partner" },
        { title: "", date: "2026-10-16" },
      ]),
    );
    expect(await calendar.migrateLegacyCalendar(HID, ME, PARTNER)).toBe(true);
    expect(fs.addDoc).toHaveBeenCalledTimes(2);
    expect(fs.addDoc.mock.calls[0][1]).toMatchObject({ title: "Health visitor", owner: ME, start: null });
    expect(fs.addDoc.mock.calls[1][1]).toMatchObject({ title: "Theirs", owner: PARTNER, start: "09:00" });
    expect(localStorage.getItem(LEGACY_CALENDAR_KEY)).toBeNull();
  });

  it("skips old events when the calendar already has one", async () => {
    localStorage.setItem(LEGACY_CALENDAR_KEY, JSON.stringify([{ title: "x", date: "2026-10-14" }]));
    fs.getDocs.mockResolvedValue({ empty: false, docs: [{}] });
    expect(await calendar.migrateLegacyCalendar(HID, ME, PARTNER)).toBe(false);
    expect(fs.addDoc).not.toHaveBeenCalled();
    expect(localStorage.getItem(LEGACY_CALENDAR_KEY)).toBeNull();
  });

  it("lifts an old return to work plan, its tasks and its ticks", async () => {
    localStorage.setItem(
      LEGACY_RTW_KEY,
      JSON.stringify({
        returnDate: "2026-11-04",
        tasks: [
          { title: "Book a trial", group: "childcare", owner: "partner", due: "2026-10-20", done: true },
          { title: "  ", group: "home" },
        ],
        responsibilities: { meals: "me", chores: null },
        pumping: { items: [{ key: "find-room", done: true }, { key: "pack-pump", done: false }], sessions: 3, times: ["morning"] },
      }),
    );
    expect(await rtw.migrateLegacyRtw(HID, ME, PARTNER)).toBe(true);
    expect(fs.setDoc.mock.calls[0][1]).toMatchObject({
      returnDate: "2026-11-04",
      responsibilities: { meals: ME },
      pumping: { items: { "find-room": true }, sessions: 3, times: ["morning"] },
    });
    expect(fs.addDoc).toHaveBeenCalledTimes(1);
    expect(fs.addDoc.mock.calls[0][1]).toMatchObject({ title: "Book a trial", owner: PARTNER, done: true });
    expect(localStorage.getItem(LEGACY_RTW_KEY)).toBeNull();
  });

  it("keeps a broken payload from breaking the page", async () => {
    localStorage.setItem(LEGACY_ROTA_KEY, "{not json");
    localStorage.setItem(LEGACY_RTW_KEY, "{not json");
    expect(await rota.migrateLegacyRota(HID, ME, PARTNER)).toBe(false);
    expect(await rtw.migrateLegacyRtw(HID, ME, PARTNER)).toBe(false);
    expect(fs.setDoc).not.toHaveBeenCalled();
  });
});
