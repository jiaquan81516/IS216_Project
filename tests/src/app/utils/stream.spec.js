import { describe, expect, it } from "vitest";
import { buildStream, careLine, dayLabelFor, firstNameOf, groupByDay, unreadCount } from "@/app/utils/stream";

const ME = "u1";
const MEI = "u2";
const members = [
  { uid: ME, displayName: "daniel Tan" },
  { uid: MEI, displayName: "Mei Lin" },
];
const NOW = new Date(2026, 9, 11, 12, 0, 0); // Sun 11 Oct 2026, local
const at = (d, h = 9, m = 0) => new Date(2026, 9, d, h, m);
const ts = (date) => ({ toDate: () => date });

describe("firstNameOf", () => {
  it("takes the first word and capitalises it", () => {
    expect(firstNameOf("mei lin")).toBe("Mei");
    expect(firstNameOf("")).toBe("");
    expect(firstNameOf(null)).toBe("");
  });
});

describe("buildStream messages", () => {
  const post = (over = {}) => ({ id: "p1", text: "Home by 6", authorUid: MEI, createdAt: ts(at(11, 9, 10)), ackedBy: [], ...over });

  it("normalises a partner message that needs my acknowledgement", () => {
    const [item] = buildStream({ posts: [post()], uid: ME, members, now: NOW });
    expect(item).toMatchObject({
      id: "message:p1",
      rawId: "p1",
      kind: "message",
      authorName: "Mei",
      isMine: false,
      text: "Home by 6",
      needsAck: true,
      acked: false,
      pending: false,
    });
    expect(item.at).toEqual(at(11, 9, 10));
  });

  it("marks my own message with You and acked once the partner acknowledges", () => {
    const [open] = buildStream({ posts: [post({ authorUid: ME })], uid: ME, members, now: NOW });
    expect(open).toMatchObject({ authorName: "You", isMine: true, needsAck: false, acked: false });
    const [seen] = buildStream({ posts: [post({ authorUid: ME, ackedBy: [MEI] })], uid: ME, members, now: NOW });
    expect(seen.acked).toBe(true);
    expect(seen.ackedByNames).toEqual(["Mei"]);
  });

  it("treats my acknowledgement of a partner message as acked", () => {
    const [item] = buildStream({ posts: [post({ ackedBy: [ME] })], uid: ME, members, now: NOW });
    expect(item.acked).toBe(true);
    expect(item.ackedByNames).toEqual(["you"]);
  });

  it("accepts ackedBy as a map and tolerates it missing", () => {
    const [mapped] = buildStream({ posts: [post({ ackedBy: { [ME]: ts(NOW) } })], uid: ME, members, now: NOW });
    expect(mapped.acked).toBe(true);
    const [missing] = buildStream({ posts: [post({ ackedBy: undefined })], uid: ME, members, now: NOW });
    expect(missing.acked).toBe(false);
  });

  it("puts a message with a pending serverTimestamp at the top and flags it", () => {
    const items = buildStream({
      posts: [post({ id: "old" }), post({ id: "new", authorUid: ME, createdAt: null })],
      uid: ME,
      members,
      now: NOW,
    });
    expect(items[0].rawId).toBe("new");
    expect(items[0].pending).toBe(true);
    expect(items[0].at).toEqual(NOW);
  });

  it("skips messages without text and falls back for an unknown author", () => {
    const items = buildStream({
      posts: [post({ id: "a", text: "   " }), post({ id: "b", text: undefined }), post({ id: "c", authorUid: "ghost" })],
      uid: ME,
      members,
      now: NOW,
    });
    expect(items.map((i) => i.rawId)).toEqual(["c"]);
    expect(items[0].authorName).toBe("Your partner");
  });
});

describe("buildStream care entries", () => {
  const entry = (over = {}) => ({ id: "e1", type: "feed", by: ME, byName: "Daniel", at: ts(at(11, 8)), details: { method: "bottle", ml: 120 }, ...over });

  it("writes one line per entry", () => {
    expect(careLine(entry())).toBe("Fed 120 ml");
    expect(careLine(entry({ type: "nappy", details: { nappyType: "wet" } }))).toBe("Diaper, wet nappy");
    expect(careLine(entry({ details: { method: "breast", side: "left", minutes: 15 } }))).toBe("Breastfed, left, 15 minutes");
    expect(careLine(entry({ type: "medication", details: { drug: "Vitamin D", dose: "1 drop" } }))).toBe("Medicine, Vitamin D 1 drop");
    expect(careLine(entry({ type: "sleep", at: at(11, 1), endedAt: at(11, 3, 30) }))).toBe("Slept 2 h 30 min");
    expect(careLine(entry({ type: "sleep", endedAt: null }))).toBe("Sleeping");
    expect(careLine(entry({ type: "note", details: { text: "Rash on arm" } }))).toBe("Rash on arm");
  });

  it("labels the entry as care, never needing acknowledgement", () => {
    const [item] = buildStream({ entries: [entry({ by: MEI })], uid: ME, members, now: NOW });
    expect(item).toMatchObject({ kind: "care", kindLabel: "Care", authorName: "Mei", needsAck: false });
  });

  it("uses byName for an author who is not in the members list and skips entries with no time", () => {
    const items = buildStream({
      entries: [entry({ id: "x", by: "u9", byName: "gran" }), entry({ id: "y", at: null })],
      uid: ME,
      members,
      now: NOW,
    });
    expect(items).toHaveLength(1);
    expect(items[0].authorName).toBe("Gran");
  });
});

describe("buildStream handovers", () => {
  const handover = (over = {}) => ({
    id: "h1",
    from: MEI,
    to: ME,
    sentAt: ts(at(11, 7, 10)),
    note: "Quiet night",
    needsAttention: true,
    attentionNote: "Cough",
    summary: { feeds: 4, sleepMinutes: 220, nappies: 3 },
    acceptedAt: null,
    ...over,
  });

  it("models a received handover with ack state and counts", () => {
    const [item] = buildStream({ handovers: [handover()], uid: ME, members, now: NOW });
    expect(item).toMatchObject({ kind: "handover", authorName: "Mei", needsAck: true, acked: false, kindLabel: "Handover" });
    expect(item.meta).toMatchObject({ counts: "4 feeds, 3 h 40 min sleep, 3 nappies", needsAttention: true, attentionNote: "Cough" });
  });

  it("models a sent handover and its acceptance", () => {
    const sent = handover({ from: ME, to: MEI, acceptedAt: ts(at(11, 8)), acceptedBy: MEI });
    const [item] = buildStream({ handovers: [sent], uid: ME, members, now: NOW });
    expect(item).toMatchObject({ isMine: true, needsAck: false, acked: true, ackedBy: [MEI], ackedByNames: ["Mei"] });
  });

  it("falls back for a handover with no note and skips one with no sentAt", () => {
    const items = buildStream({ handovers: [handover({ note: "" }), handover({ id: "h2", sentAt: null })], uid: ME, members, now: NOW });
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("Handover sent");
  });
});

describe("buildStream tasks", () => {
  const task = (over = {}) => ({ id: "t1", title: "Book jab", owner: ME, due: "2026-10-13", done: false, createdBy: MEI, createdAt: ts(at(10, 18)), ...over });

  it("shows an open task due within seven days with a due label", () => {
    const [item] = buildStream({ tasks: [task()], uid: ME, members, now: NOW });
    expect(item).toMatchObject({ kind: "task", text: "Book jab", kindLabel: "Task, due Tue", done: false, authorName: "Mei" });
    expect(item.meta.ownerName).toBe("You");
  });

  it("labels today, tomorrow, overdue and later dates", () => {
    const label = (due) => buildStream({ tasks: [task({ due, owner: null })], uid: ME, members, now: NOW })[0]?.kindLabel;
    expect(label("2026-10-11")).toBe("Task, due today");
    expect(label("2026-10-12")).toBe("Task, due tomorrow");
    expect(label("2026-10-05")).toBe("Task, overdue");
    expect(label("2026-10-17")).toBe("Task, due Sat");
    expect(label("2026-10-18")).toBe("Task, due 18 Oct");
  });

  it("hides an unassigned task due later than seven days, keeps an assigned one", () => {
    expect(buildStream({ tasks: [task({ due: "2026-10-30", owner: null })], uid: ME, members, now: NOW })).toHaveLength(0);
    const kept = buildStream({ tasks: [task({ due: "2026-10-30", owner: "both" })], uid: ME, members, now: NOW });
    expect(kept).toHaveLength(1);
    expect(kept[0].kindLabel).toBe("Task, due 30 Oct");
  });

  it("keeps a task finished within a day and hides an older one", () => {
    const fresh = buildStream({ tasks: [task({ done: true, doneAt: ts(new Date(NOW.getTime() - 3600000)) })], uid: ME, members, now: NOW });
    expect(fresh[0].done).toBe(true);
    const old = buildStream({ tasks: [task({ done: true, doneAt: ts(new Date(NOW.getTime() - 25 * 3600000)) })], uid: ME, members, now: NOW });
    expect(old).toHaveLength(0);
  });

  it("copes with a missing title, bad due date and pending createdAt", () => {
    const items = buildStream({
      tasks: [task({ id: "a", title: "" }), task({ id: "b", due: "soon", createdAt: null })],
      uid: ME,
      members,
      now: NOW,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ rawId: "b", pending: true, kindLabel: "Task" });
  });
});

describe("ordering", () => {
  it("sorts every source together, newest first", () => {
    const items = buildStream({
      posts: [{ id: "p", text: "m", authorUid: MEI, createdAt: ts(at(11, 9)) }],
      entries: [{ id: "e", type: "note", by: ME, at: ts(at(11, 10)), details: { text: "n" } }],
      handovers: [{ id: "h", from: MEI, to: ME, sentAt: ts(at(11, 8)) }],
      tasks: [{ id: "t", title: "t", owner: "both", createdAt: ts(at(10, 8)) }],
      uid: ME,
      members,
      now: NOW,
    });
    expect(items.map((i) => i.kind)).toEqual(["care", "message", "handover", "task"]);
  });

  it("breaks ties by id so the order is stable", () => {
    const same = ts(at(11, 9));
    const a = buildStream({ posts: [{ id: "a", text: "1", authorUid: ME, createdAt: same }, { id: "b", text: "2", authorUid: ME, createdAt: same }], uid: ME, members, now: NOW });
    const b = buildStream({ posts: [{ id: "b", text: "2", authorUid: ME, createdAt: same }, { id: "a", text: "1", authorUid: ME, createdAt: same }], uid: ME, members, now: NOW });
    expect(a.map((i) => i.rawId)).toEqual(["b", "a"]);
    expect(b.map((i) => i.rawId)).toEqual(["b", "a"]);
  });

  it("returns an empty list for no input", () => {
    expect(buildStream()).toEqual([]);
    expect(buildStream({ posts: null, entries: undefined })).toEqual([]);
  });
});

describe("groupByDay", () => {
  const item = (id, date) => ({ id, at: date });

  it("labels Today, Yesterday and older days in local time", () => {
    const groups = groupByDay([item("a", at(11, 9)), item("b", at(10, 23)), item("c", at(9, 8)), item("d", at(9, 7))], NOW);
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Fri 9 Oct"]);
    expect(groups[2].items.map((i) => i.id)).toEqual(["c", "d"]);
  });

  it("splits at local midnight", () => {
    const groups = groupByDay([item("late", new Date(2026, 9, 11, 0, 0, 0)), item("early", new Date(2026, 9, 10, 23, 59, 59))], NOW);
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday"]);
  });

  it("handles a day with a daylight saving shift as one day", () => {
    const now = new Date(2026, 2, 9, 12); // after a spring forward in many zones
    const groups = groupByDay([item("a", new Date(2026, 2, 8, 12))], now);
    expect(groups[0].label).toBe("Yesterday");
  });

  it("skips items without a time and tolerates empty input", () => {
    expect(groupByDay([{ id: "x", at: null }], NOW)).toEqual([]);
    expect(groupByDay(undefined, NOW)).toEqual([]);
  });

  it("labels a future day by its date", () => {
    expect(dayLabelFor(at(14), NOW)).toBe("Wed 14 Oct");
  });
});

describe("unreadCount", () => {
  it("counts partner messages and handovers I have not acknowledged", () => {
    const items = buildStream({
      posts: [
        { id: "1", text: "a", authorUid: MEI, createdAt: ts(at(11, 9)), ackedBy: [] },
        { id: "2", text: "b", authorUid: MEI, createdAt: ts(at(11, 8)), ackedBy: [ME] },
        { id: "3", text: "c", authorUid: ME, createdAt: ts(at(11, 7)), ackedBy: [] },
      ],
      handovers: [{ id: "h", from: MEI, to: ME, sentAt: ts(at(11, 6)), acceptedAt: null }],
      entries: [{ id: "e", type: "note", by: MEI, at: ts(at(11, 5)), details: { text: "x" } }],
      tasks: [{ id: "t", title: "t", owner: "both", createdBy: MEI, createdAt: ts(at(11, 4)) }],
      uid: ME,
      members,
      now: NOW,
    });
    expect(unreadCount(items, ME)).toBe(2);
  });

  it("is zero without a uid or items", () => {
    expect(unreadCount([], ME)).toBe(0);
    expect(unreadCount(undefined, ME)).toBe(0);
    expect(unreadCount([{ kind: "message", needsAck: true, acked: false, authorUid: MEI }], "")).toBe(0);
  });
});
