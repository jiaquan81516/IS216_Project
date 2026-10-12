import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import {
  featureLabels,
  featureMap,
  filterRooms,
  roomView,
  statusText,
} from "@/app/utils/roomHelpers";
import { SAMPLE_ROOMS, SEED_ROOMS } from "@/app/data/pumpingRooms";
const pushMock = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: pushMock }),
}));
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
vi.mock("@/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: { value: { uid: "u1" } } }) }));
vi.mock("@/api/rooms", () => ({
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
      stubs: { RouterLink: { props: ["to"], template: '<a :href="to"><slot /></a>' } },
    },
  });
  await flushPromises();
  return wrapper;
}

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
    expect(wrapper.text()).toContain("Guides and trusted contacts.");
    expect(wrapper.findAll('[role="tab"]').map((t) => t.text())).toEqual(["Guides", "Pumping rooms", "Trusted resources"]);
    expect(wrapper.text()).not.toContain("Pumping Room Directory");
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

  it("opens the pumping room locator from the Pumping rooms tab", async () => {
    pushMock.mockClear();
    const wrapper = await mountPage();
    await wrapper.findAll('[role="tab"]')[1].trigger("click");
    expect(pushMock).toHaveBeenCalledWith("/support/rooms");
    expect(wrapper.find("iframe").exists()).toBe(false);
  });

  it("puts a For your child group first in Trusted resources", async () => {
    const wrapper = await mountPage();
    await wrapper.findAll('[role="tab"]')[2].trigger("click");
    expect(wrapper.findAll("h2")[0].text()).toBe("For your child");
    const cards = wrapper.findAll(".sp__res")[0].findAll(".sp__res-item");
    expect(cards.map((c) => c.get("h3").text())).toEqual(["Kids emergency care", "Clinics for a sick child"]);
    expect(cards[0].text()).toContain("Children's emergency departments and when to go.");
    expect(cards[1].text()).toContain("Nearby CHAS clinics for illness that is not an emergency.");
    expect(cards.map((c) => c.get("a").attributes("href"))).toEqual(["/support/kids-care", "/support/kids-care?view=clinics"]);
  });
});
