import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const api = vi.hoisted(() => ({
  onData: null,
  onError: null,
  stops: 0,
  addPost: vi.fn(async () => "p-new"),
  ackPost: vi.fn(async () => {}),
  deletePost: vi.fn(async () => {}),
}));

vi.mock("@/app/api/posts", () => ({
  POST_TEXT_MAX: 500,
  subscribePosts: (hid, onData, onError) => {
    api.onData = onData;
    api.onError = onError;
    return () => {
      api.stops += 1;
    };
  },
  addPost: (...a) => api.addPost(...a),
  ackPost: (...a) => api.ackPost(...a),
  deletePost: (...a) => api.deletePost(...a),
}));

import { SEND_GAP_MS, usePostsStore } from "@/app/stores/posts";

function bound() {
  setActivePinia(createPinia());
  const store = usePostsStore();
  store.bind("h1", "u1");
  return store;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 11, 12));
  api.stops = 0;
  Object.values(api).forEach((v) => v?.mockClear?.());
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("posts store", () => {
  it("is loading until the first snapshot, then holds the list", () => {
    const store = bound();
    expect(store.loading).toBe(true);
    api.onData([{ id: "p1", text: "hi" }]);
    expect(store.loading).toBe(false);
    expect(store.posts).toHaveLength(1);
  });

  it("stays loading and quiet with no household id", () => {
    setActivePinia(createPinia());
    const store = usePostsStore();
    store.bind("", "u1");
    expect(store.loading).toBe(true);
    expect(store.error).toBeNull();
  });

  it("reports a listener error with the shared wording", () => {
    const store = bound();
    api.onError({ code: "permission-denied" });
    expect(store.loading).toBe(false);
    expect(store.errorInfo.text).toContain("Publish the latest firestore.rules");
    expect(store.errorInfo.text).toContain("messages");
  });

  it("unbind stops the listener and clears state, and a late snapshot is ignored", () => {
    const store = bound();
    const late = api.onData;
    api.onData([{ id: "p1", text: "hi" }]);
    store.unbind();
    expect(api.stops).toBe(1);
    expect(store.posts).toEqual([]);
    late([{ id: "p2", text: "late" }]);
    expect(store.posts).toEqual([]);
  });

  it("rebinding stops the previous listener", () => {
    const store = bound();
    store.bind("h2", "u1");
    expect(api.stops).toBe(1);
  });

  it("sends a trimmed message in my name", async () => {
    const store = bound();
    expect(await store.send("  Home soon  ")).toBe(true);
    expect(api.addPost).toHaveBeenCalledWith("h1", "u1", "Home soon");
    expect(store.writeError).toBe("");
  });

  it("ignores empty text and rejects over 500 characters", async () => {
    const store = bound();
    expect(await store.send("   ")).toBe(false);
    expect(await store.send("x".repeat(501))).toBe(false);
    expect(api.addPost).not.toHaveBeenCalled();
    expect(store.writeError).toContain("500");
  });

  it("throttles to one message a second", async () => {
    const store = bound();
    expect(await store.send("one")).toBe(true);
    expect(await store.send("two")).toBe(false);
    expect(store.writeError).toContain("second");
    vi.setSystemTime(Date.now() + SEND_GAP_MS + 1);
    expect(await store.send("three")).toBe(true);
    expect(api.addPost).toHaveBeenCalledTimes(2);
  });

  it("reports a failed send without throwing", async () => {
    const store = bound();
    api.addPost.mockRejectedValueOnce({ code: "unavailable" });
    expect(await store.send("hi")).toBe(false);
    expect(store.writeError).toContain("could not send");
  });

  it("explains a permission error on send", async () => {
    const store = bound();
    api.addPost.mockRejectedValueOnce({ code: "permission-denied" });
    await store.send("hi");
    expect(store.writeError).toContain("firestore.rules");
  });

  it("acks with my uid and removes by id", async () => {
    const store = bound();
    expect(await store.ack("p1")).toBe(true);
    expect(api.ackPost).toHaveBeenCalledWith("h1", "p1", "u1");
    expect(await store.remove("p1")).toBe(true);
    expect(api.deletePost).toHaveBeenCalledWith("h1", "p1");
  });

  it("reports failed ack and delete", async () => {
    const store = bound();
    api.ackPost.mockRejectedValueOnce({ code: "unavailable" });
    expect(await store.ack("p1")).toBe(false);
    expect(store.writeError).toContain("could not save");
    api.deletePost.mockRejectedValueOnce({ code: "unavailable" });
    expect(await store.remove("p1")).toBe(false);
    expect(store.writeError).toContain("could not delete");
  });

  it("does nothing when not bound", async () => {
    setActivePinia(createPinia());
    const store = usePostsStore();
    expect(await store.send("hi")).toBe(false);
    expect(await store.ack("p")).toBe(false);
    expect(await store.remove("p")).toBe(false);
  });
});
