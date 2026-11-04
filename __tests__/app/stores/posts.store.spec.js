import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ackPost, addPost, deletePost, POST_TEXT_MAX, subscribePosts } from "@/api/posts";
import { usePostsStore, SEND_GAP_MS } from "@/app/stores/posts";

vi.mock("@/api/posts", () => ({
  POST_TEXT_MAX: 500,
  subscribePosts: vi.fn(() => vi.fn()),
  addPost: vi.fn().mockResolvedValue(undefined),
  ackPost: vi.fn().mockResolvedValue(undefined),
  deletePost: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  subscribePosts.mockImplementation(() => vi.fn());
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.useRealTimers();
});

describe("usePostsStore / binding", () => {
  it("starts loading with no posts", () => {
    const store = usePostsStore();
    expect(store.posts).toEqual([]);
    expect(store.loading).toBe(true);
  });

  it("does nothing when bound with no household id", () => {
    const store = usePostsStore();
    store.bind("");
    expect(subscribePosts).not.toHaveBeenCalled();
  });

  it("populates posts and stops loading once the subscription delivers", () => {
    const store = usePostsStore();
    store.bind("house1", "me1");
    const onData = subscribePosts.mock.calls[0][1];
    onData([{ id: "p1", text: "hi" }]);
    expect(store.posts).toEqual([{ id: "p1", text: "hi" }]);
    expect(store.loading).toBe(false);
  });

  it("surfaces a subscription error and a friendly errorInfo", () => {
    const store = usePostsStore();
    store.bind("house1", "me1");
    const onError = subscribePosts.mock.calls[0][2];
    onError({ code: "permission-denied" });
    expect(store.error).toEqual({ code: "permission-denied" });
    expect(store.errorInfo.text).toContain("firestore.rules");
  });

  it("errorInfo is null when there is no error", () => {
    const store = usePostsStore();
    expect(store.errorInfo).toBeNull();
  });

  it("ignores a stale callback after unbind", () => {
    const store = usePostsStore();
    store.bind("house1", "me1");
    const onData = subscribePosts.mock.calls[0][1];
    store.unbind();
    onData([{ id: "p1" }]);
    expect(store.posts).toEqual([]);
  });
});

describe("send", () => {
  it("does nothing for blank text", async () => {
    const store = usePostsStore();
    store.bind("house1", "me1");
    expect(await store.send("   ")).toBe(false);
    expect(addPost).not.toHaveBeenCalled();
  });

  it("does nothing when no household is bound", async () => {
    const store = usePostsStore();
    expect(await store.send("hi")).toBe(false);
    expect(addPost).not.toHaveBeenCalled();
  });

  it("trims the text before sending", async () => {
    const store = usePostsStore();
    store.bind("house1", "me1");
    const ok = await store.send("  hello  ");
    expect(ok).toBe(true);
    expect(addPost).toHaveBeenCalledWith("house1", "me1", "hello");
  });

  it("rejects text over POST_TEXT_MAX without calling the API", async () => {
    const store = usePostsStore();
    store.bind("house1", "me1");
    const ok = await store.send("x".repeat(501));
    expect(ok).toBe(false);
    expect(addPost).not.toHaveBeenCalled();
    expect(store.writeError).toContain("500 characters");
  });

  it("blocks a second send within the rate-limit gap, and allows one after it", async () => {
    vi.useFakeTimers();
    const store = usePostsStore();
    store.bind("house1", "me1");
    expect(await store.send("first")).toBe(true);
    expect(await store.send("second")).toBe(false);
    expect(store.writeError).toContain("second before sending");
    vi.advanceTimersByTime(SEND_GAP_MS);
    expect(await store.send("third")).toBe(true);
    expect(addPost).toHaveBeenCalledTimes(2);
  });

  it("resets the rate limit on a fresh bind", async () => {
    vi.useFakeTimers();
    const store = usePostsStore();
    store.bind("house1", "me1");
    await store.send("first");
    store.bind("house1", "me1");
    expect(await store.send("second")).toBe(true);
  });

  it("surfaces a write error on API failure", async () => {
    addPost.mockRejectedValueOnce({ code: "unavailable" });
    const store = usePostsStore();
    store.bind("house1", "me1");
    const ok = await store.send("hi");
    expect(ok).toBe(false);
    expect(store.writeError).toContain("could not send");
  });
});

describe("ack", () => {
  it("acknowledges a post", async () => {
    const store = usePostsStore();
    store.bind("house1", "me1");
    const ok = await store.ack("p1");
    expect(ok).toBe(true);
    expect(ackPost).toHaveBeenCalledWith("house1", "p1", "me1");
  });

  it("does nothing with no id, household, or uid", async () => {
    const store = usePostsStore();
    store.bind("house1", "me1");
    expect(await store.ack("")).toBe(false);
    expect(ackPost).not.toHaveBeenCalled();
  });

  it("surfaces a write error on failure", async () => {
    ackPost.mockRejectedValueOnce({ code: "unavailable" });
    const store = usePostsStore();
    store.bind("house1", "me1");
    const ok = await store.ack("p1");
    expect(ok).toBe(false);
    expect(store.writeError).toContain("could not save");
  });
});

describe("remove", () => {
  it("deletes a post", async () => {
    const store = usePostsStore();
    store.bind("house1", "me1");
    const ok = await store.remove("p1");
    expect(ok).toBe(true);
    expect(deletePost).toHaveBeenCalledWith("house1", "p1");
  });

  it("does nothing with no id or household", async () => {
    const store = usePostsStore();
    store.bind("house1", "me1");
    expect(await store.remove("")).toBe(false);
    expect(deletePost).not.toHaveBeenCalled();
  });

  it("surfaces a write error on failure", async () => {
    deletePost.mockRejectedValueOnce({ code: "unavailable" });
    const store = usePostsStore();
    store.bind("house1", "me1");
    const ok = await store.remove("p1");
    expect(ok).toBe(false);
    expect(store.writeError).toContain("could not delete");
  });
});
