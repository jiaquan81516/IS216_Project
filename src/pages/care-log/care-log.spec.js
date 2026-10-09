import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import CareLog from "./index.vue";
import { TABS, entries, filterEntries, groupByDay } from "@/data/careLog";

function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:rest(.*)*", component: { template: "<div />" } }],
  });
  return mount(CareLog, { global: { plugins: [router] } });
}

describe("care log filtering", () => {
  it("keeps every entry on the All tab", () => {
    expect(filterEntries(entries, "all")).toHaveLength(entries.length);
  });

  it("returns only entries of the chosen type for each tab", () => {
    for (const { value } of TABS.filter((t) => t.value !== "all")) {
      const list = filterEntries(entries, value);
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((e) => e.type === value)).toBe(true);
    }
  });

  it("groups filtered entries by day, newest day first", () => {
    const dates = groupByDay(filterEntries(entries, "feed")).map((g) => g.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("shows only matching rows when a tab is clicked", async () => {
    const wrapper = mountPage();
    const tab = (label) => wrapper.findAll('[role="tab"]').find((t) => t.text() === label);

    await tab("Sleep").trigger("click");
    const rows = wrapper.findAll('[data-test="entry"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.attributes("data-type") === "sleep")).toBe(true);

    await tab("All").trigger("click");
    const types = new Set(wrapper.findAll('[data-test="entry"]').map((r) => r.attributes("data-type")));
    expect(types.size).toBeGreaterThan(1);
  });
});
