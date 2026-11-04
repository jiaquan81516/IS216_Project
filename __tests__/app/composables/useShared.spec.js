import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useCalendarStore } from "@/app/stores/calendar";
import { useCheckinsStore } from "@/app/stores/checkins";
import { useChatStore } from "@/app/stores/chat";
import { usePostsStore } from "@/app/stores/posts";
import { useRotaStore } from "@/app/stores/rota";
import { useTasksStore } from "@/app/stores/tasks";
import { useTeamStore } from "@/app/stores/team";
import { useShared } from "@/app/composables/useShared";

vi.mock("@/app/stores/calendar", () => ({ useCalendarStore: vi.fn() }));
vi.mock("@/app/stores/checkins", () => ({ useCheckinsStore: vi.fn() }));
vi.mock("@/app/stores/chat", () => ({ useChatStore: vi.fn() }));
vi.mock("@/app/stores/posts", () => ({ usePostsStore: vi.fn() }));
vi.mock("@/app/stores/rota", () => ({ useRotaStore: vi.fn() }));
vi.mock("@/app/stores/tasks", () => ({ useTasksStore: vi.fn() }));
vi.mock("@/app/stores/team", () => ({ useTeamStore: vi.fn() }));

function makeStore(name) {
  return { name, bind: vi.fn(), unbind: vi.fn(), setPartnerUid: vi.fn() };
}

let stores;
beforeEach(() => {
  setActivePinia(createPinia());
  stores = {
    rota: makeStore("rota"), calendar: makeStore("calendar"), tasks: makeStore("tasks"),
    posts: makeStore("posts"), team: makeStore("team"), chat: makeStore("chat"), checkins: makeStore("checkins"),
  };
  useRotaStore.mockReturnValue(stores.rota);
  useCalendarStore.mockReturnValue(stores.calendar);
  useTasksStore.mockReturnValue(stores.tasks);
  usePostsStore.mockReturnValue(stores.posts);
  useTeamStore.mockReturnValue(stores.team);
  useChatStore.mockReturnValue(stores.chat);
  useCheckinsStore.mockReturnValue(stores.checkins);
});

function mountHost(householdId, meUid, partnerUid) {
  let api;
  const Host = defineComponent({
    setup() {
      api = useShared(householdId, meUid, partnerUid);
      return () => h("div");
    },
  });
  return { wrapper: mount(Host), api: () => api };
}

describe("useShared", () => {
  it("does not bind any store while the household id is empty", () => {
    mountHost(ref(""), ref("me1"), ref(""));
    for (const s of Object.values(stores)) expect(s.bind).not.toHaveBeenCalled();
  });

  it("binds every shared store once the household id is available", () => {
    mountHost(ref("house1"), ref("me1"), ref("partner1"));
    for (const s of Object.values(stores)) expect(s.bind).toHaveBeenCalledWith("house1", "me1", "partner1");
  });

  it("unbinds every store before rebinding when householdId changes", async () => {
    const householdId = ref("house1");
    mountHost(householdId, ref("me1"), ref("partner1"));
    householdId.value = "house2";
    await vi.waitFor(() => expect(stores.rota.bind).toHaveBeenCalledTimes(2));
    expect(stores.rota.unbind).toHaveBeenCalled();
    expect(stores.rota.bind).toHaveBeenNthCalledWith(2, "house2", "me1", "partner1");
  });

  it("re-binds when meUid changes even if householdId stays the same", async () => {
    const meUid = ref("me1");
    mountHost(ref("house1"), meUid, ref("partner1"));
    meUid.value = "me2";
    await vi.waitFor(() => expect(stores.rota.bind).toHaveBeenCalledTimes(2));
  });

  it("only calls setPartnerUid (not a full rebind) when just the partner uid changes", async () => {
    const partnerUid = ref("");
    mountHost(ref("house1"), ref("me1"), partnerUid);
    expect(stores.rota.bind).toHaveBeenCalledTimes(1);
    partnerUid.value = "partner2";
    await vi.waitFor(() => expect(stores.rota.setPartnerUid).toHaveBeenCalledWith("partner2"));
    expect(stores.rota.bind).toHaveBeenCalledTimes(1);
  });

  it("stops (unbinds) every store on scope dispose", () => {
    const { wrapper } = mountHost(ref("house1"), ref("me1"), ref("partner1"));
    wrapper.unmount();
    for (const s of Object.values(stores)) expect(s.unbind).toHaveBeenCalled();
  });

  it("retry() re-runs start() from scratch", () => {
    const { api } = mountHost(ref("house1"), ref("me1"), ref("partner1"));
    api().retry();
    expect(stores.rota.bind).toHaveBeenCalledTimes(2);
  });

  it("exposes each store by name", () => {
    const { api } = mountHost(ref("house1"), ref("me1"), ref("partner1"));
    expect(api().rota).toBe(stores.rota);
    expect(api().checkins).toBe(stores.checkins);
  });
});
