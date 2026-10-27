import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setDoc: vi.fn(), callServer: vi.fn() }));
vi.mock("@/api/server", () => ({ callServer: mocks.callServer }));
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
import { postalCodeFromAddress } from "@/api/roomLocation";

const room = { name: " Room ", address: "1 Road Singapore 012345", details: "Level 2", features: ["Chair"] };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.callServer.mockReset().mockResolvedValue({ lat: 1.3, lng: 103.8 });
});

describe("managed rooms", () => {
  it("saves bounded data with attribution and normalized features", async () => {
    expect(await saveManagedRoom("admin", room)).toBe("generated-id");
    expect(mocks.setDoc).toHaveBeenCalledWith({ id: "generated-id" }, expect.objectContaining({
      name: "Room", updatedBy: "admin", updatedAt: "server-time", deleted: false,
      features: expect.objectContaining({ chair: true, sink: false }), status: "unverified",
      lat: 1.3, lng: 103.8,
    }));
    expect(mocks.callServer).toHaveBeenCalledWith("rooms/location?postalCode=012345", { method: "GET" });
  });
  it.each([{ address: "1 Road" }, { address: "1234567" }, { details: "" }, { name: "a".repeat(81) }])("rejects invalid room fields %j", async (fields) => {
    await expect(saveManagedRoom("admin", { ...room, ...fields })).rejects.toThrow();
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
  it("does not write when lookup fails", async () => {
    mocks.callServer.mockRejectedValue(new Error("Postal code not found"));
    await expect(saveManagedRoom("admin", room)).rejects.toThrow("Postal code not found");
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
  it("replaces stale coordinates when editing an address", async () => {
    await saveManagedRoom("admin", { ...room, id: "existing", lat: 1, lng: 100 });
    expect(mocks.setDoc).toHaveBeenCalledWith({ id: "existing" }, expect.objectContaining({ lat: 1.3, lng: 103.8 }));
  });
  it("preserves leading zeros and rejects ambiguous postal codes", () => {
    expect(postalCodeFromAddress("1 Road, Singapore 012345")).toBe("012345");
    expect(() => postalCodeFromAddress("012345 or 654321")).toThrow();
  });
  it("stores deletion markers even for examples with incomplete information", async () => {
    await saveManagedRoom("admin", { id: "seed" }, true);
    expect(mocks.setDoc).toHaveBeenCalledWith({ id: "seed" }, {
      deleted: true, updatedBy: "admin", updatedAt: "server-time",
    });
    expect(mocks.callServer).not.toHaveBeenCalled();
  });
  it("does not bring back duplicate listings when the main listing is deleted", () => {
    const original = { ...room, lat: 1.3, lng: 103.8, name: "Raffles City Shopping Centre", id: "original" };
    const duplicate = { ...room, lat: 1.3, lng: 103.8, name: "Raffles City Family Room", id: "seed", seed: true };
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
