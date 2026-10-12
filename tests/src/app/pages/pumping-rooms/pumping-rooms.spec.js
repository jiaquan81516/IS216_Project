import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";

const api = vi.hoisted(() => ({ rooms: [], addRoom: vi.fn(async () => "room-new"), reportRoom: vi.fn() }));

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("@/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: { value: { uid: "u1" } } }) }));
vi.mock("@/api/rooms", () => ({
  ROOMS_MAX: 200,
  subscribeRooms: (onData) => {
    queueMicrotask(() => onData(api.rooms));
    return () => {};
  },
  addRoom: (...a) => api.addRoom(...a),
  reportRoom: (...a) => api.reportRoom(...a),
}));
import { BMSG_ROOMS } from "@/app/data/bmsgRooms";
import PumpingRoomsPage from "@/app/pages/pumping-rooms/index.vue";

async function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: { template: "<div />" } }] });
  const wrapper = mount(PumpingRoomsPage, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return wrapper;
}
const names = (w) => w.findAll(".rc__name-btn").map((b) => b.text());

beforeEach(() => {
  localStorage.clear();
  api.rooms = [];
  api.addRoom.mockClear();
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
    expect(w.get("label[for='pr-location']").text()).toBe("Search rooms");
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
  it("marks the selected card and moves the OneMap embed to it", async () => {
    const w = await mountPage();
    await w.findAll(".rc__name-btn").find((b) => b.text() === "Waterway Point").trigger("click");
    const on = w.findAll("li[aria-current='true']");
    expect(on).toHaveLength(1);
    expect(on[0].text()).toContain("Waterway Point");
    expect(w.get("iframe").attributes("src")).toMatch(/^https:\/\/www\.onemap\.gov\.sg\/amm\/amm\.html\?.*marker=latLng:1\.\d+,103\.\d+!colour:red/);
    expect(w.get("iframe").attributes("title")).toBe("Map of Waterway Point");
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
  it("explains that adding a room needs OneMap search, with a disabled save and no form", async () => {
    const w = await mountPage();
    await w.findAll("button").find((b) => b.text() === "Add a room").trigger("click");
    expect(w.text()).toContain("Adding a room needs OneMap address search, which comes with the deployed version. For now rooms are added by the team.");
    expect(w.find("form").exists()).toBe(false);
    expect(w.findAll("button").find((b) => b.text() === "Save room").attributes("disabled")).toBeDefined();
    expect(api.addRoom).not.toHaveBeenCalled();
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
  it("shows the OneMap embed over the whole island with attribution", async () => {
    const w = await mountPage();
    const frame = w.get("iframe");
    expect(frame.attributes("src")).toBe("https://www.onemap.gov.sg/amm/amm.html?mapStyle=Default&zoomLevel=12&latLng=1.3521,103.8198");
    expect(frame.attributes("title")).toBe("Map of Singapore");
    expect(frame.attributes("loading")).toBe("lazy");
    expect(frame.attributes("referrerpolicy")).toBe("no-referrer-when-downgrade");
    const credit = w.findAll("a").find((a) => a.text().startsWith("Map by OneMap"));
    expect(credit.attributes("href")).toBe("https://www.onemap.gov.sg/");
    expect(w.find(".pr__notice").exists()).toBe(false);
    expect(w.get("#pr-location").attributes("placeholder")).toBe("Mall or street name");
    expect(w.text()).not.toMatch(/ away/);
  });
  it("gives cards one Open in OneMap link built from coordinates, never from a Google place id", async () => {
    api.rooms = [
      { id: "a", name: "Zed Lounge", address: "9 Road", details: "L2", placeId: "PID1", lat: 1.5, lng: 103.9, features: {} },
    ];
    const w = await mountPage();
    const open = w.findAll("a").filter((a) => a.text().startsWith("Open in OneMap"));
    expect(open.map((a) => a.attributes("href"))).toContain("https://www.onemap.gov.sg/amm/amm.html?mapStyle=Default&zoomLevel=18&latLng=1.5,103.9&marker=latLng:1.5,103.9!colour:red&popupWidth=200");
    expect(w.findAll("a").some((a) => a.text().startsWith("Directions"))).toBe(false);
    expect(open.every((a) => !a.attributes("href").includes("PID1"))).toBe(true);
    expect(open[0].attributes("target")).toBe("_blank");
    expect(open[0].attributes("rel")).toBe("noopener noreferrer");
    expect(open[0].text()).toContain("opens in a new tab");
  });
  it("filters by the text search", async () => {
    const w = await mountPage();
    await w.get("#pr-location").setValue("orchard");
    expect(names(w)).toEqual(["Takashimaya"]);
  });
  it("shows distance and the located embed only after Use my location", async () => {
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
    expect(w.get("iframe").attributes("title")).toBe("Map of your area");
    delete globalThis.navigator.geolocation;
  });
});
