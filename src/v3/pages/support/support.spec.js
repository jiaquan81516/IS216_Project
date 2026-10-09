import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { calendarUrl, filterRooms, mapEmbedUrl, mapOpenUrl, statusText } from "@/v3/api/roomHelpers";
import { SAMPLE_ROOMS } from "@/v3/data/pumpingRooms";
import { ROOMS_KEY } from "@/v3/stores/rooms";
import SupportPage from "./index.vue";

function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(SupportPage, { global: { plugins: [pinia] } });
}
const btn = (wrapper, text) => wrapper.findAll("button").find((b) => b.text() === text);
async function openRooms(wrapper) {
  await wrapper.findAll('[role="tab"]')[1].trigger("click");
}
const roomNames = (wrapper) => wrapper.findAll(".sp__room-name").map((h) => h.text());

beforeEach(() => localStorage.clear());

describe("room helpers", () => {
  const [smu, raffles] = SAMPLE_ROOMS;
  it("has exactly the two sample rooms", () => {
    expect(SAMPLE_ROOMS.map((r) => r.name)).toEqual(["SMU Library Nursing Room", "Raffles City Family Room"]);
    expect(smu.features).toEqual(["Chair", "Power outlet", "Lockable"]);
    expect(smu.verifiedDaysAgo).toBe(4);
  });
  it("builds the map and calendar urls", () => {
    const q = encodeURIComponent("SMU Library Nursing Room, 70 Stamford Road, Singapore 178901");
    expect(mapEmbedUrl(smu)).toBe(`https://www.google.com/maps?q=${q}&output=embed`);
    expect(mapOpenUrl(smu)).toBe(`https://www.google.com/maps/search/?api=1&query=${q}`);
    expect(calendarUrl(smu)).toBe(
      "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" +
        encodeURIComponent("Pumping at SMU Library Nursing Room") +
        "&location=" +
        encodeURIComponent("70 Stamford Road, Singapore 178901") +
        "&details=" +
        encodeURIComponent("Planned visit from NurtureTrack"),
    );
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

describe("V3 support page", () => {
  it("shows the heading and three tabs", () => {
    const wrapper = mountPage();
    expect(wrapper.get("h1").text()).toBe("Support");
    expect(wrapper.text()).toContain("Guides, trusted contacts and places to pump.");
    expect(wrapper.findAll('[role="tab"]').map((t) => t.text())).toEqual(["Guides", "Pumping rooms", "Trusted resources"]);
  });

  it("toggles guides in an accordion", async () => {
    const wrapper = mountPage();
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
    const wrapper = mountPage();
    await wrapper.findAll('[role="tab"]')[2].trigger("click");
    expect(wrapper.text()).toContain("Check numbers and hours before you rely on them.");
    const tels = wrapper.findAll('a[href^="tel:"]').map((a) => a.attributes("href"));
    expect(tels).toEqual(["tel:1767", "tel:+6563892222"]);
    expect(wrapper.text()).toContain("Your doctor or clinic");
  });

  it("shows both rooms, the first on the map, with no solid button", async () => {
    const wrapper = mountPage();
    await openRooms(wrapper);
    expect(roomNames(wrapper)).toEqual(["SMU Library Nursing Room", "Raffles City Family Room"]);
    expect(wrapper.text()).toContain("Verified 4 days ago");
    expect(wrapper.text()).toContain("Needs verification");
    const frame = wrapper.get("iframe");
    expect(frame.attributes("src")).toBe(mapEmbedUrl(SAMPLE_ROOMS[0]));
    expect(frame.attributes("title")).toBe("Map of SMU Library Nursing Room");
    expect(frame.attributes("loading")).toBe("lazy");
    expect(frame.attributes("referrerpolicy")).toBe("no-referrer-when-downgrade");
    expect(wrapper.findAll("button.btn-primary")).toHaveLength(0);
  });

  it("changes the map and links the calendar for the selected room", async () => {
    const wrapper = mountPage();
    await openRooms(wrapper);
    await wrapper.findAll("button").filter((b) => b.text() === "Show on map")[1].trigger("click");
    expect(wrapper.get("iframe").attributes("src")).toBe(mapEmbedUrl(SAMPLE_ROOMS[1]));
    const open = wrapper.findAll("a").find((a) => a.text() === "Open in Google Maps");
    expect(open.attributes("href")).toBe(mapOpenUrl(SAMPLE_ROOMS[1]));
    const cal = wrapper.findAll("a").filter((a) => a.text() === "Add to Google Calendar");
    expect(cal[0].attributes("href")).toBe(calendarUrl(SAMPLE_ROOMS[0]));
    expect(cal[0].attributes("target")).toBe("_blank");
    expect(cal[0].attributes("rel")).toBe("noopener noreferrer");
  });

  it("filters by status, feature and search, with an empty state", async () => {
    const wrapper = mountPage();
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

  it("validates and saves a new room", async () => {
    const wrapper = mountPage();
    await openRooms(wrapper);
    await btn(wrapper, "Add a room").trigger("click");
    expect(wrapper.findAll("button.btn-primary")).toHaveLength(1);
    await btn(wrapper, "Save room").trigger("click");
    expect(wrapper.text()).toContain("Enter the room name.");
    expect(wrapper.text()).toContain("Enter the address.");
    expect(roomNames(wrapper)).toHaveLength(2);

    const inputs = wrapper.findAll("form input");
    await inputs[0].setValue("Orchard Mall Parent Room");
    await inputs[1].setValue("1 Orchard Road, Singapore 238824");
    await wrapper.findAll('form button[aria-pressed]').find((b) => b.text() === "Stroller access").trigger("click");
    await btn(wrapper, "Save room").trigger("click");

    expect(wrapper.find("form").exists()).toBe(false);
    expect(roomNames(wrapper)).toEqual(["SMU Library Nursing Room", "Raffles City Family Room", "Orchard Mall Parent Room"]);
    expect(wrapper.text()).toContain("Orchard Mall Parent Room added. It needs verification.");
    expect(wrapper.get("iframe").attributes("title")).toBe("Map of Orchard Mall Parent Room");
    const stored = JSON.parse(localStorage.getItem(ROOMS_KEY));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ status: "needs verification", features: ["Stroller access"] });
    expect(wrapper.findAll("button.btn-primary")).toHaveLength(0);
  });

  it("cancels the add form without saving", async () => {
    const wrapper = mountPage();
    await openRooms(wrapper);
    await btn(wrapper, "Add a room").trigger("click");
    await btn(wrapper, "Cancel").trigger("click");
    expect(wrapper.find("form").exists()).toBe(false);
    expect(localStorage.getItem(ROOMS_KEY)).toBeNull();
  });

  it("restores saved rooms after the sample rooms", async () => {
    localStorage.setItem(ROOMS_KEY, JSON.stringify([{ id: "c1", name: "Test Room", address: "1 Test Street", features: [] }]));
    const wrapper = mountPage();
    await openRooms(wrapper);
    expect(roomNames(wrapper)[2]).toBe("Test Room");
  });
});
