import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuth } from "@/composables/useAuth";
import { addRoom as addRoomDoc, reportRoom as reportRoomDoc, subscribeRooms } from "@/api/rooms";
import { resolveRoomLocation } from "@/api/roomLocation";
import { SEED_ROOMS } from "@/app/data/pumpingRooms";
import { resetLimits } from "@/app/utils/limits";
import { useRoomsStore } from "@/app/stores/rooms";

const state = vi.hoisted(() => ({ uid: "me1" }));
vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({ currentUser: { value: state.uid ? { uid: state.uid } : null } }),
}));
vi.mock("@/api/rooms", () => ({
  subscribeRooms: vi.fn(() => vi.fn()),
  addRoom: vi.fn().mockResolvedValue("room-1"),
  reportRoom: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/api/roomLocation", () => ({ resolveRoomLocation: vi.fn().mockResolvedValue({ lat: 1.3, lng: 103.8 }) }));

beforeEach(() => {
  vi.clearAllMocks();
  state.uid = "me1";
  subscribeRooms.mockImplementation(() => vi.fn());
  addRoomDoc.mockResolvedValue("room-1");
  resolveRoomLocation.mockResolvedValue({ lat: 1.3, lng: 103.8 });
  localStorage.clear();
  resetLimits();
  setActivePinia(createPinia());
});
afterEach(() => {
  localStorage.clear();
  resetLimits();
});

describe("useRoomsStore / binding", () => {
  it("falls back to the seed rooms before anything is loaded", () => {
    const store = useRoomsStore();
    expect(store.usingSeed).toBe(true);
    expect(store.rooms).toBe(SEED_ROOMS);
  });

  it("subscribes with the current user's uid", () => {
    const store = useRoomsStore();
    store.bind();
    expect(subscribeRooms).toHaveBeenCalledWith("me1", expect.any(Function), expect.any(Function));
  });

  it("does not resubscribe on a second bind() while already bound", () => {
    const store = useRoomsStore();
    store.bind();
    store.bind();
    expect(subscribeRooms).toHaveBeenCalledTimes(1);
  });

  it("allows rebinding after unbind", () => {
    const store = useRoomsStore();
    store.bind();
    store.unbind();
    store.bind();
    expect(subscribeRooms).toHaveBeenCalledTimes(2);
  });

  it("switches off the seed list once a live room arrives", () => {
    const store = useRoomsStore();
    store.bind();
    const onData = subscribeRooms.mock.calls[0][0 + 1];
    onData([{ id: "r1", name: "Real Room", approval: "approved" }]);
    expect(store.usingSeed).toBe(false);
    expect(store.rooms).toHaveLength(1);
    expect(store.rooms[0].name).toBe("Real Room");
  });

  it("excludes pending and rejected rooms from the public list", () => {
    const store = useRoomsStore();
    store.bind();
    const onData = subscribeRooms.mock.calls[0][1];
    onData([
      { id: "r1", name: "Approved", approval: "approved" },
      { id: "r2", name: "Pending", approval: "pending" },
      { id: "r3", name: "Rejected", approval: "rejected" },
    ]);
    expect(store.rooms.map((r) => r.id)).toEqual(["r1"]);
  });

  it("surfaces a subscription error", () => {
    const store = useRoomsStore();
    store.bind();
    const onError = subscribeRooms.mock.calls[0][2];
    onError({ code: "permission-denied" });
    expect(store.error).toEqual({ code: "permission-denied" });
    expect(store.loading).toBe(false);
  });

  it("clears docs and goes back to loading on unbind", () => {
    const store = useRoomsStore();
    store.bind();
    subscribeRooms.mock.calls[0][1]([{ id: "r1", approval: "approved" }]);
    store.unbind();
    expect(store.docs).toEqual([]);
    expect(store.loading).toBe(true);
  });
});

describe("submissions", () => {
  it("shows my own pending submission, and a rejected one not yet dismissed", () => {
    const store = useRoomsStore();
    store.bind();
    subscribeRooms.mock.calls[0][1]([
      { id: "r1", createdBy: "me1", approval: "pending", name: "Mine Pending" },
      { id: "r2", createdBy: "me1", approval: "rejected", name: "Mine Rejected" },
      { id: "r3", createdBy: "partner1", approval: "pending", name: "Not mine" },
      { id: "r4", createdBy: "me1", approval: "approved", name: "Already live" },
    ]);
    expect(store.submissions.map((s) => s.id).sort()).toEqual(["r1", "r2"]);
  });

  it("hides a rejected submission once dismissed, and persists the dismissal per account", () => {
    const store = useRoomsStore();
    store.bind();
    subscribeRooms.mock.calls[0][1]([{ id: "r2", createdBy: "me1", approval: "rejected", name: "Mine Rejected" }]);
    expect(store.submissions).toHaveLength(1);
    store.dismissSubmission("r2");
    expect(store.submissions).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem("nt.app.rooms-dismissed:me1"))).toContain("r2");
  });

  it("does not add the same dismissal twice", () => {
    const store = useRoomsStore();
    store.bind();
    store.dismissSubmission("r2");
    store.dismissSubmission("r2");
    expect(JSON.parse(localStorage.getItem("nt.app.rooms-dismissed:me1"))).toEqual(["r2"]);
  });

  it("loads any previously dismissed ids scoped to the signed-in uid", () => {
    localStorage.setItem("nt.app.rooms-dismissed:me1", JSON.stringify(["old1"]));
    const store = useRoomsStore();
    store.bind();
    subscribeRooms.mock.calls[0][1]([{ id: "old1", createdBy: "me1", approval: "rejected" }]);
    expect(store.submissions).toHaveLength(0);
  });

  it("keeps a signed-out ('guest') dismissal list separate from a signed-in uid's", () => {
    state.uid = "";
    const store = useRoomsStore();
    store.dismissSubmission("r9");
    expect(localStorage.getItem("nt.app.rooms-dismissed:guest")).toContain("r9");
    expect(localStorage.getItem("nt.app.rooms-dismissed:me1")).toBeNull();
  });
});

describe("addRoom", () => {
  it("saves the room using the resolved lat/lng when none was given", async () => {
    const result = useRoomsStore();
    const res = await result.addRoom({ name: "New Room", address: "123 Street" });
    expect(res).toEqual({ id: "room-1", name: "New Room" });
    expect(resolveRoomLocation).toHaveBeenCalledWith("123 Street");
    expect(addRoomDoc).toHaveBeenCalledWith("me1", expect.objectContaining({ lat: 1.3, lng: 103.8 }));
  });

  it("skips the geocode lookup when a valid lat/lng is already given", async () => {
    const store = useRoomsStore();
    await store.addRoom({ name: "New Room", address: "123 Street", lat: 1.1, lng: 103.1 });
    expect(resolveRoomLocation).not.toHaveBeenCalled();
    expect(addRoomDoc).toHaveBeenCalledWith("me1", expect.objectContaining({ lat: 1.1, lng: 103.1 }));
  });

  it("still saves the room with a null position when the geocode lookup fails", async () => {
    resolveRoomLocation.mockRejectedValueOnce(new Error("offline"));
    const store = useRoomsStore();
    const res = await store.addRoom({ name: "New Room", address: "123 Street" });
    expect(res).toEqual({ id: "room-1", name: "New Room" });
    expect(addRoomDoc).toHaveBeenCalledWith("me1", expect.objectContaining({ lat: null, lng: null }));
  });

  it("returns null and sets a friendly writeError on permission-denied", async () => {
    addRoomDoc.mockRejectedValueOnce({ code: "permission-denied" });
    const store = useRoomsStore();
    const res = await store.addRoom({ name: "x", address: "y", lat: 1, lng: 1 });
    expect(res).toBeNull();
    expect(store.writeError).toContain("firestore.rules");
  });

  it("returns null with a generic message on any other failure", async () => {
    addRoomDoc.mockRejectedValueOnce({ code: "unavailable" });
    const store = useRoomsStore();
    const res = await store.addRoom({ name: "x", address: "y", lat: 1, lng: 1 });
    expect(res).toBeNull();
    expect(store.writeError).toContain("could not save");
  });
});

describe("reportRoom", () => {
  it("reports a room", async () => {
    const store = useRoomsStore();
    const ok = await store.reportRoom("r1", "confirm");
    expect(ok).toBe(true);
    expect(reportRoomDoc).toHaveBeenCalledWith("me1", "r1", "confirm");
  });

  it("is rate limited on this device after 5 reports in the window", async () => {
    const store = useRoomsStore();
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      expect(await store.reportRoom(`r${i}`, "confirm")).toBe(true);
    }
    const ok = await store.reportRoom("r6", "confirm");
    expect(ok).toBe(false);
    expect(store.writeError).toContain("Try again in a few minutes");
    expect(reportRoomDoc).toHaveBeenCalledTimes(5);
  });

  it("returns false with a friendly message on permission-denied", async () => {
    reportRoomDoc.mockRejectedValueOnce({ code: "permission-denied" });
    const store = useRoomsStore();
    const ok = await store.reportRoom("r1", "gone");
    expect(ok).toBe(false);
    expect(store.writeError).toContain("firestore.rules");
  });
});
