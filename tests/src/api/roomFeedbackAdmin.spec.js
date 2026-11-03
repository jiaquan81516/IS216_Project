import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ updateDoc: vi.fn(), onSnapshot: vi.fn() }));
vi.mock("@/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: (_db, ...path) => path.join("/"),
  collectionGroup: (_db, name) => `group:${name}`,
  doc: (_db, ...path) => path.join("/"),
  updateDoc: mocks.updateDoc,
  onSnapshot: mocks.onSnapshot,
  serverTimestamp: () => "server-time",
}));
import { editRoomFeedback, subscribeAdminRoomFeedback } from "@/api/roomFeedbackAdmin";

beforeEach(() => vi.clearAllMocks());
describe("admin room feedback", () => {
  it("updates only text and editor metadata, preserving the parent's attribution", async () => {
    await editRoomFeedback("admin", "room", "comment", " Updated feedback ");
    expect(mocks.updateDoc).toHaveBeenCalledWith("pumpingRooms/room/feedback/comment", {
      text: "Updated feedback", editedBy: "admin", editedAt: "server-time",
    });
  });
  it.each(["", "   ", "a".repeat(401)])("rejects invalid feedback", async (text) => {
    await expect(editRoomFeedback("admin", "room", "comment", text)).rejects.toThrow();
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });
  it("loads all room feedback without the parent view's 20-item limit", () => {
    const receive = vi.fn();
    const stop = vi.fn();
    mocks.onSnapshot.mockReturnValue(stop);
    expect(subscribeAdminRoomFeedback("", receive, vi.fn())).toBe(stop);
    expect(mocks.onSnapshot.mock.calls[0][0]).toBe("group:feedback");
    const documents = Array.from({ length: 25 }, (_, index) => ({
      id: `feedback-${index}`, data: () => ({ text: "Comment", at: { toMillis: () => index } }),
      ref: { parent: { parent: { id: "room", parent: { id: "pumpingRooms" } } } },
    }));
    mocks.onSnapshot.mock.calls[0][1]({ docs: documents });
    expect(receive.mock.calls[0][0]).toHaveLength(25);
    expect(receive.mock.calls[0][0][0]).toMatchObject({ id: "feedback-24", roomId: "room" });
  });
  it("scopes the card view to its own room", () => {
    subscribeAdminRoomFeedback("room-one", vi.fn(), vi.fn());
    expect(mocks.onSnapshot.mock.calls[0][0]).toBe("pumpingRooms/room-one/feedback");
  });
});
