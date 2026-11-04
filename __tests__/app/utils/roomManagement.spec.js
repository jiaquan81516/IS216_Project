import { describe, it, expect } from "vitest";
import { applyRoomOverrides } from "@/app/utils/roomManagement";

// Minimal fixtures: roomHelpers.roomView and mapHelpers.isDuplicate are exercised through
// their real implementations here (not mocked), since the point is the merge/dedup contract.
function room(id, extra = {}) {
  return { id, name: `Room ${id}`, lat: 1.3, lng: 103.8, address: "1 Street", ...extra };
}

describe("applyRoomOverrides", () => {
  it("returns the original rooms unchanged when there are no overrides", () => {
    const rooms = [room("a"), room("b")];
    expect(applyRoomOverrides(rooms, [])).toEqual(rooms);
  });

  it("merges an override's fields onto the matching room", () => {
    const rooms = [room("a", { name: "Old name" })];
    const result = applyRoomOverrides(rooms, [{ id: "a", name: "New name" }]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("New name");
  });

  it("drops a room whose override is marked deleted", () => {
    const rooms = [room("a"), room("b")];
    const result = applyRoomOverrides(rooms, [{ id: "a", deleted: true }]);
    expect(result.map((r) => r.id)).toEqual(["b"]);
  });

  it("ignores an override whose id matches no existing room and has no deleted flag, adding it as a new room", () => {
    const rooms = [room("a")];
    const result = applyRoomOverrides(rooms, [{ id: "ghost", name: "New room", lat: 1, lng: 1, address: "x" }]);
    expect(result.map((r) => r.id).sort()).toEqual(["a", "ghost"]);
  });

  it("a deleted override for a non-existent id is a harmless no-op", () => {
    const rooms = [room("a")];
    const result = applyRoomOverrides(rooms, [{ id: "ghost", deleted: true }]);
    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("removes other listings that are duplicates of an overridden room's ORIGINAL location, even if the override itself moves/renames it", () => {
    // "b" is a duplicate of "a"'s original name AND location (isDuplicate needs both
    // proximity and a name match/overlap, not just nearby coordinates).
    const rooms = [
      room("a", { name: "Raffles City", lat: 1.3, lng: 103.8 }),
      room("b", { name: "Raffles City Nursing Room", lat: 1.3, lng: 103.8001 }),
    ];
    const result = applyRoomOverrides(rooms, [{ id: "a", name: "Renamed", lat: 50, lng: 50 }]);
    expect(result.map((r) => r.id)).toEqual(["a"]);
    expect(result[0].name).toBe("Renamed");
  });

  it("does not delete the override's own original room as a 'duplicate of itself'", () => {
    const rooms = [room("a")];
    const result = applyRoomOverrides(rooms, [{ id: "a", name: "Still here" }]);
    expect(result).toHaveLength(1);
  });

  it("leaves unrelated rooms (not duplicates, no override) untouched", () => {
    const rooms = [room("a"), room("b", { lat: 9, lng: 9 }), room("c", { lat: 20, lng: 20 })];
    const result = applyRoomOverrides(rooms, [{ id: "a", name: "Edited" }]);
    expect(result.map((r) => r.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("applies multiple independent overrides", () => {
    const rooms = [room("a"), room("b"), room("c")];
    const result = applyRoomOverrides(rooms, [
      { id: "a", name: "A2" },
      { id: "b", deleted: true },
    ]);
    expect(result.map((r) => r.id).sort()).toEqual(["a", "c"]);
    expect(result.find((r) => r.id === "a").name).toBe("A2");
  });
});
