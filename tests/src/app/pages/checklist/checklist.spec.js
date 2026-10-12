import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { computed, reactive, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { HOME_KEY } from "@/app/composables/useHome";
import { SHARED_KEY } from "@/app/composables/useShared";

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("@/app/api/db", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));
vi.mock("@/composables/useAuth", async () => {
  const { ref: vueRef } = await import("vue");
  return { useAuth: () => ({ currentUser: vueRef({ uid: "u1" }), logout: vi.fn() }) };
});

import ChecklistPage from "@/app/pages/checklist/index.vue";

const ME = "u1";
const PARTNER = "u2";
const NOW = new Date("2026-10-13T10:00:00");

function task(id, extra = {}) {
  return { id, title: `Task ${id}`, owner: ME, due: null, done: false, queued: false, ...extra };
}

async function mountPage({ tasks = [], partner = true, error = null, writeError = "" } = {}) {
  const rtw = reactive({
    tasks,
    loading: false,
    error,
    writeError,
    addTask: vi.fn(async (data) => data),
    toggleTask: vi.fn(async () => true),
    updateTask: vi.fn(async () => ({})),
  });
  const home = {
    loading: ref(false),
    error: ref(""),
    reload: vi.fn(),
    me: computed(() => ({ uid: ME, firstName: "daniel", displayName: "daniel Tan" })),
    partner: computed(() => (partner ? { uid: PARTNER, displayName: "Mei Lin", firstName: "mei" } : null)),
    householdId: ref("h1"),
  };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  router.push("/checklist");
  await router.isReady();
  const wrapper = mount(ChecklistPage, {
    global: { plugins: [router], provide: { [HOME_KEY]: home, [SHARED_KEY]: { rtw } } },
  });
  await flushPromises();
  return { wrapper, rtw };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const rowOf = (wrapper, title) => wrapper.findAll(".ck__row").find((row) => row.text().includes(title));

describe("the App checklist page", () => {
  it("has the title and the line under it", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.get("h1").text()).toBe("Our checklist");
    expect(wrapper.text()).toContain("Who is doing what, in one place.");
  });

  it("groups open tasks, shows the due date and who has each one", async () => {
    const { wrapper } = await mountPage({
      tasks: [
        task("a", { title: "Call clinic", due: "2026-10-13" }),
        task("b", { title: "Buy formula", due: "2026-10-14", owner: PARTNER }),
        task("c", { title: "Book vaccination", due: "2026-10-16" }),
        task("d", { title: "Renew passport" }),
      ],
    });
    expect(wrapper.findAll(".ck__h2").map((h) => h.text())).toEqual(["Today", "This week", "No date"]);
    expect(rowOf(wrapper, "Call clinic").text()).toContain("Due today");
    expect(rowOf(wrapper, "Call clinic").text()).toContain("Daniel");
    expect(rowOf(wrapper, "Buy formula").text()).toContain("Due tomorrow");
    expect(rowOf(wrapper, "Buy formula").text()).toContain("Mei");
    expect(rowOf(wrapper, "Renew passport").find(".ck__due").exists()).toBe(false);
  });

  it("says so when the list is empty, and when a tab has nothing", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.text()).toContain("Nothing on the list yet. Add the first task above.");
    const withTask = await mountPage({ tasks: [task("a", { owner: PARTNER })] });
    await withTask.wrapper.findAll(".ck__tab")[1].trigger("click");
    expect(withTask.wrapper.text()).toContain("Nothing here.");
  });

  it("filters by tab and keeps shared tasks on both", async () => {
    const { wrapper } = await mountPage({
      tasks: [task("a", { title: "Mine" }), task("b", { title: "Theirs", owner: PARTNER }), task("c", { title: "Ours", owner: "both" })],
    });
    expect(wrapper.findAll(".ck__tab").map((t) => t.text())).toEqual(["Everyone", "Mine", "Mei's"]);
    expect(wrapper.findAll(".ck__row")).toHaveLength(3);
    await wrapper.findAll(".ck__tab")[1].trigger("click");
    expect(wrapper.findAll(".ck__name").map((n) => n.text())).toEqual(["Mine", "Ours"].sort());
    await wrapper.findAll(".ck__tab")[2].trigger("click");
    expect(wrapper.findAll(".ck__name").map((n) => n.text())).toEqual(["Ours", "Theirs"]);
    expect(wrapper.findAll(".ck__tab")[2].attributes("aria-pressed")).toBe("true");
  });

  it("has one solid button, and Add waits for a title", async () => {
    const { wrapper } = await mountPage();
    const solid = wrapper.findAll("button.btn-primary");
    expect(solid).toHaveLength(1);
    expect(solid[0].text()).toBe("Add");
    expect(solid[0].attributes("disabled")).toBeDefined();
    await wrapper.get("#ck-title").setValue("Book vaccination");
    expect(solid[0].attributes("disabled")).toBeUndefined();
  });

  it("adds a task for me by default, then clears the line", async () => {
    const { wrapper, rtw } = await mountPage();
    await wrapper.get("#ck-title").setValue("  Book vaccination ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(rtw.addTask).toHaveBeenCalledWith({ title: "Book vaccination", group: "home", owner: ME, due: null });
    expect(wrapper.get("#ck-title").element.value).toBe("");
  });

  it("adds a task for my partner or for both, with an optional date", async () => {
    const { wrapper, rtw } = await mountPage();
    const opts = wrapper.findAll(".ck__opt");
    expect(opts.map((o) => o.text())).toEqual(["Me", "Mei", "Both"]);
    await opts[1].trigger("click");
    await wrapper.get("#ck-title").setValue("Buy formula");
    await wrapper.findAll(".ck__add-opts .app-textbtn")[0].trigger("click");
    await wrapper.get("#ck-due").setValue("2026-10-14");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(rtw.addTask).toHaveBeenLastCalledWith({ title: "Buy formula", group: "home", owner: PARTNER, due: "2026-10-14" });

    await opts[2].trigger("click");
    await wrapper.get("#ck-title").setValue("Walk");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(rtw.addTask).toHaveBeenLastCalledWith({ title: "Walk", group: "home", owner: "both", due: null });
  });

  it("keeps what I typed when adding fails", async () => {
    const { wrapper, rtw } = await mountPage();
    rtw.addTask.mockResolvedValueOnce(null);
    await wrapper.get("#ck-title").setValue("Book vaccination");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get("#ck-title").element.value).toBe("Book vaccination");
  });

  it("ticks a task", async () => {
    const { wrapper, rtw } = await mountPage({ tasks: [task("a", { title: "Call clinic" })] });
    await rowOf(wrapper, "Call clinic").get("input").setValue(true);
    await flushPromises();
    expect(rtw.toggleTask).toHaveBeenCalledWith("a");
  });

  describe("passing tasks on", () => {
    it("offers Give to Mei on my own open tasks only", async () => {
      const { wrapper } = await mountPage({
        tasks: [task("a", { title: "Mine" }), task("b", { title: "Theirs", owner: PARTNER }), task("c", { title: "Ours", owner: "both" })],
      });
      expect(rowOf(wrapper, "Mine").text()).toContain("Give to Mei");
      expect(rowOf(wrapper, "Theirs").text()).not.toContain("Give to");
      expect(rowOf(wrapper, "Ours").text()).not.toContain("Give to");
    });

    it("queues a task for the next handover, and can take it back", async () => {
      const { wrapper, rtw } = await mountPage({ tasks: [task("a", { title: "Mine" })] });
      await rowOf(wrapper, "Mine").get(".ck__side .app-textbtn").trigger("click");
      await flushPromises();
      expect(rtw.updateTask).toHaveBeenCalledWith("a", { queued: true });

      rtw.tasks = [task("a", { title: "Mine", queued: true })];
      await flushPromises();
      expect(rowOf(wrapper, "Mine").text()).toContain("Queued for handover");
      await rowOf(wrapper, "Mine").get(".ck__queued .app-textbtn").trigger("click");
      await flushPromises();
      expect(rtw.updateTask).toHaveBeenLastCalledWith("a", { queued: false });
    });

    it("says how many are ready and links to the handover", async () => {
      const { wrapper } = await mountPage({
        tasks: [task("a", { queued: true }), task("b", { queued: true }), task("c")],
      });
      const bar = wrapper.get(".ck__queue");
      expect(bar.text()).toContain("2 tasks are ready to pass on.");
      expect(bar.get("a").attributes("href")).toBe("/handover");
      expect(bar.get("a").text()).toBe("Go to handover");
    });

    it("says it in the singular, and shows no bar when nothing is queued", async () => {
      const one = await mountPage({ tasks: [task("a", { queued: true })] });
      expect(one.wrapper.get(".ck__queue").text()).toContain("1 task is ready to pass on.");
      const none = await mountPage({ tasks: [task("a")] });
      expect(none.wrapper.find(".ck__queue").exists()).toBe(false);
    });

    it("links to Handover from the top while I have an open task", async () => {
      const { wrapper } = await mountPage({ tasks: [task("a")] });
      const link = wrapper.get(".ck__handover");
      expect(link.text()).toBe("Hand over to Mei");
      expect(link.attributes("href")).toBe("/handover");
      const none = await mountPage({ tasks: [task("a", { owner: PARTNER })] });
      expect(none.wrapper.find(".ck__handover").exists()).toBe(false);
    });
  });

  describe("done", () => {
    const finished = [
      task("d1", { title: "Pack bag", done: true, doneBy: ME, doneAt: new Date("2026-10-12T08:00:00") }),
      task("d2", { title: "Register birth", done: true, doneBy: PARTNER, doneAt: new Date("2026-10-13T08:00:00") }),
    ];

    it("keeps finished tasks folded until asked", async () => {
      const { wrapper } = await mountPage({ tasks: finished });
      expect(wrapper.text()).toContain("2 finished");
      expect(wrapper.find("#ck-done-list").exists()).toBe(false);
      const toggle = wrapper.get(".ck__done-head .app-textbtn");
      expect(toggle.attributes("aria-expanded")).toBe("false");
      await toggle.trigger("click");
      expect(toggle.attributes("aria-expanded")).toBe("true");
      const rows = wrapper.findAll("#ck-done-list .ck__row");
      expect(rows.map((r) => [r.get(".ck__name").text(), r.get(".ck__muted").text()])).toEqual([
        ["Register birth", "Mei, Today"],
        ["Pack bag", "Daniel, Yesterday"],
      ]);
    });

    it("lets me reopen a finished task", async () => {
      const { wrapper, rtw } = await mountPage({ tasks: finished });
      await wrapper.get(".ck__done-head .app-textbtn").trigger("click");
      await wrapper.get("#ck-done-list input").setValue(false);
      await flushPromises();
      expect(rtw.toggleTask).toHaveBeenCalledWith("d2");
    });
  });

  describe("when nobody has joined yet", () => {
    it("has no partner tab, no who choice and no Give link", async () => {
      const { wrapper, rtw } = await mountPage({ tasks: [task("a", { title: "Mine" })], partner: false });
      expect(wrapper.findAll(".ck__tab").map((t) => t.text())).toEqual(["Everyone", "Mine"]);
      expect(wrapper.find(".ck__who").exists()).toBe(false);
      expect(rowOf(wrapper, "Mine").text()).not.toContain("Give to");
      expect(wrapper.find(".ck__handover").exists()).toBe(false);
      await wrapper.get("#ck-title").setValue("Own task");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(rtw.addTask).toHaveBeenCalledWith({ title: "Own task", group: "home", owner: ME, due: null });
    });
  });

  describe("errors", () => {
    it("tells me to publish the rules when the database says no", async () => {
      const { wrapper } = await mountPage({ error: { code: "permission-denied" } });
      expect(wrapper.get('[role="alert"]').text()).toContain("Publish the latest firestore.rules");
    });

    it("shows a failed write without hiding the list", async () => {
      const { wrapper } = await mountPage({ tasks: [task("a")], writeError: "We could not save the task." });
      expect(wrapper.get(".ck__row-error").text()).toBe("We could not save the task.");
      expect(wrapper.findAll(".ck__row")).toHaveLength(1);
    });
  });
});
