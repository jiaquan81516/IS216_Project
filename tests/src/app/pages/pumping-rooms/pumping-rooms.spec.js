import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";

const api = vi.hoisted(() => ({ rooms: [], addRoom: vi.fn(async () => "room-new"), reportRoom: vi.fn() }));

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("@/app/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: { value: { uid: "u1" } } }) }));
vi.mock("@/app/api/rooms", () => ({
  ROOMS_MAX: 200,
  subscribeRooms: (onData) => {
    queueMicrotask(() => onData(api.rooms));
    return () => {};
  },
  addRoom: (...a) => api.addRoom(...a),
  reportRoom: (...a) => api.reportRoom(...a),
}));
// Never load the real Maps script. The loader returns a tiny fake with a places library.
vi.mock("@/app/api/googleMaps", () => ({
  loadGoogleMaps: vi.fn(async () => ({
    importLibrary: async () => ({
      Autocomplete: class {
        addListener() {
          return { remove() {} };
        }
        getPlace() {
          return {};
        }
      },
    }),
  })),
}));

import { resetMapsState, setMapsState } from "@/app/api/mapsState";
import { BMSG_ROOMS } from "@/app/data/bmsgRooms";
import PumpingRoomsPage from "@/app/pages/pumping-rooms/index.vue";

const stubs = {
  RoomMap: { name: "RoomMap", props: ["rooms", "selectedId", "center", "zoom"], emits: ["select"], template: '<div class="map-stub" />' },
  GooglePlaceAutocomplete: { name: "GooglePlaceAutocomplete", emits: ["selected"], template: '<div class="place-stub" />' },
};

async function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: { template: "<div />" } }] });
  const wrapper = mount(PumpingRoomsPage, { global: { plugins: [pinia, router], stubs } });
  await flushPromises();
  return wrapper;
}
const names = (w) => w.findAll(".rc__name-btn").map((b) => b.text());

beforeEach(() => {
  localStorage.clear();
  api.rooms = [];
  api.addRoom.mockClear();
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "AIzaTestKey1234567890");
  resetMapsState();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("pumping rooms page", () => {
  it("renders the heading, a real list and the BMSG rooms, all verified", async () => {
    const w = await mountPage();
    expect(w.get("h1").text()).toBe("Find a pumping room");
    expect(w.get("ul[aria-label='Pumping rooms']").exists()).toBe(true);
    expect(names(w)).toContain("VivoCity");
    expect(w.text()).not.toContain("nursing room not confirmed");
    expect(w.findAll(".rc__verify--ok")).toHaveLength(BMSG_ROOMS.length);
    expect(w.findAll(".rc__verify--ok")[0].text()).toMatch(/^Verified (today|\d+ days? ago)$/);
    expect(w.get("[aria-live='polite']").text()).toBe(`${BMSG_ROOMS.length + 1} rooms in Singapore`);
    const src = w.findAll("a").filter((a) => a.text().startsWith("Source: BMSG Nursing Room Directory"));
    expect(src).toHaveLength(BMSG_ROOMS.length);
    expect(src[0].attributes("rel")).toBe("noopener noreferrer");
    expect(w.text()).toContain("Verified rooms are from the Breastfeeding Mothers' Support Group directory. Know another room?");
    expect(w.get("label[for='pr-location']").text()).toBe("Location");
  });
  it("shows database rooms and verified status only for verified rooms", async () => {
    api.rooms = [
      { id: "fs1", name: "Zed Lounge", address: "9 Road", details: "Level 2", placeId: "P", lat: 1.5, lng: 103.9, status: "verified", verifiedAt: new Date(), features: { chair: true } },
    ];
    const w = await mountPage();
    expect(w.text()).toContain("Verified today");
    expect(names(w)).toContain("Zed Lounge");
  });
  it("filters the list as you type in Location", async () => {
    const w = await mountPage();
    await w.get("#pr-location").setValue("vivo");
    expect(names(w)).toEqual(["VivoCity"]);
    await w.get("#pr-location").setValue("zzzz");
    expect(w.text()).toContain("No rooms match");
  });
  it("opens the filter panel and Verified only shows the BMSG rooms", async () => {
    const w = await mountPage();
    const filter = w.findAll("button").find((b) => b.text().startsWith("Filter"));
    expect(filter.attributes("aria-expanded")).toBe("false");
    await filter.trigger("click");
    expect(w.find("#pr-filters").exists()).toBe(true);
    const verifiedBox = w.findAll("label").find((l) => l.text() === "Verified only").get("input");
    await verifiedBox.setValue(true);
    expect(names(w)).toHaveLength(BMSG_ROOMS.length);
    expect(names(w)).not.toContain("SMU Library Nursing Room");
    expect(w.get("[aria-live='polite']").text()).toContain(`${BMSG_ROOMS.length} rooms`);
  });
  it("marks the selected card and tells the map", async () => {
    const w = await mountPage();
    await w.findAll(".rc__name-btn").find((b) => b.text() === "Waterway Point").trigger("click");
    const on = w.findAll("li[aria-current='true']");
    expect(on).toHaveLength(1);
    expect(on[0].text()).toContain("Waterway Point");
    expect(w.findComponent({ name: "RoomMap" }).props("selectedId")).toBe("bmsg-waterway-point");
  });
  it("selects a card when the map reports a pin click", async () => {
    const w = await mountPage();
    w.findComponent({ name: "RoomMap" }).vm.$emit("select", "bmsg-vivocity");
    await flushPromises();
    expect(w.get("li[aria-current='true']").text()).toContain("VivoCity");
  });
  it("keeps saved places reachable", async () => {
    const w = await mountPage();
    await w.findAll(".rc .app-textbtn")[0].trigger("click");
    const savedTab = w.findAll("button").find((b) => b.text().startsWith("Saved places"));
    expect(savedTab.text()).toContain("(1)");
    await savedTab.trigger("click");
    expect(names(w)).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("nurturetrack:saved-pumping-rooms"))).toHaveLength(1);
  });
  it("opens the add a room panel and saves through addRoom", async () => {
    const w = await mountPage();
    await w.findAll("button").find((b) => b.text() === "Add a room").trigger("click");
    expect(w.find("form[aria-label='Add a room']").exists()).toBe(true);
    await w.findAll("button").find((b) => b.text() === "Save room").trigger("click");
    expect(api.addRoom).not.toHaveBeenCalled();
    expect(w.text()).toContain("Choose a building or address");
    w.findComponent({ name: "GooglePlaceAutocomplete" }).vm.$emit("selected", { name: "Test Tower", address: "1 Road", placeId: "P1", lat: 1.3, lng: 103.8 });
    await w.get("input[maxlength='200']").setValue("Level 3");
    await w.findAll("button").find((b) => b.text() === "Save room").trigger("click");
    await flushPromises();
    expect(api.addRoom).toHaveBeenCalledOnce();
    expect(w.find("form[aria-label='Add a room']").exists()).toBe(false);
    expect(w.text()).toContain("Test Tower added. It needs verification.");
  });
  it("explains a denied location request", async () => {
    Object.defineProperty(globalThis.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (_ok, fail) => fail({ code: 1 }) },
    });
    const w = await mountPage();
    await w.findAll("button").find((b) => b.text() === "Use my location").trigger("click");
    expect(w.text()).toContain("We could not access your location");
    delete globalThis.navigator.geolocation;
  });
  it("re-sorts by distance after a successful location", async () => {
    Object.defineProperty(globalThis.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (ok) => ok({ coords: { latitude: 1.4361, longitude: 103.786 } }) },
    });
    const w = await mountPage();
    expect(names(w)[0]).toBe("Waterway Point");
    expect(w.get("[aria-live='polite']").text()).toContain("near you");
    delete globalThis.navigator.geolocation;
  });
  it("still renders the interactive map instead of the embed when a key is present", async () => {
    const w = await mountPage();
    expect(w.findComponent({ name: "RoomMap" }).exists()).toBe(true);
    expect(w.find("iframe").exists()).toBe(false);
    expect(w.get("label[for='pr-location']").text()).toBe("Location");
  });
});

describe("pumping rooms page without a Maps key", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "PASTE_MAPS_KEY");
    resetMapsState();
  });
  const link = (w, text, i = 0) => w.findAll(".rc")[i].findAll("a").find((a) => a.text().startsWith(text));

  it("shows the keyless embed over the whole island, with no map is off notice", async () => {
    const w = await mountPage();
    expect(w.findComponent({ name: "RoomMap" }).exists()).toBe(false);
    const frame = w.get("iframe");
    expect(frame.attributes("src")).toBe("https://www.google.com/maps?q=Singapore&z=11&output=embed");
    expect(frame.attributes("title")).toBe("Map of Singapore");
    expect(frame.attributes("loading")).toBe("lazy");
    expect(frame.attributes("referrerpolicy")).toBe("no-referrer-when-downgrade");
    expect(w.text()).not.toContain("Map view is off");
    expect(w.find(".pr__notice").exists()).toBe(false);
    expect(w.get("label[for='pr-location']").text()).toBe("Search rooms");
    expect(w.get("#pr-location").attributes("placeholder")).toBe("Mall or street name");
    expect(w.get("[aria-live='polite']").text()).toMatch(/^\d+ rooms in Singapore$/);
    expect(w.text()).not.toMatch(/ away/);
  });
  it("moves the embed to a room when its Show on map link is used", async () => {
    const w = await mountPage();
    const card = w.findAll(".rc").find((c) => c.text().includes("Waterway Point"));
    await card.findAll("button").find((b) => b.text().startsWith("Show on map")).trigger("click");
    const src = w.get("iframe").attributes("src");
    expect(src).toMatch(/^https:\/\/www\.google\.com\/maps\?q=.*Waterway.*&z=15&output=embed$/);
    expect(decodeURIComponent(src)).toMatch(/q=1\.\d+,103\.\d+ \(Waterway Point\)/);
    expect(w.get("iframe").attributes("title")).toBe("Map of Waterway Point");
  });
  it("uses the embed when the key was rejected, without any status notice", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "AIzaTestKey1234567890");
    resetMapsState();
    setMapsState("failed");
    const w = await mountPage();
    expect(w.findComponent({ name: "RoomMap" }).exists()).toBe(false);
    expect(w.find("iframe").exists()).toBe(true);
    expect(w.find(".pr__notice").exists()).toBe(false);
  });
  it("gives cards Google Maps links from name and address, place id, or coordinates", async () => {
    api.rooms = [
      { id: "a", name: "Zed Lounge", address: "9 Road", details: "L2", placeId: "PID1", lat: 1.5, lng: 103.9, features: {} },
      { id: "b", name: "", address: "", details: "L2", placeId: "", lat: 1.5, lng: 103.9, features: {} },
    ];
    const w = await mountPage();
    const open = w.findAll("a").filter((a) => a.text().startsWith("Open in Google Maps")).map((a) => a.attributes("href"));
    const dirs = w.findAll("a").filter((a) => a.text().startsWith("Directions")).map((a) => a.attributes("href"));
    expect(open).toContain("https://www.google.com/maps/search/?api=1&query=Zed%20Lounge%2C%209%20Road&query_place_id=PID1");
    expect(dirs).toContain("https://www.google.com/maps/dir/?api=1&destination=Zed%20Lounge%2C%209%20Road");
    expect(open.some((h) => h.includes("VivoCity") && !h.includes("query_place_id"))).toBe(true);
    const a = link(w, "Open in Google Maps");
    expect(a.attributes("target")).toBe("_blank");
    expect(a.attributes("rel")).toBe("noopener noreferrer");
    expect(a.text()).toContain("opens in a new tab");
  });
  it("filters by the text search", async () => {
    const w = await mountPage();
    await w.get("#pr-location").setValue("orchard");
    expect(names(w)).toEqual(["Takashimaya"]);
  });
  it("explains that adding a room is off, with no autocomplete and a disabled save", async () => {
    const w = await mountPage();
    await w.findAll("button").find((b) => b.text() === "Add a room").trigger("click");
    expect(w.text()).toContain("Adding a room needs Google place search, which is turned off for now. You can still use Open in Google Maps to check a place.");
    expect(w.findComponent({ name: "GooglePlaceAutocomplete" }).exists()).toBe(false);
    expect(w.findAll("button").find((b) => b.text() === "Save room").attributes("disabled")).toBeDefined();
    expect(api.addRoom).not.toHaveBeenCalled();
  });
  it("shows distance only after Use my location", async () => {
    Object.defineProperty(globalThis.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (ok) => ok({ coords: { latitude: 1.4361, longitude: 103.786 } }) },
    });
    const w = await mountPage();
    expect(w.text()).not.toMatch(/ away/);
    await w.findAll("button").find((b) => b.text() === "Use my location").trigger("click");
    expect(names(w)[0]).toBe("Waterway Point");
    expect(w.text()).toMatch(/ away/);
    expect(w.get("[aria-live='polite']").text()).toContain("near you");
    delete globalThis.navigator.geolocation;
  });
});
