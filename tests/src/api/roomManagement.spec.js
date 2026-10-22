import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setDoc: vi.fn() }));
vi.mock("@/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: () => "pumpingRoomOverrides",
  doc: (_collection, id) => ({ id: id || "generated-id" }),
  onSnapshot: vi.fn(),
  serverTimestamp: () => "server-time",
  setDoc: mocks.setDoc,
}));
import { saveManagedRoom } from "@/api/roomManagement";
import { applyRoomOverrides } from "@/app/utils/roomManagement";

const room = { name: " Room ", address: "1 Road", details: "Level 2", lat: 1.3, lng: 103.8, features: ["Chair"] };
beforeEach(() => vi.clearAllMocks());

describe("managed rooms", () => {
  it("saves bounded data with attribution and normalized features", async () => {
    expect(await saveManagedRoom("admin", room)).toBe("generated-id");
    expect(mocks.setDoc).toHaveBeenCalledWith({ id: "generated-id" }, expect.objectContaining({
      name: "Room", updatedBy: "admin", updatedAt: "server-time", deleted: false,
      features: expect.objectContaining({ chair: true, sink: false }), status: "unverified",
    }));
  });
  it.each([{ lat: "1.3" }, { lng: 181 }, { details: "" }, { name: "a".repeat(81) }])("rejects invalid room fields %j", async (fields) => {
    await expect(saveManagedRoom("admin", { ...room, ...fields })).rejects.toThrow();
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
  it("stores deletion markers even for examples with incomplete information", async () => {
    await saveManagedRoom("admin", { id: "seed" }, true);
    expect(mocks.setDoc).toHaveBeenCalledWith({ id: "seed" }, {
      deleted: true, updatedBy: "admin", updatedAt: "server-time",
    });
  });
  it("does not bring back duplicate listings when the main listing is deleted", () => {
    const original = { ...room, name: "Raffles City Shopping Centre", id: "original" };
    const duplicate = { ...room, name: "Raffles City Family Room", id: "seed", seed: true };
    expect(applyRoomOverrides([original, duplicate], [{ id: "original", deleted: true }])).toEqual([]);
  });
  it("keeps source attribution while replacing bundled room information", () => {
    const rooms = applyRoomOverrides([{ ...room, id: "bundled", sourceUrl: "https://example.com" }], [
      { ...room, id: "bundled", name: "Updated", features: { sink: true } },
    ]);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ name: "Updated", sourceUrl: "https://example.com", features: ["Sink"] });
  });
});
