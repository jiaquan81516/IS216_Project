import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { CHAT_TEXT_MAX, sendChat, subscribeChat } from "@/api/chat";
import { notifyPartner } from "@/api/push";
import { useChatStore, READ_KEY, SEND_GAP_MS } from "@/app/stores/chat";

vi.mock("@/api/chat", () => ({
  CHAT_TEXT_MAX: 200,
  subscribeChat: vi.fn(() => vi.fn()),
  sendChat: vi.fn().mockResolvedValue("msg-1"),
}));
vi.mock("@/api/push", () => ({ notifyPartner: vi.fn() }));

const readKey = (uid) => `${READ_KEY}:${uid}`;

beforeEach(() => {
  vi.clearAllMocks();
  subscribeChat.mockImplementation(() => vi.fn());
  sendChat.mockResolvedValue("msg-1");
  localStorage.clear();
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("useChatStore / binding", () => {
  it("starts loading with no messages", () => {
    const store = useChatStore();
    expect(store.messages).toEqual([]);
    expect(store.loading).toBe(true);
  });

  it("reverses the subscribed list so the oldest message comes first", () => {
    const store = useChatStore();
    store.bind("house1", "me1");
    const onData = subscribeChat.mock.calls[0][1];
    onData([{ id: "newest", createdAt: "2026-11-05T10:00:00Z" }, { id: "oldest", createdAt: "2026-11-05T09:00:00Z" }]);
    expect(store.messages.map((m) => m.id)).toEqual(["oldest", "newest"]);
  });

  it("surfaces a subscription error", () => {
    const store = useChatStore();
    store.bind("house1", "me1");
    const onError = subscribeChat.mock.calls[0][2];
    onError({ code: "permission-denied" });
    expect(store.error).toEqual({ code: "permission-denied" });
  });

  it("ignores a stale callback after unbind", () => {
    const store = useChatStore();
    store.bind("house1", "me1");
    const onData = subscribeChat.mock.calls[0][1];
    store.unbind();
    onData([{ id: "m1", createdAt: "2026-11-05" }]);
    expect(store.messages).toEqual([]);
  });

  it("marks the whole chat as read on a first-ever visit for this uid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
    const store = useChatStore();
    store.bind("house1", "me1");
    expect(store.readAt ?? Number(localStorage.getItem(readKey("me1")))).toBeGreaterThan(0);
    expect(localStorage.getItem(readKey("me1"))).toBe(String(Date.now()));
  });

  it("restores a previously stored read position instead of overwriting it", () => {
    localStorage.setItem(readKey("me1"), "1000");
    const store = useChatStore();
    store.bind("house1", "me1");
    expect(localStorage.getItem(readKey("me1"))).toBe("1000");
  });

  it("recovers from a corrupted stored read position", () => {
    localStorage.setItem(readKey("me1"), "not-a-number");
    const store = useChatStore();
    expect(() => store.bind("house1", "me1")).not.toThrow();
  });

  it("does not subscribe with no household id, but still resolves the read position", () => {
    const store = useChatStore();
    store.bind("", "me1");
    expect(subscribeChat).not.toHaveBeenCalled();
  });
});

describe("unread", () => {
  it("counts only the partner's messages newer than the last read time", () => {
    localStorage.setItem(readKey("me1"), "1000");
    const store = useChatStore();
    store.bind("house1", "me1");
    subscribeChat.mock.calls[0][1]([
      { id: "a", from: "partner1", createdAt: new Date(500).toISOString() }, // before read -> not unread
      { id: "b", from: "partner1", createdAt: new Date(2000).toISOString() }, // after read -> unread
      { id: "c", from: "me1", createdAt: new Date(3000).toISOString() }, // my own message -> never unread
    ]);
    expect(store.unread).toBe(1);
  });

  it("is 0 with no messages", () => {
    const store = useChatStore();
    store.bind("house1", "me1");
    expect(store.unread).toBe(0);
  });
});

describe("markRead", () => {
  it("advances readAt to the newest message and persists it", () => {
    localStorage.setItem(readKey("me1"), "1000");
    const store = useChatStore();
    store.bind("house1", "me1");
    subscribeChat.mock.calls[0][1]([{ id: "a", from: "partner1", createdAt: new Date(5000).toISOString() }]);
    store.markRead();
    expect(store.unread).toBe(0);
    expect(Number(localStorage.getItem(readKey("me1")))).toBeGreaterThanOrEqual(5000);
  });

  it("never moves readAt backwards", () => {
    localStorage.setItem(readKey("me1"), "9999999999999");
    const store = useChatStore();
    store.bind("house1", "me1");
    store.markRead(1);
    expect(Number(localStorage.getItem(readKey("me1")))).toBe(9999999999999);
  });
});

describe("send", () => {
  it("does nothing for blank text or with no household bound", async () => {
    const store = useChatStore();
    store.bind("house1", "me1");
    expect(await store.send("   ")).toBe(false);
    expect(sendChat).not.toHaveBeenCalled();
  });

  it("does nothing when no household is bound", async () => {
    const store = useChatStore();
    expect(await store.send("hi")).toBe(false);
    expect(sendChat).not.toHaveBeenCalled();
  });

  it("trims the text, sends it, and notifies the partner", async () => {
    const store = useChatStore();
    store.bind("house1", "me1");
    const ok = await store.send("  hello  ");
    expect(ok).toBe(true);
    expect(sendChat).toHaveBeenCalledWith("house1", { from: "me1", text: "hello", kind: "text" });
    expect(notifyPartner).toHaveBeenCalledWith("house1", "chat", "msg-1");
  });

  it("passes a non-default kind through", async () => {
    const store = useChatStore();
    store.bind("house1", "me1");
    await store.send("👍", "emoji");
    expect(sendChat).toHaveBeenCalledWith("house1", { from: "me1", text: "👍", kind: "emoji" });
  });

  it("rejects text over CHAT_TEXT_MAX without calling the API", async () => {
    const store = useChatStore();
    store.bind("house1", "me1");
    const ok = await store.send("x".repeat(201));
    expect(ok).toBe(false);
    expect(sendChat).not.toHaveBeenCalled();
    expect(store.writeError).toContain("200 characters");
  });

  it("silently blocks a second send within the rate-limit gap (no writeError set)", async () => {
    vi.useFakeTimers();
    const store = useChatStore();
    store.bind("house1", "me1");
    expect(await store.send("first")).toBe(true);
    expect(await store.send("second")).toBe(false);
    expect(sendChat).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(SEND_GAP_MS);
    expect(await store.send("third")).toBe(true);
  });

  it("surfaces a write error on failure, with a friendlier message for permission-denied", async () => {
    sendChat.mockRejectedValueOnce({ code: "permission-denied" });
    const store = useChatStore();
    store.bind("house1", "me1");
    const ok = await store.send("hi");
    expect(ok).toBe(false);
    expect(store.writeError).toContain("firestore.rules");
    expect(notifyPartner).not.toHaveBeenCalled();
  });
});
