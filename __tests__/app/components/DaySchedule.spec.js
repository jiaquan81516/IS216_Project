import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import DaySchedule from "@/app/components/DaySchedule.vue";

const rota = {
  schedule: [],
  pattern: "manual",
  startDate: "2026-11-02",
  handoverTime: "02:00",
  manualNights: {},
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("DaySchedule", () => {
  it("opens a new shift when mobile users tap empty schedule space", async () => {
    const wrapper = mount(DaySchedule, {
      attachTo: document.body,
      props: { rota },
    });
    const column = wrapper.find(".ds__col");
    column.element.getBoundingClientRect = () => ({
      top: 100,
      bottom: 412,
      left: 0,
      right: 100,
      width: 100,
      height: 312,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    column.element.dispatchEvent(new MouseEvent("click", { bubbles: true, clientY: 152 }));
    await wrapper.vm.$nextTick();

    expect(document.body.querySelector(".dss__title")?.textContent).toContain("New shift");
    expect(document.body.querySelector(".dss__title")?.textContent).toContain("Mon");
    wrapper.unmount();
  });

  it("keeps keyboard focus inside the shift editor", async () => {
    const wrapper = mount(DaySchedule, {
      attachTo: document.body,
      props: { rota },
    });
    await wrapper.find(".ds__add").trigger("click");
    await wrapper.vm.$nextTick();

    const sheet = document.body.querySelector(".dss__sheet");
    const controls = [...sheet.querySelectorAll("button:not([disabled])")];
    controls.forEach((control) => Object.defineProperty(control, "offsetParent", { configurable: true, value: document.body }));

    sheet.focus();
    sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(controls.at(-1));

    controls.at(-1).dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(controls[0]);
    wrapper.unmount();
  });
});
