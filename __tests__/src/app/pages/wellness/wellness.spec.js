import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { createPinia, setActivePinia } from "pinia";
import { CHECKINS_KEY, dateKey, useCheckinsStore } from "@/app/stores/checkins";
import { ROUTES } from "@/app/routes";
import WellnessPage from "@/app/pages/wellness/index.vue";

async function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  const wrapper = mount(WellnessPage, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return { wrapper, store: useCheckinsStore() };
}
const chip = (wrapper, group, label) =>
  wrapper.get(`[role="radiogroup"][aria-label="${group}"]`).findAll("button").find((b) => b.text() === label);
const saveButton = (wrapper) => wrapper.findAll("button").find((b) => b.text() === "Save privately");

beforeEach(() => localStorage.clear());

describe("App wellness page", () => {
  it("shows the heading, question and chips, with no private info box", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.get("h1").text()).toBe("Wellness, privately");
    expect(wrapper.text()).toContain("A short reflection for you. Not a diagnosis and not shared by default.");
    expect(wrapper.text()).toContain("How are you feeling today?");
    expect(wrapper.text()).not.toContain("Your check-ins are private");
    const mood = wrapper.get('[role="radiogroup"][aria-label="Mood"]').findAll("button").map((b) => b.text());
    expect(mood).toEqual(["Very low", "Low", "Okay", "Good", "Great"]);
    const stress = wrapper.get('[role="radiogroup"][aria-label="Stress"]').findAll("button").map((b) => b.text());
    expect(stress).toEqual(["Very high", "High", "Some", "Low", "None"]);
    expect(wrapper.findAll("button.btn-primary")).toHaveLength(1);
    expect(wrapper.get('a[href="' + ROUTES.HOME + '"]').text()).toBe("Not now");
    expect(wrapper.get('a[href="' + ROUTES.SUPPORT + '"]').text()).toBe("Explore resources");
    expect(wrapper.text()).toContain("Your last check-ins will appear here.");
    expect(wrapper.text()).toContain("Private");
  });

  it("asks for both answers before saving", async () => {
    const { wrapper, store } = await mountPage();
    await chip(wrapper, "Mood", "Good").trigger("click");
    await saveButton(wrapper).trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toContain("Choose a mood and a stress level");
    expect(Object.keys(store.items)).toHaveLength(0);
  });

  it("saves a check-in locally and confirms it", async () => {
    const { wrapper, store } = await mountPage();
    await chip(wrapper, "Mood", "Good").trigger("click");
    await chip(wrapper, "Stress", "Some").trigger("click");
    await saveButton(wrapper).trigger("click");
    const today = dateKey(new Date());
    expect(store.items[today]).toMatchObject({ date: today, mood: 4, stress: 3 });
    expect(store.items[today].savedAt).toBeTruthy();
    expect(wrapper.get('[role="status"]').text()).toBe("Saved. Only you can see this.");
    expect(JSON.parse(localStorage.getItem(CHECKINS_KEY))[today].mood).toBe(4);
    expect(wrapper.text()).not.toContain("hard stretch");
    expect(wrapper.text()).not.toContain("Your last check-ins will appear here.");
    expect(wrapper.findAll('[role="img"]').some((b) => b.attributes("aria-label").includes("mood 4 of 5"))).toBe(true);
  });

  it("replaces the check-in when saved again the same day", async () => {
    const { wrapper, store } = await mountPage();
    await chip(wrapper, "Mood", "Good").trigger("click");
    await chip(wrapper, "Stress", "Some").trigger("click");
    await saveButton(wrapper).trigger("click");
    await chip(wrapper, "Mood", "Great").trigger("click");
    await saveButton(wrapper).trigger("click");
    expect(Object.keys(store.items)).toHaveLength(1);
    expect(store.items[dateKey(new Date())].mood).toBe(5);
  });

  it("shows a gentle note with a support link after a very low mood", async () => {
    const { wrapper } = await mountPage();
    await chip(wrapper, "Mood", "Very low").trigger("click");
    await chip(wrapper, "Stress", "Low").trigger("click");
    await saveButton(wrapper).trigger("click");
    expect(wrapper.text()).toContain("It sounds like a hard stretch. Support options are one tap away.");
    expect(wrapper.findAll(`a[href="${ROUTES.SUPPORT}"]`).length).toBeGreaterThanOrEqual(2);
  });

  it("shows the note for very high stress too", async () => {
    const { wrapper } = await mountPage();
    await chip(wrapper, "Mood", "Okay").trigger("click");
    await chip(wrapper, "Stress", "Very high").trigger("click");
    await saveButton(wrapper).trigger("click");
    expect(wrapper.text()).toContain("hard stretch");
  });

  it("restores today's answers and draws earlier days", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const key = dateKey(yesterday);
    localStorage.setItem(CHECKINS_KEY, JSON.stringify({ [key]: { date: key, mood: 2, stress: 4, savedAt: "x" } }));
    const { wrapper } = await mountPage();
    expect(wrapper.text()).not.toContain("Your last check-ins will appear here.");
    expect(wrapper.findAll('[role="img"]')).toHaveLength(7);
    expect(wrapper.html()).toContain("mood 2 of 5, stress 4 of 5");
  });
});
