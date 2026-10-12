import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

vi.mock("@/app/data/chasClinics.json", () => ({
  default: {
    meta: { dataset: "CHAS Clinics", retrievedAt: "2026-10-11", count: 3 },
    clinics: [
      { id: "C1", name: "Alpha Clinic", address: "1 Road, Singapore 111111", postal: "111111", lat: 1.3, lng: 103.8, phone: "6123 4567", type: "gp" },
      { id: "C2", name: "Beta Clinic", address: "2 Lane, Singapore 222222", postal: "222222", lat: 1.4, lng: 103.9, phone: "", type: "gp" },
      { id: "C3", name: "Bright Dental", address: "3 Way, Singapore 333333", postal: "333333", lat: 1.31, lng: 103.81, phone: "", type: "dental" },
    ],
  },
}));

import KidsCarePage from "@/app/pages/kids-care/index.vue";

async function mountPage(view) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/support/kids-care", component: KidsCarePage }] });
  await router.push(view ? `/support/kids-care?view=${view}` : "/support/kids-care");
  await router.isReady();
  const w = mount(KidsCarePage, { global: { plugins: [router] } });
  await flushPromises();
  if (view === "clinics") await vi.waitFor(() => expect(w.findAll(".kc__name").length).toBeGreaterThan(0));
  return { w, router };
}
const names = (w) => w.findAll(".kc__name").map((n) => n.text());

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("no network in tests"))));
});

describe("kids care page", () => {
  it("renders the emergency view by default", async () => {
    const { w } = await mountPage();
    expect(w.get("h1").text()).toBe("Care for your child");
    expect(w.get("label[for='kc-search']").text()).toBe("Search places");
    expect(w.get("#kc-search").attributes("placeholder")).toBe("Name or area");
    expect(w.get("[role='status']").text()).toContain("995");
    expect(w.get("[role='status'] a").attributes("href")).toBe("tel:995");
    expect(w.get("[aria-live='polite']").text()).toBe("2 places in Singapore");
    expect(names(w)).toEqual(["KK Women's and Children's Hospital Children's Emergency", "NUH Children's Emergency"]);
    expect(w.text()).toContain("Children's emergency");
    expect(w.findAll("a").filter((a) => a.text().startsWith("Source")).length).toBe(2);
    expect(w.findAll("a").filter((a) => a.text().startsWith("Call")).length).toBe(0);
  });
  it("switches to clinics through the query and the tabs", async () => {
    const { w, router } = await mountPage("clinics");
    expect(names(w)).toEqual(["Alpha Clinic", "Beta Clinic"]);
    expect(w.text()).toContain("CHAS clinic");
    expect(w.text()).toContain("CHAS subsidies depend on your card");
    expect(w.text()).toContain("Source: data.gov.sg");
    expect(w.text()).toContain("Singapore Open Data Licence");
    expect(w.text()).toContain("Retrieved 11 October 2026");
    const tabs = w.findAll(".kc__tabs a");
    await tabs[0].trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query.view).toBe("emergency");
    expect(names(w)).toHaveLength(2);
    expect(w.get(".kc__tabs a[aria-current='page']").text()).toBe("Emergency");
  });
  it("filters clinics by search and shows dental only when asked", async () => {
    const { w } = await mountPage("clinics");
    await w.get("#kc-search").setValue("beta");
    expect(names(w)).toEqual(["Beta Clinic"]);
    await w.get("#kc-search").setValue("222222");
    expect(names(w)).toEqual(["Beta Clinic"]);
    await w.get("#kc-search").setValue("");
    await w.findAll("button").find((b) => b.text().startsWith("Filter")).trigger("click");
    await w.get("#kc-filters input").setValue(true);
    expect(names(w)).toContain("Bright Dental");
  });
  it("builds correct links and a tel link only when a phone is known", async () => {
    const { w } = await mountPage("clinics");
    const card = w.get("#kc-card-chas-C1");
    const hrefs = card.findAll("a").map((a) => a.attributes("href"));
    expect(hrefs.some((h) => h.startsWith("https://www.onemap.gov.sg/amm/amm.html?") && h.includes("zoomLevel=18"))).toBe(true);
    expect(card.findAll("a").some((a) => a.text().startsWith("Open in OneMap"))).toBe(true);
    expect(card.findAll("a").some((a) => a.text().startsWith("Directions"))).toBe(false);
    expect(hrefs).toContain("tel:+6561234567");
    expect(card.find("a[target='_blank'] .visually-hidden").text()).toContain("opens in a new tab");
    expect(w.get("#kc-card-chas-C2").findAll("a").some((a) => a.text().startsWith("Call"))).toBe(false);
  });
  it("updates the map iframe on Show on map", async () => {
    const { w } = await mountPage();
    const frame = w.get("iframe");
    expect(frame.attributes("src")).toBe("https://www.onemap.gov.sg/amm/amm.html?mapStyle=Default&zoomLevel=12&latLng=1.3521,103.8198");
    expect(frame.attributes("referrerpolicy")).toBe("no-referrer-when-downgrade");
    expect(frame.attributes("title")).toBeTruthy();
    expect(frame.attributes("loading")).toBe("lazy");
    await w.get("#kc-card-er-nuh").findAll("button").find((b) => b.text() === "Show on map").trigger("click");
    expect(w.get("iframe").attributes("src")).toContain("marker=latLng:");
    expect(w.get("iframe").attributes("title")).toBe("Map of NUH Children's Emergency");
  });
  it("saves places and lists them under Saved places", async () => {
    const { w } = await mountPage();
    await w.get("#kc-card-er-kkh").findAll("button").find((b) => b.text() === "Save").trigger("click");
    const tab = w.findAll("button").find((b) => b.text().startsWith("Saved places"));
    expect(tab.text()).toContain("(1)");
    expect(JSON.parse(localStorage.getItem("nurturetrack:saved-kids-care"))).toEqual(["er-kkh"]);
    await tab.trigger("click");
    expect(names(w)).toHaveLength(1);
  });
  it("makes no network request", async () => {
    await mountPage("clinics");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("shows 50 first and more on request", async () => {
    vi.resetModules();
    const many = Array.from({ length: 120 }, (_, i) => ({ id: `M${i}`, name: `Clinic ${String(i).padStart(3, "0")}`, address: "Road", postal: "000000", lat: 1.3, lng: 103.8, phone: "", type: "gp" }));
    vi.doMock("@/app/data/chasClinics.json", () => ({ default: { meta: { retrievedAt: "2026-10-11" }, clinics: many } }));
    const Page = (await import("@/app/pages/kids-care/index.vue")).default;
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/support/kids-care", component: Page }] });
    await router.push("/support/kids-care?view=clinics");
    const w = mount(Page, { global: { plugins: [router] } });
    await vi.waitFor(() => expect(w.findAll(".kc__name")).toHaveLength(50));
    await w.findAll("button").find((b) => b.text() === "Show more").trigger("click");
    expect(w.findAll(".kc__name")).toHaveLength(100);
    vi.doUnmock("@/app/data/chasClinics.json");
  });
});
