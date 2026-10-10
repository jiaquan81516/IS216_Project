// The Firestore module for the handover: what it writes, and the shape of the queries.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  addDoc: vi.fn(async () => ({ id: "new-id" })),
  updateDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn(() => () => {}),
}));

vi.mock("@/v3/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  addDoc: fs.addDoc,
  collection: (_db, ...path) => ({ kind: "collection", path }),
  doc: (_db, ...path) => ({ kind: "doc", path }),
  limit: (n) => ({ limit: n }),
  onSnapshot: fs.onSnapshot,
  orderBy: (field, direction = "asc") => ({ orderBy: field, direction }),
  query: (ref, ...parts) => ({ kind: "query", ref, parts }),
  serverTimestamp: () => "STAMP",
  Timestamp: { fromDate: (date) => ({ kind: "ts", ms: date.getTime() }) },
  updateDoc: fs.updateDoc,
}));

import {
  acceptHandover,
  sendHandover,
  subscribeHandovers,
  subscribeLatestHandover,
  updateHandover,
} from "@/v3/api/handovers";

const HID = "h1";
const ME = "u1";
const PARTNER = "u2";

beforeEach(() => {
  for (const fn of [fs.addDoc, fs.updateDoc, fs.onSnapshot]) fn.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("handovers api", () => {
  it("asks for the newest handovers on one field, so no composite index is needed", () => {
    const onData = vi.fn();
    subscribeHandovers(HID, onData);
    const [q, handler] = fs.onSnapshot.mock.calls[0];
    expect(q.ref.path).toEqual(["households", HID, "handovers"]);
    expect(q.parts).toEqual([{ orderBy: "sentAt", direction: "desc" }, { limit: 30 }]);
    handler({ docs: [{ id: "x", data: () => ({ from: ME }) }] });
    expect(onData).toHaveBeenCalledWith([{ id: "x", from: ME }]);
  });

  it("takes a smaller page when asked", () => {
    subscribeHandovers(HID, vi.fn(), undefined, { max: 5 });
    expect(fs.onSnapshot.mock.calls[0][0].parts[1]).toEqual({ limit: 5 });
  });

  it("reports just the newest one, or null, for a page that needs nothing else", () => {
    const onData = vi.fn();
    subscribeLatestHandover(HID, onData);
    const [q, handler] = fs.onSnapshot.mock.calls[0];
    expect(q.parts).toEqual([{ orderBy: "sentAt", direction: "desc" }, { limit: 1 }]);
    handler({ docs: [] });
    expect(onData).toHaveBeenCalledWith(null);
    handler({ docs: [{ id: "x", data: () => ({ note: "hi" }) }] });
    expect(onData).toHaveBeenLastCalledWith({ id: "x", note: "hi" });
  });

  it("logs the error code and passes it on", () => {
    const onError = vi.fn();
    subscribeHandovers(HID, vi.fn(), onError);
    fs.onSnapshot.mock.calls[0][2]({ code: "permission-denied" });
    expect(onError).toHaveBeenCalledWith({ code: "permission-denied" });
    expect(console.error).toHaveBeenCalledWith("[v3 handover]", "permission-denied", { code: "permission-denied" });
  });

  it("sends in my own name, with the window and the frozen summary", async () => {
    const periodStart = new Date("2026-10-10T07:10:00");
    const id = await sendHandover({ uid: ME }, HID, {
      to: PARTNER,
      note: "  Settled by 4.  ",
      needsAttention: true,
      attentionNote: "Nappy rash",
      nextUp: ["Feed around 9 PM", "Bath", "Bottles", "Too many"],
      periodStart,
      summary: { feeds: 4, sleepMinutes: 220, nappies: 3 },
    });
    expect(id).toBe("new-id");
    const [ref, data] = fs.addDoc.mock.calls[0];
    expect(ref.path).toEqual(["households", HID, "handovers"]);
    expect(data).toMatchObject({
      from: ME,
      to: PARTNER,
      periodStart: { kind: "ts", ms: periodStart.getTime() },
      note: "  Settled by 4.  ",
      needsAttention: true,
      attentionNote: "Nappy rash",
      summary: { feeds: 4, sleepMinutes: 220, nappies: 3 },
      nextUp: ["Feed around 9 PM", "Bath", "Bottles"],
      acceptedAt: null,
      acceptedBy: null,
      createdAt: "STAMP",
    });
    expect(data.sentAt.kind).toBe("ts");
  });

  it("drops the attention note when the box is not ticked, and fills in the gaps", async () => {
    await sendHandover({ uid: ME }, HID, { to: PARTNER, attentionNote: "ignored" });
    expect(fs.addDoc.mock.calls[0][1]).toMatchObject({
      note: "",
      needsAttention: false,
      attentionNote: "",
      nextUp: [],
      periodStart: null,
      summary: { feeds: 0, sleepMinutes: 0, nappies: 0 },
    });
  });

  it("accepting writes only the two fields, stamped with my uid", async () => {
    await acceptHandover(HID, "ho1", PARTNER);
    expect(fs.updateDoc.mock.calls[0][0].path).toEqual(["households", HID, "handovers", "ho1"]);
    expect(fs.updateDoc.mock.calls[0][1]).toEqual({ acceptedAt: "STAMP", acceptedBy: PARTNER });
  });

  it("an edit only touches the four written fields", async () => {
    await updateHandover(HID, "ho1", {
      note: "Fixed",
      nextUp: ["Bath"],
      needsAttention: false,
      from: "someone-else",
      acceptedBy: "someone-else",
    });
    expect(fs.updateDoc.mock.calls[0][1]).toEqual({
      note: "Fixed",
      needsAttention: false,
      nextUp: ["Bath"],
      updatedAt: "STAMP",
    });
  });
});
