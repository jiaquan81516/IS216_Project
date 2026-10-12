import { describe, expect, it } from "vitest";
import { agoText, buildRotaView, dutyTonight, nextUp, todaySummary, tonightDate } from "@/app/utils/homeSummary";

const members = [
  { uid: "u1", displayName: "daniel Tan" },
  { uid: "u2", displayName: "Mei Lin" },
];
const settings = { pattern: "alternate", startDate: "2026-10-11", handoverTime: "07:00", firstOnDuty: "u1" };
const noon = new Date(2026, 9, 11, 12, 0);
const duty = (over = {}) => dutyTonight({ rotaSettings: settings, nights: {}, swaps: [], now: noon, uid: "u1", members, ...over });

describe("buildRotaView", () => {
  it("fills defaults and maps uids to me and partner", () => {
    const view = buildRotaView({ rotaSettings: null, nights: { "2026-10-12": { onCall: "u2" } }, swaps: [{ id: "s", from: "u2", status: "accepted" }], uid: "u1", now: noon });
    expect(view.pattern).toBe("alternate");
    expect(view.handoverTime).toBe("07:00");
    expect(view.startDate).toBe("2026-10-05");
    expect(view.overrides).toEqual({ "2026-10-12": "partner" });
    expect(view.swaps[0].from).toBe("partner");
  });
});

describe("tonightDate", () => {
  it("is yesterday before the handover time and today from it", () => {
    expect(tonightDate(new Date(2026, 9, 11, 6, 59), "07:00")).toBe("2026-10-10");
    expect(tonightDate(new Date(2026, 9, 11, 7, 0), "07:00")).toBe("2026-10-11");
  });
  it("crosses month and year boundaries", () => {
    expect(tonightDate(new Date(2027, 0, 1, 0, 5), "07:00")).toBe("2026-12-31");
    expect(tonightDate(new Date(2026, 2, 1, 3, 0), "07:00")).toBe("2026-02-28");
  });
  it("falls back to 07:00 for a bad time", () => {
    expect(tonightDate(new Date(2026, 9, 11, 6, 0), "nope")).toBe("2026-10-10");
  });
});

describe("dutyTonight", () => {
  it("is you when the pattern puts you on", () => {
    const r = duty();
    expect(r).toMatchObject({ state: "you", isYou: true, personUid: "u1", title: "You're on duty tonight", handoverTime: "7:00 AM", tone: "you", link: "Sleep rotation" });
    expect(r.line).toBe("Handover at 7:00 AM.");
  });
  it("is the partner on their night, with the first name and full name kept", () => {
    const r = duty({ uid: "u2" , rotaSettings: { ...settings, firstOnDuty: "u1" } });
    expect(r).toMatchObject({ state: "partner", isYou: false, personUid: "u1", name: "Daniel", fullName: "daniel Tan", title: "Daniel is on duty tonight", tone: "partner" });
  });
  it("alternates the next day", () => {
    const r = duty({ now: new Date(2026, 9, 12, 12, 0) });
    expect(r.state).toBe("partner");
    expect(r.title).toBe("Mei is on duty tonight");
  });
  it("counts the hour before handover as the night that started yesterday", () => {
    expect(duty({ now: new Date(2026, 9, 12, 6, 30) }).state).toBe("you");
    expect(duty({ now: new Date(2026, 9, 12, 7, 0) }).state).toBe("partner");
  });
  it("respects a custom handover time", () => {
    const r = duty({ rotaSettings: { ...settings, handoverTime: "05:30" }, now: new Date(2026, 9, 12, 5, 29) });
    expect(r.state).toBe("you");
    expect(r.handoverTime).toBe("5:30 AM");
  });
  it("uses a per night override", () => {
    const r = duty({ nights: { "2026-10-11": { onCall: "u2" } } });
    expect(r.state).toBe("partner");
  });
  it("uses an accepted swap but not a pending one", () => {
    expect(duty({ swaps: [{ id: "a", date: "2026-10-11", withDate: null, from: "u1", status: "accepted" }] }).state).toBe("partner");
    expect(duty({ swaps: [{ id: "a", date: "2026-10-11", withDate: null, from: "u1", status: "pending" }] }).state).toBe("you");
  });
  it("describes a split night from either side", () => {
    const split = { ...settings, pattern: "split" };
    const mine = duty({ rotaSettings: split });
    expect(mine).toMatchObject({ state: "split", isYou: true });
    expect(mine.line).toBe("You take the first half, Mei the second. Handover at 7:00 AM.");
    const theirs = duty({ rotaSettings: split, uid: "u2" });
    expect(theirs.line).toBe("Daniel takes the first half, you the second. Handover at 7:00 AM.");
  });
  it("is open for manual patterns and open overrides", () => {
    const manual = duty({ rotaSettings: { ...settings, pattern: "manual" } });
    expect(manual).toMatchObject({ state: "open", title: "Tonight is open" });
    expect(manual.line).toContain("Nobody has taken it");
    expect(duty({ nights: { "2026-10-11": { onCall: "open" } } }).state).toBe("open");
  });
  it("asks for a rota when there is none", () => {
    const r = duty({ rotaSettings: null });
    expect(r).toMatchObject({ state: "noRota", link: "Set up your night rota" });
  });
  it("asks to invite a partner when there is none", () => {
    const r = duty({ members: [members[0]] });
    expect(r.state).toBe("noPartner");
    expect(r.line).toBe("Invite your partner to share nights.");
  });
  it("falls back to Your partner when the name is missing", () => {
    const r = duty({ uid: "u2", members: [members[1], { uid: "u1" }] });
    expect(r.title).toBe("Your partner is on duty tonight");
    const split = duty({ rotaSettings: { ...settings, pattern: "split" }, members: [members[0], { uid: "u2" }] });
    expect(split.line).toContain("your partner the second");
  });
  it("accepts a prebuilt view", () => {
    const view = { pattern: "alternate", firstOnDuty: "partner", startDate: "2026-10-11", handoverTime: "08:00", overrides: {}, swaps: [] };
    const r = dutyTonight({ view, now: noon, uid: "u1", members });
    expect(r).toMatchObject({ state: "partner", handoverTime: "8:00 AM" });
  });
});

describe("todaySummary", () => {
  const t = (d) => ({ toDate: () => d });
  it("counts today only and reports the newest feed ever", () => {
    const entries = [
      { type: "feed", at: t(new Date(2026, 9, 10, 23, 59)) },
      { type: "feed", at: t(new Date(2026, 9, 11, 0, 0)) },
      { type: "nappy", at: t(new Date(2026, 9, 11, 9, 0)) },
      { type: "sleep", at: t(new Date(2026, 9, 11, 1, 0)), endedAt: t(new Date(2026, 9, 11, 2, 30)) },
    ];
    const r = todaySummary({ entries, now: noon });
    expect(r).toMatchObject({ feeds: 1, nappies: 1, sleepMinutes: 90 });
    expect(r.lastFeedAt).toEqual(new Date(2026, 9, 11, 0, 0));
  });
  it("counts a running sleep up to now", () => {
    expect(todaySummary({ entries: [{ type: "sleep", at: new Date(2026, 9, 11, 10, 0) }], now: noon }).sleepMinutes).toBe(120);
  });
  it("is empty and null-safe", () => {
    expect(todaySummary({ entries: [], now: noon })).toEqual({ feeds: 0, sleepMinutes: 0, nappies: 0, lastFeedAt: null });
    expect(todaySummary({ now: noon }).lastFeedAt).toBeNull();
  });
  it("keeps a last feed from yesterday", () => {
    const r = todaySummary({ entries: [{ type: "feed", at: new Date(2026, 9, 10, 22, 0) }], now: noon });
    expect(r.feeds).toBe(0);
    expect(r.lastFeedAt).toEqual(new Date(2026, 9, 10, 22, 0));
  });
});

describe("agoText", () => {
  it("is short and plain", () => {
    expect(agoText(new Date(2026, 9, 11, 11, 59, 40), noon)).toBe("just now");
    expect(agoText(new Date(2026, 9, 11, 11, 48), noon)).toBe("12 min ago");
    expect(agoText(new Date(2026, 9, 11, 10, 0), noon)).toBe("2 h ago");
    expect(agoText(new Date(2026, 9, 10, 9, 0), noon)).toBe("yesterday");
    expect(agoText(new Date(2026, 9, 8, 9, 0), noon)).toBe("3 d ago");
    expect(agoText(null, noon)).toBe("");
  });
});

describe("nextUp", () => {
  it("returns null with nothing to show", () => {
    expect(nextUp({ now: noon })).toBeNull();
  });
  it("falls back to the next handover, today or tomorrow", () => {
    expect(nextUp({ handoverTime: "17:00", now: noon })).toMatchObject({ kind: "handover", title: "Handover", when: "Today, 5:00 PM" });
    expect(nextUp({ handoverTime: "07:00", now: noon })).toMatchObject({ kind: "handover", when: "Tomorrow, 7:00 AM" });
  });
  it("picks the soonest across events, tasks and handover", () => {
    const events = [{ title: "Clinic", date: "2026-10-12", start: "09:00", allDay: false }];
    const tasks = [{ title: "Book jab", due: "2026-10-13", done: false }];
    expect(nextUp({ events, tasks, handoverTime: "07:00", now: noon })).toMatchObject({ kind: "handover" });
    expect(nextUp({ events, tasks, now: noon })).toMatchObject({ kind: "event", title: "Clinic", when: "Tomorrow, 9:00 AM" });
    expect(nextUp({ events: [], tasks, now: noon })).toMatchObject({ kind: "task", title: "Book jab", when: "Tue 13 Oct" });
  });
  it("skips timed events that already started and done or undated tasks", () => {
    const events = [{ title: "Earlier", date: "2026-10-11", start: "09:00" }];
    const tasks = [{ title: "Done", due: "2026-10-11", done: true }, { title: "No date", due: null }];
    expect(nextUp({ events, tasks, now: noon })).toBeNull();
  });
  it("keeps all day events and multi day events that are still running", () => {
    expect(nextUp({ events: [{ title: "Visit", date: "2026-10-11", allDay: true }], now: noon })).toMatchObject({ title: "Visit", when: "Today" });
    expect(nextUp({ events: [{ title: "Trip", date: "2026-10-09", endDate: "2026-10-12", allDay: true }], now: noon })).toMatchObject({ title: "Trip" });
  });
  it("puts an overdue task first with its date", () => {
    const r = nextUp({ tasks: [{ title: "Forms", due: "2026-10-09" }], events: [{ title: "Later", date: "2026-10-20", allDay: true }], now: noon });
    expect(r).toMatchObject({ kind: "task", when: "Overdue, 9 Oct" });
  });
  it("prefers the event over the task over the handover on a tie", () => {
    const tasks = [{ title: "T", due: "2026-10-12" }];
    const events = [{ title: "E", date: "2026-10-12", allDay: true }];
    expect(nextUp({ events, tasks, now: noon }).kind).toBe("event");
  });
});
