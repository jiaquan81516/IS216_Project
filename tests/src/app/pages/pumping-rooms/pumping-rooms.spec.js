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
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("pumping rooms page", () => {
  it("renders the heading, a real list and the mall entries, none verified", async () => {
    const w = await mountPage();
    expect(w.get("h1").text()).toBe("Find a pumping room");
    expect(w.get("ul[aria-label='Pumping rooms']").exists()).toBe(true);
    expect(names(w)).toContain("VivoCity");
    expect(w.text()).toContain("Mall, nursing room not confirmed");
    expect(w.text()).not.toMatch(/Verified \d|Verified today/);
    expect(w.get("[aria-live='polite']").text()).toMatch(/^\d+ rooms/);
    expect(w.get("label[for='pr-location']").text()).toBe("Location");
  });
  it("shows database rooms before malls and verified status only for verified rooms", async () => {
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
  it("opens the filter panel and Verified only hides malls", async () => {
    const w = await mountPage();
    const filter = w.findAll("button").find((b) => b.text().startsWith("Filter"));
    expect(filter.attributes("aria-expanded")).toBe("false");
    await filter.trigger("click");
    expect(w.find("#pr-filters").exists()).toBe(true);
    const verifiedBox = w.findAll("label").find((l) => l.text() === "Verified only").get("input");
    await verifiedBox.setValue(true);
    expect(names(w)).toEqual([]);
    expect(w.text()).toContain("0 rooms");
  });
  it("marks the selected card and tells the map", async () => {
    const w = await mountPage();
    await w.findAll(".rc__name-btn").find((b) => b.text() === "JEM").trigger("click");
    const on = w.findAll("li[aria-current='true']");
    expect(on).toHaveLength(1);
    expect(on[0].text()).toContain("JEM");
    expect(w.findComponent({ name: "RoomMap" }).props("selectedId")).toBe("mall-jem");
  });
  it("selects a card when the map reports a pin click", async () => {
    const w = await mountPage();
    w.findComponent({ name: "RoomMap" }).vm.$emit("select", "mall-funan");
    await flushPromises();
    expect(w.get("li[aria-current='true']").text()).toContain("Funan");
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
  it("shows the key notice and no map when the key is missing, and still filters", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const w = await mountPage();
    const notice = w.get(".pr__notice[role='status']");
    expect(notice.text()).toBe("The map needs a Google Maps key. Add VITE_GOOGLE_MAPS_API_KEY to your .env and restart.");
    expect(w.findComponent({ name: "RoomMap" }).exists()).toBe(false);
    await w.get("#pr-location").setValue("tampines");
    expect(names(w)).toEqual(["Tampines Mall"]);
  });
  it("explains a denied location request", async () => {
    Object.defineProperty(globalThis.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (_ok, fail) => fail({ code: 1 }) },
    });
    const w = await mountPage();
    await w.get("button[aria-label='Use my location']").trigger("click");
    expect(w.text()).toContain("We could not access your location");
    delete globalThis.navigator.geolocation;
  });
  it("re-sorts by distance after a successful location", async () => {
    Object.defineProperty(globalThis.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (ok) => ok({ coords: { latitude: 1.4361, longitude: 103.786 } }) },
    });
    const w = await mountPage();
    expect(names(w)[0]).toBe("Causeway Point");
    expect(w.get("[aria-live='polite']").text()).toContain("near you");
    delete globalThis.navigator.geolocation;
  });
});
