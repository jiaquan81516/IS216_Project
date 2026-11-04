import { describe, it, expect } from "vitest";
import {
  TASK_WINDOW_DAYS, DONE_VISIBLE_MS,
  localKey, firstNameOf, ackList, careLine, buildStream, dayLabelFor, groupByDay, unreadCount,
} from "@/app/utils/stream";

describe("constants", () => {
  it("has a 7 day task window and a 1 day done-visible window", () => {
    expect(TASK_WINDOW_DAYS).toBe(7);
    expect(DONE_VISIBLE_MS).toBe(86400000);
  });
});

describe("localKey", () => {
  it("formats a Date as local yyyy-mm-dd", () => {
    expect(localKey(new Date(2026, 9, 14))).toBe("2026-10-14");
    expect(localKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("firstNameOf", () => {
  it("capitalises and takes the first word of a name", () => {
    expect(firstNameOf("Mei Lin")).toBe("Mei");
    expect(firstNameOf("daniel tan")).toBe("Daniel");
    expect(firstNameOf("  jess  ")).toBe("Jess");
  });
  it("returns '' for nothing usable", () => {
    expect(firstNameOf("")).toBe("");
    expect(firstNameOf(null)).toBe("");
    expect(firstNameOf(undefined)).toBe("");
    expect(firstNameOf("   ")).toBe("");
  });
});

describe("ackList", () => {
  it("de-dupes an array of uids, dropping non-string/empty entries", () => {
    expect(ackList(["a", "b", "a", "", null, 5])).toEqual(["a", "b"]);
  });
  it("returns the keys of a map object", () => {
    expect(ackList({ u1: true, u2: 123 })).toEqual(["u1", "u2"]);
  });
  it("returns [] for anything else", () => {
    expect(ackList(null)).toEqual([]);
    expect(ackList(undefined)).toEqual([]);
    expect(ackList("x")).toEqual([]);
    expect(ackList([])).toEqual([]);
    expect(ackList({})).toEqual([]);
  });
});

describe("careLine", () => {
  it("describes a breastfeed with side and minutes", () => {
    expect(careLine({ type: "feed", details: { method: "breast", side: "left", minutes: 15 } })).toBe("Breastfed, left, 15 minutes");
  });
  it("describes a plain breastfeed with no side/minutes", () => {
    expect(careLine({ type: "feed", details: { method: "breast" } })).toBe("Breastfed");
  });
  it("describes expressed milk with and without ml", () => {
    expect(careLine({ type: "feed", details: { method: "expressed", ml: 90 } })).toBe("Fed 90 ml expressed milk");
    expect(careLine({ type: "feed", details: { method: "expressed" } })).toBe("Fed expressed milk");
  });
  it("describes a bottle feed with and without ml", () => {
    expect(careLine({ type: "feed", details: { ml: 120 } })).toBe("Fed 120 ml");
    expect(careLine({ type: "feed", details: {} })).toBe("Fed");
  });
  it("appends a free-text tail to a feed entry", () => {
    expect(careLine({ type: "feed", details: { ml: 120, text: "settled well" } })).toBe("Fed 120 ml, settled well");
  });
  it("describes sleep duration in hours and minutes", () => {
    const at = new Date(2026, 9, 14, 20, 0, 0);
    const endedAt = new Date(2026, 9, 14, 21, 45, 0);
    expect(careLine({ type: "sleep", at, endedAt })).toBe("Slept 1 h 45 min");
  });
  it("describes sleep in whole hours or whole minutes only", () => {
    const at = new Date(2026, 9, 14, 20, 0, 0);
    expect(careLine({ type: "sleep", at, endedAt: new Date(2026, 9, 14, 22, 0, 0) })).toBe("Slept 2 h");
    expect(careLine({ type: "sleep", at, endedAt: new Date(2026, 9, 14, 20, 20, 0) })).toBe("Slept 20 min");
  });
  it("falls back to 'Sleeping' when there's no valid end yet", () => {
    expect(careLine({ type: "sleep", at: new Date(), endedAt: null })).toBe("Sleeping");
    const at = new Date(2026, 9, 14, 20, 0, 0);
    expect(careLine({ type: "sleep", at, endedAt: new Date(2026, 9, 14, 19, 0, 0) })).toBe("Sleeping"); // end before start
  });
  it("describes a nappy change with and without a type", () => {
    expect(careLine({ type: "nappy", details: { nappyType: "wet" } })).toBe("Diaper, wet nappy");
    expect(careLine({ type: "nappy", details: {} })).toBe("Diaper change");
  });
  it("describes medication with drug and dose, or neither", () => {
    expect(careLine({ type: "medication", details: { drug: "Panadol", dose: "5ml" } })).toBe("Medicine, Panadol 5ml");
    expect(careLine({ type: "medication", details: {} })).toBe("Medicine");
  });
  it("describes a note, falling back to 'Note'", () => {
    expect(careLine({ type: "note", details: { text: "Slept through" } })).toBe("Slept through");
    expect(careLine({ type: "note", details: {} })).toBe("Note");
  });
  it("falls back to 'Care entry' for an unknown type", () => {
    expect(careLine({ type: "bogus" })).toBe("Care entry");
    expect(careLine({})).toBe("Care entry");
  });
});

describe("buildStream", () => {
  const now = new Date(2026, 9, 14, 12, 0, 0);
  const members = [{ uid: "partner1", displayName: "Jess Tan" }];

  it("builds a message item, marking it mine and pending appropriately", () => {
    const posts = [{ id: "p1", text: "Hi there", authorUid: "me1", createdAt: null, ackedBy: [] }];
    const [item] = buildStream({ posts, uid: "me1", members, now });
    expect(item).toMatchObject({ id: "message:p1", kind: "message", isMine: true, authorName: "You", text: "Hi there", pending: true });
  });

  it("skips a message with no text", () => {
    const posts = [{ id: "p1", text: "   ", authorUid: "me1" }];
    expect(buildStream({ posts, uid: "me1" })).toEqual([]);
  });

  it("builds a care item with authorName from the household members", () => {
    const entries = [{ id: "e1", type: "nappy", details: { nappyType: "wet" }, at: now, by: "partner1" }];
    const [item] = buildStream({ entries, uid: "me1", members, now });
    expect(item).toMatchObject({ kind: "care", authorName: "Jess", text: "Diaper, wet nappy", kindLabel: "Care" });
  });

  it("learns an unknown caregiver's name from the entry itself", () => {
    const entries = [{ id: "e1", type: "note", details: { text: "x" }, at: now, by: "nanny1", byName: "Grace Lim" }];
    const [item] = buildStream({ entries, uid: "me1", now });
    expect(item.authorName).toBe("Grace");
  });

  it("skips a care entry with no valid 'at'", () => {
    const entries = [{ id: "e1", type: "note", at: null }];
    expect(buildStream({ entries, uid: "me1" })).toEqual([]);
  });

  it("includes a task due within the window even if unassigned, and labels it", () => {
    const tasks = [{ id: "t1", title: "Buy diapers", due: "2026-10-15", owner: "", createdAt: now }];
    const [item] = buildStream({ tasks, uid: "me1", now });
    expect(item).toMatchObject({ kind: "task", kindLabel: "Task, due tomorrow", done: false });
  });

  it("includes an assigned task even if its due date is far away", () => {
    const tasks = [{ id: "t1", title: "Plan birthday", due: "2027-01-01", owner: "me1", createdAt: now }];
    expect(buildStream({ tasks, uid: "me1", now })).toHaveLength(1);
  });

  it("excludes an unassigned task that is not due soon", () => {
    const tasks = [{ id: "t1", title: "Someday", due: "2027-01-01", owner: "open", createdAt: now }];
    expect(buildStream({ tasks, uid: "me1", now })).toEqual([]);
  });

  it("excludes an unassigned task with no due date at all", () => {
    const tasks = [{ id: "t1", title: "Someday", due: null, owner: "", createdAt: now }];
    expect(buildStream({ tasks, uid: "me1", now })).toEqual([]);
  });

  it("includes a just-completed task but excludes one completed too long ago", () => {
    const recentlyDone = new Date(now.getTime() - 60000);
    const longDone = new Date(now.getTime() - DONE_VISIBLE_MS - 1);
    const tasks = [
      { id: "t1", title: "Fresh", done: true, doneAt: recentlyDone, createdAt: now },
      { id: "t2", title: "Stale", done: true, doneAt: longDone, createdAt: now },
    ];
    const out = buildStream({ tasks, uid: "me1", now });
    expect(out.map((i) => i.rawId)).toEqual(["t1"]);
  });

  it("skips a task with no title", () => {
    expect(buildStream({ tasks: [{ id: "t1", title: "  " }], uid: "me1" })).toEqual([]);
  });

  it("sorts newest first across mixed sources, breaking ties by id", () => {
    const t = new Date(2026, 9, 14, 10, 0, 0);
    const posts = [{ id: "p1", text: "Older", authorUid: "me1", createdAt: new Date(2026, 9, 14, 8, 0, 0) }];
    const entries = [{ id: "e1", type: "note", details: { text: "Newer" }, at: new Date(2026, 9, 14, 11, 0, 0), by: "me1" }];
    const tasks = [{ id: "t1", title: "Same time", owner: "me1", createdAt: t }];
    const out = buildStream({ posts, entries, tasks, uid: "me1", now: t });
    expect(out.map((i) => i.kind)).toEqual(["care", "task", "message"]);
  });

  it("marks a message as needing acknowledgement from the other person", () => {
    const posts = [{ id: "p1", text: "Hi", authorUid: "partner1", createdAt: now, ackedBy: [] }];
    const [item] = buildStream({ posts, uid: "me1", members, now });
    expect(item.needsAck).toBe(true);
    expect(item.acked).toBe(false);
  });

  it("marks my own message as acked once the other person acknowledges it", () => {
    const posts = [{ id: "p1", text: "Hi", authorUid: "me1", createdAt: now, ackedBy: ["partner1"] }];
    const [item] = buildStream({ posts, uid: "me1", members, now });
    expect(item.needsAck).toBe(false); // my own post never needs MY ack
    expect(item.acked).toBe(true);
    expect(item.ackedByNames).toEqual(["Jess"]);
  });
});

describe("dayLabelFor", () => {
  const now = new Date(2026, 9, 14, 9, 0, 0);
  it("says Today and Yesterday", () => {
    expect(dayLabelFor(new Date(2026, 9, 14, 23, 0, 0), now)).toBe("Today");
    expect(dayLabelFor(new Date(2026, 9, 13, 1, 0, 0), now)).toBe("Yesterday");
  });
  it("falls back to a weekday/day/month label further back", () => {
    expect(dayLabelFor(new Date(2026, 9, 10), now)).toBe("Sat 10 Oct");
  });
});

describe("groupByDay", () => {
  const now = new Date(2026, 9, 14, 9, 0, 0);
  it("groups items by local day, preserving item order within a day", () => {
    const items = [
      { at: new Date(2026, 9, 14, 20, 0, 0), id: "a" },
      { at: new Date(2026, 9, 14, 8, 0, 0), id: "b" },
      { at: new Date(2026, 9, 13, 8, 0, 0), id: "c" },
    ];
    const groups = groupByDay(items, now);
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("skips items with no valid 'at'", () => {
    expect(groupByDay([{ at: null }, { id: "x" }], now)).toEqual([]);
  });
  it("handles an empty/missing list", () => {
    expect(groupByDay(undefined, now)).toEqual([]);
  });
});

describe("unreadCount", () => {
  it("counts the other person's un-acked messages needing my ack", () => {
    const items = [
      { kind: "message", needsAck: true, acked: false, authorUid: "partner1" },
      { kind: "message", needsAck: true, acked: true, authorUid: "partner1" },
      { kind: "message", needsAck: false, acked: false, authorUid: "me1" },
      { kind: "task", needsAck: true, acked: false, authorUid: "partner1" },
    ];
    expect(unreadCount(items, "me1")).toBe(1);
  });
  it("returns 0 without a uid", () => {
    expect(unreadCount([{ kind: "message", needsAck: true, acked: false, authorUid: "partner1" }], "")).toBe(0);
  });
  it("handles an empty/missing list", () => {
    expect(unreadCount(undefined, "me1")).toBe(0);
  });
});
