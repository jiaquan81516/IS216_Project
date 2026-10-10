import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import {
  featureLabels,
  featureMap,
  filterRooms,
  mapEmbedUrl,
  mapOpenUrl,
  roomView,
  statusText,
} from "@/app/api/roomHelpers";
import { SAMPLE_ROOMS, SEED_ROOMS } from "@/app/data/pumpingRooms";
import { LIMITS_KEY } from "@/app/api/limits";
import SupportPage from "@/app/pages/support/index.vue";

// The directory is Firestore now, so the api module is mocked and the test pushes rooms
// into the live listener.
const api = vi.hoisted(() => ({
  rooms: [],
  push: null,
  addRoom: vi.fn(async () => "room-new"),
  reportRoom: vi.fn(async () => "report-new"),
}));

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("@/app/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: { value: { uid: "u1" } } }) }));
vi.mock("@/app/api/rooms", () => ({
  ROOMS_MAX: 200,
  subscribeRooms: (onData) => {
    api.push = onData;
    queueMicrotask(() => onData(api.rooms));
    return () => {};
  },
  addRoom: (...a) => api.addRoom(...a),
  reportRoom: (...a) => api.reportRoom(...a),
}));

async function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(SupportPage, {
    global: {
      plugins: [pinia],
      stubs: { GooglePlaceAutocomplete: { name: "GooglePlaceAutocomplete", emits: ["selected"], template: '<div class="google-place-stub" />' } },
    },
  });
  await flushPromises();
  return wrapper;
}
const btn = (wrapper, text) => wrapper.findAll("button").find((b) => b.text() === text);
const btns = (wrapper, text) => wrapper.findAll("button").filter((b) => b.text() === text);
async function openRooms(wrapper) {
  await wrapper.findAll('[role="tab"]')[1].trigger("click");
}
const roomNames = (wrapper) => wrapper.findAll(".sp__room-name").map((h) => h.text());

beforeEach(() => {
  localStorage.clear();
  api.rooms = [];
  api.push = null;
  api.addRoom.mockClear();
  api.reportRoom.mockClear();
  api.addRoom.mockResolvedValue("room-new");
  api.reportRoom.mockResolvedValue("report-new");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("room helpers", () => {
  const [smu, raffles] = SAMPLE_ROOMS;
  it("has exactly the two seed rooms, under both names", () => {
    expect(SAMPLE_ROOMS).toBe(SEED_ROOMS);
    expect(SEED_ROOMS.every((r) => r.seed === true)).toBe(true);
    expect(SAMPLE_ROOMS.map((r) => r.name)).toEqual(["SMU Library Nursing Room", "Raffles City Family Room"]);
    expect(smu.features).toEqual(["Chair", "Power outlet", "Lockable"]);
    expect(smu.verifiedDaysAgo).toBe(4);
  });
  it("builds map urls for room locations", () => {
    const q = encodeURIComponent("SMU Library Nursing Room, 70 Stamford Road, Singapore 178901");
    expect(mapEmbedUrl(smu)).toBe(`https://www.google.com/maps?q=${q}&output=embed`);
    expect(mapOpenUrl(smu)).toBe(`https://www.google.com/maps/search/?api=1&query=${q}`);
  });
  it("describes status", () => {
    expect(statusText(smu)).toBe("Verified 4 days ago");
    expect(statusText(raffles)).toBe("Needs verification");
  });
  it("filters by status, features (AND) and search", () => {
    expect(filterRooms(SAMPLE_ROOMS, { status: "verified" })).toEqual([smu]);
    expect(filterRooms(SAMPLE_ROOMS, { status: "needs verification" })).toEqual([raffles]);
    expect(filterRooms(SAMPLE_ROOMS, { features: ["Chair"] })).toHaveLength(2);
    expect(filterRooms(SAMPLE_ROOMS, { features: ["Chair", "Sink"] })).toEqual([raffles]);
    expect(filterRooms(SAMPLE_ROOMS, { features: ["Sink", "Lockable"] })).toEqual([]);
    expect(filterRooms(SAMPLE_ROOMS, { search: "north bridge" })).toEqual([raffles]);
    expect(filterRooms(SAMPLE_ROOMS, { search: "  LIBRARY " })).toEqual([smu]);
  });
});

describe("the Firestore room shape", () => {
  it("turns the features map into the labels the UI already used", () => {
    expect(featureLabels({ chair: true, power: false, sink: true })).toEqual(["Chair", "Sink"]);
    expect(featureLabels(["Chair"])).toEqual(["Chair"]);
    expect(featureLabels(null)).toEqual([]);
    expect(featureMap(["Chair", "Stroller access"])).toEqual({
      chair: true,
      power: false,
      lockable: false,
      sink: false,
      stroller: true,
    });
  });

  it("maps a document to the list shape, counting the days since it was verified", () => {
    const now = new Date("2026-10-10T09:00:00Z");
    const view = roomView(
      "r1",
      {
        name: "Office room",
        address: "1 Road",
        features: { chair: true },
        status: "verified",
        verifiedAt: new Date("2026-10-07T09:00:00Z"),
        createdBy: "u1",
      },
      now,
    );
    expect(view).toEqual({
      id: "r1",
      name: "Office room",
      address: "1 Road",
      details: "",
      placeId: "",
      lat: null,
      lng: null,
      region: null,
      features: ["Chair"],
      status: "verified",
      verifiedAt: new Date("2026-10-07T09:00:00Z"),
      verifiedDaysAgo: 3,
      createdBy: "u1",
      seed: false,
    });
    expect(statusText(view)).toBe("Verified 3 days ago");
  });

  it("calls an unverified room needs verification, the way the page always has", () => {
    const view = roomView("r2", { name: "A", address: "B", status: "unverified" });
    expect(view.status).toBe("needs verification");
    expect(view.verifiedDaysAgo).toBeNull();
    expect(statusText(view)).toBe("Needs verification");
  });
});

describe("App support page", () => {
  it("shows the heading and three tabs", async () => {
    const wrapper = await mountPage();
    expect(wrapper.get("h1").text()).toBe("Support");
    expect(wrapper.text()).toContain("Guides, trusted contacts and places to pump.");
    expect(wrapper.findAll('[role="tab"]').map((t) => t.text())).toEqual(["Guides", "Pumping rooms", "Trusted resources"]);
  });

  it("toggles guides in an accordion", async () => {
    const wrapper = await mountPage();
    const first = wrapper.get("#guide-btn-settle");
    expect(first.attributes("aria-expanded")).toBe("false");
    expect(wrapper.find("#guide-panel-settle").exists()).toBe(false);
    await first.trigger("click");
    expect(first.attributes("aria-expanded")).toBe("true");
    expect(wrapper.get("#guide-panel-settle").text()).toContain("Offer a feed");
    expect(wrapper.get("#guide-panel-settle").text()).toContain("Call your doctor if");
    await wrapper.get("#guide-btn-fever").trigger("click");
    expect(wrapper.find("#guide-panel-settle").exists()).toBe(true);
    await first.trigger("click");
    expect(first.attributes("aria-expanded")).toBe("false");
    expect(wrapper.find("#guide-panel-settle").exists()).toBe(false);
    expect(wrapper.findAll("button.btn-primary")).toHaveLength(0);
  });

  it("lists trusted resources with tel links only where there is a number", async () => {
    const wrapper = await mountPage();
    await wrapper.findAll('[role="tab"]')[2].trigger("click");
    expect(wrapper.text()).toContain("Check numbers and hours before you rely on them.");
    const tels = wrapper.findAll('a[href^="tel:"]').map((a) => a.attributes("href"));
    expect(tels).toEqual(["tel:1767", "tel:+6563892222"]);
    expect(wrapper.text()).toContain("Your doctor or clinic");
  });

  it("shows both rooms with the first room in the map and detail panel", async () => {
    const wrapper = await mountPage();
    await openRooms(wrapper);
    expect(roomNames(wrapper)).toEqual(["SMU Library Nursing Room", "Raffles City Family Room"]);
    expect(wrapper.text()).toContain("Verified 4 days ago");
    expect(wrapper.text()).toContain("Needs verification");
    const frame = wrapper.get("iframe");
    expect(frame.attributes("src")).toBe(mapEmbedUrl(SAMPLE_ROOMS[0]));
    expect(frame.attributes("title")).toBe("Map of SMU Library Nursing Room");
    expect(frame.attributes("loading")).toBe("lazy");
    expect(frame.attributes("referrerpolicy")).toBe("no-referrer-when-downgrade");
    expect(wrapper.text()).toContain("Community listings may be unverified. Check details before visiting.");
    expect(wrapper.get(".sp__selected-details").text()).toContain("SMU Library Nursing Room");
  });

  it("changes the map and offers directions for the selected room", async () => {
    const wrapper = await mountPage();
    await openRooms(wrapper);
    await wrapper.findAll("button").filter((b) => b.text() === "Show on map")[1].trigger("click");
    expect(wrapper.get("iframe").attributes("src")).toBe(mapEmbedUrl(SAMPLE_ROOMS[1]));
    const open = wrapper.findAll("a").find((a) => a.text() === "Get directions" && a.classes().includes("btn-primary"));
    expect(open.attributes("href")).toBe(mapOpenUrl(SAMPLE_ROOMS[1]));
    const directions = wrapper.findAll("a").filter((a) => a.text() === "Get directions");
    expect(directions[0].attributes("href")).toBe(mapOpenUrl(SAMPLE_ROOMS[0]));
    expect(wrapper.text()).not.toContain("Add to Google Calendar");
  });

  it("saves places on this device and shows them in the saved view", async () => {
    const wrapper = await mountPage();
    await openRooms(wrapper);
    await wrapper.findAll(".sp__save")[0].trigger("click");
    expect(JSON.parse(localStorage.getItem("nurturetrack:saved-pumping-rooms"))).toEqual([SAMPLE_ROOMS[0].id]);
    await btn(wrapper, "Saved places · 1").trigger("click");
    expect(roomNames(wrapper)).toEqual(["SMU Library Nursing Room"]);
    expect(wrapper.text()).not.toContain("Raffles City Family Room");
  });

  it("filters by status, feature and search, with an empty state", async () => {
    const wrapper = await mountPage();
    await openRooms(wrapper);
    await wrapper.findAll('[role="radio"]').find((r) => r.text() === "Verified").trigger("click");
    expect(roomNames(wrapper)).toEqual(["SMU Library Nursing Room"]);
    await wrapper.findAll('[role="radio"]').find((r) => r.text() === "All").trigger("click");
    const sink = wrapper.findAll('button[aria-pressed]').find((b) => b.text() === "Sink");
    await sink.trigger("click");
    expect(roomNames(wrapper)).toEqual(["Raffles City Family Room"]);
    expect(wrapper.get("iframe").attributes("title")).toBe("Map of Raffles City Family Room");
    await wrapper.findAll('button[aria-pressed]').find((b) => b.text() === "Lockable").trigger("click");
    expect(wrapper.text()).toContain("No rooms match. Try removing a filter.");
    expect(wrapper.find("iframe").exists()).toBe(false);
    await sink.trigger("click");
    await wrapper.findAll('button[aria-pressed]').find((b) => b.text() === "Lockable").trigger("click");
    await wrapper.get('input[type="search"]').setValue("stamford");
    expect(roomNames(wrapper)).toEqual(["SMU Library Nursing Room"]);
  });

  it("validates and saves a new room to the directory", async () => {
    const wrapper = await mountPage();
    await openRooms(wrapper);
    await btn(wrapper, "Add a place").trigger("click");
    expect(wrapper.findAll("button.btn-primary").some((button) => button.text() === "Save room")).toBe(true);
    await btn(wrapper, "Save room").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Choose a building or address from Google suggestions.");
    expect(wrapper.text()).toContain("Add the floor and exact room location.");
    expect(api.addRoom).not.toHaveBeenCalled();

    wrapper.getComponent({ name: "GooglePlaceAutocomplete" }).vm.$emit("selected", {
      name: "Orchard Mall",
      address: "1 Orchard Road, Singapore 238824",
      details: "",
      placeId: "place-1",
      lat: 1.304,
      lng: 103.832,
    });
    await flushPromises();
    await wrapper.get('form input[type="text"]').setValue("Level 3, beside the accessible toilet");
    await wrapper.findAll('form button[aria-pressed]').find((b) => b.text() === "Stroller access").trigger("click");
    await btn(wrapper, "Save room").trigger("click");
    await flushPromises();

    expect(api.addRoom).toHaveBeenCalledWith("u1", {
      name: "Orchard Mall",
      address: "1 Orchard Road, Singapore 238824",
      details: "Level 3, beside the accessible toilet",
      placeId: "place-1",
      lat: 1.304,
      lng: 103.832,
      features: ["Stroller access"],
    });
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.text()).toContain("Orchard Mall added. It needs verification.");
    expect(wrapper.findAll("button.btn-primary").some((button) => button.text() === "Save room")).toBe(false);
  });

  it("says so and does not clear the form when the room could not be saved", async () => {
    api.addRoom.mockRejectedValue({ code: "permission-denied" });
    const wrapper = await mountPage();
    await openRooms(wrapper);
    await btn(wrapper, "Add a place").trigger("click");
    wrapper.getComponent({ name: "GooglePlaceAutocomplete" }).vm.$emit("selected", {
      name: "A building",
      address: "1 Road",
      placeId: "place-2",
      lat: 1.3,
      lng: 103.8,
    });
    await flushPromises();
    await wrapper.get('form input[type="text"]').setValue("Level 2 toilet lobby");
    await btn(wrapper, "Save room").trigger("click");
    await flushPromises();
    expect(wrapper.find("form").exists()).toBe(true);
    expect(wrapper.get('[role="alert"]').text()).toMatch(/firestore\.rules/);
  });

  it("cancels the add form without saving", async () => {
    const wrapper = await mountPage();
    await openRooms(wrapper);
    await btn(wrapper, "Add a place").trigger("click");
    await btn(wrapper, "Cancel").trigger("click");
    expect(wrapper.find("form").exists()).toBe(false);
    expect(api.addRoom).not.toHaveBeenCalled();
  });

  it("falls back to the seed rooms while the directory is empty, and cannot report them", async () => {
    const wrapper = await mountPage();
    await openRooms(wrapper);
    expect(wrapper.text()).toContain("Community listings may be unverified.");
    expect(wrapper.text()).toContain("Community submitted");
    expect(wrapper.text()).not.toContain("Seed data");
    expect(wrapper.text()).not.toContain("Seed rooms");
    expect(btns(wrapper, "Confirm this room")).toHaveLength(0);
    expect(btns(wrapper, "Flag as gone")).toHaveLength(0);
  });

  it("shows the directory instead of the seed rooms as soon as it has one", async () => {
    api.rooms = [
      {
        id: "r1",
        name: "Office nursing room",
        address: "1 Example Road",
        features: { chair: true, power: true },
        status: "verified",
        verifiedAt: new Date(Date.now() - 3 * 86400000),
      },
    ];
    const wrapper = await mountPage();
    await openRooms(wrapper);
    expect(roomNames(wrapper)).toEqual(["Office nursing room"]);
    expect(wrapper.text()).not.toContain("Seed rooms for now");
    expect(wrapper.text()).toContain("Verified 3 days ago");
    expect(wrapper.findAll(".sp__room .sp__pills .app-pill").map((p) => p.text())).toEqual(["Chair", "Power outlet"]);
  });

  it("confirms and flags a real room, and thanks you either way", async () => {
    api.rooms = [{ id: "r1", name: "Office nursing room", address: "1 Example Road", status: "unverified" }];
    const wrapper = await mountPage();
    await openRooms(wrapper);
    await btn(wrapper, "Confirm this room").trigger("click");
    await flushPromises();
    expect(api.reportRoom).toHaveBeenCalledWith("u1", "r1", "confirm");
    expect(wrapper.text()).toContain("Office nursing room is marked as verified.");

    await btn(wrapper, "Flag as gone").trigger("click");
    await flushPromises();
    expect(api.reportRoom).toHaveBeenLastCalledWith("u1", "r1", "gone");
    expect(wrapper.text()).toContain("flagged and needs verification again");
  });

  it("stops after five reports in ten minutes", async () => {
    api.rooms = [{ id: "r1", name: "Office nursing room", address: "1 Example Road", status: "unverified" }];
    const wrapper = await mountPage();
    await openRooms(wrapper);
    for (let i = 0; i < 5; i += 1) {
      await btn(wrapper, "Confirm this room").trigger("click");
      await flushPromises();
    }
    expect(api.reportRoom).toHaveBeenCalledTimes(5);
    await btn(wrapper, "Confirm this room").trigger("click");
    await flushPromises();
    expect(api.reportRoom).toHaveBeenCalledTimes(5);
    expect(wrapper.text()).toContain("You have done that a few times just now.");
    expect(JSON.parse(localStorage.getItem(LIMITS_KEY)).roomReport).toHaveLength(5);
  });

  it("explains a failure to read the directory", async () => {
    const wrapper = await mountPage();
    await openRooms(wrapper);
    const { useRoomsStore } = await import("@/app/stores/rooms");
    useRoomsStore().error = { code: "permission-denied" };
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toMatch(/firestore\.rules/);
  });
});
