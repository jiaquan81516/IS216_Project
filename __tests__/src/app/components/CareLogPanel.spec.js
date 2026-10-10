import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import CareLogPanel from "@/app/components/CareLogPanel.vue";

const NOW = new Date(2026, 9, 9, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

function mountPanel(props = {}) {
  return mount(CareLogPanel, { props: { open: true, ...props } });
}
const chip = (wrapper, text) => wrapper.findAll('[role="radio"]').find((b) => b.text() === text);
const saveButton = (wrapper) => wrapper.get('button[type="submit"]');

describe("CareLogPanel", () => {
  it("preselects the type it was opened with and keeps the chips visible", () => {
    const wrapper = mountPanel({ initialType: "sleep" });
    expect(wrapper.get('[role="dialog"]').attributes("aria-modal")).toBe("true");
    expect(wrapper.get("h2").text()).toBe("Log care");
    expect(chip(wrapper, "Sleep").attributes("aria-checked")).toBe("true");
    expect(chip(wrapper, "Feeding").attributes("aria-checked")).toBe("false");
    expect(wrapper.findAll('input[type="time"]')).toHaveLength(2);
  });

  it("shows side and duration for breast, and amount for bottle", async () => {
    const wrapper = mountPanel({ initialType: "feed" });
    expect(wrapper.find('[aria-label="Side"]').exists()).toBe(false);
    await chip(wrapper, "Breast").trigger("click");
    expect(wrapper.find('[aria-label="Side"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Duration"]').exists()).toBe(true);
    await chip(wrapper, "Bottle").trigger("click");
    expect(wrapper.find('[aria-label="Side"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Amount"]').exists()).toBe(true);
    await chip(wrapper, "Other").trigger("click");
    expect(wrapper.find('input[aria-label="Millilitres"]').exists()).toBe(true);
  });

  it("rejects a future time", async () => {
    const wrapper = mountPanel({ initialType: "nappy" });
    await chip(wrapper, "Wet").trigger("click");
    expect(saveButton(wrapper).attributes("disabled")).toBeUndefined();
    await wrapper.findAll("button").find((b) => b.text() === "Change time").trigger("click");
    await wrapper.get('input[type="time"]').setValue("13:00");
    expect(wrapper.get('[role="alert"]').text()).toBe("Pick a time that has already passed.");
    expect(saveButton(wrapper).attributes("disabled")).toBeDefined();
    await wrapper.get('input[type="time"]').setValue("11:00");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(saveButton(wrapper).attributes("disabled")).toBeUndefined();
  });

  it("requires a name and a dose for medication", async () => {
    const wrapper = mountPanel({ initialType: "medication" });
    const [name, dose] = wrapper.findAll('input[type="text"]');
    expect(saveButton(wrapper).attributes("disabled")).toBeDefined();
    await name.setValue("Paracetamol");
    expect(saveButton(wrapper).attributes("disabled")).toBeDefined();
    await dose.setValue("2.5 ml");
    expect(saveButton(wrapper).attributes("disabled")).toBeUndefined();
  });

  it("emits a feed payload with details", async () => {
    const wrapper = mountPanel({ initialType: "feed" });
    await chip(wrapper, "Breast").trigger("click");
    await chip(wrapper, "Left").trigger("click");
    await chip(wrapper, "15 min").trigger("click");
    await wrapper.get("form").trigger("submit");
    const [payload] = wrapper.emitted("save")[0];
    expect(payload.type).toBe("feed");
    expect(payload.at.getTime()).toBe(NOW.getTime());
    expect(payload.endedAt).toBeNull();
    expect(payload.details).toEqual({ method: "breast", side: "left", minutes: 15 });
  });

  it("emits sleep times, ending now and starting an hour earlier by default", async () => {
    const wrapper = mountPanel({ initialType: "sleep" });
    await wrapper.get("form").trigger("submit");
    const [payload] = wrapper.emitted("save")[0];
    expect(payload.type).toBe("sleep");
    expect(payload.at.getTime()).toBe(new Date(2026, 9, 9, 11, 0).getTime());
    expect(payload.endedAt.getTime()).toBe(new Date(2026, 9, 9, 12, 0).getTime());
  });

  it("leaves endedAt empty when still sleeping and stores the optional note", async () => {
    const wrapper = mountPanel({ initialType: "sleep" });
    await wrapper.findAll("button").find((b) => b.text() === "Still sleeping").trigger("click");
    await wrapper.get("#clp-extra").setValue("  Down in the cot ");
    await wrapper.get("form").trigger("submit");
    const [payload] = wrapper.emitted("save")[0];
    expect(payload.endedAt).toBeNull();
    expect(payload.details).toEqual({ text: "Down in the cot" });
  });

  it("prefills when editing and hides the type chips", () => {
    const entry = {
      id: "e1",
      type: "feed",
      at: { toDate: () => new Date(2026, 9, 9, 9, 30) },
      endedAt: null,
      details: { method: "breast", side: "right", minutes: 12 },
    };
    const wrapper = mountPanel({ entry });
    expect(wrapper.get("h2").text()).toBe("Edit feeding");
    expect(wrapper.find('[aria-label="Type of care"]').exists()).toBe(false);
    expect(chip(wrapper, "Right").attributes("aria-checked")).toBe("true");
    expect(wrapper.get('input[aria-label="Minutes"]').element.value).toBe("12");
    expect(wrapper.get('input[type="time"]').element.value).toBe("09:30");
    expect(saveButton(wrapper).text()).toBe("Save changes");
  });

  it("shows the saving state and an error", async () => {
    const wrapper = mountPanel({ initialType: "nappy", saving: true, error: "Could not save. Check your connection and try again." });
    expect(saveButton(wrapper).text()).toBe("Saving...");
    expect(saveButton(wrapper).attributes("disabled")).toBeDefined();
    expect(wrapper.get('[role="alert"]').text()).toContain("Could not save");
  });

  it("closes on Escape", async () => {
    const wrapper = mountPanel();
    await wrapper.get('[role="dialog"]').trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
