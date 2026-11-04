import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import { subscribeHouseholdMembers } from "@/api/profile";
import { useCaregiverJoins } from "@/app/composables/useCaregiverJoins";

vi.mock("@/api/profile", () => ({ subscribeHouseholdMembers: vi.fn(() => vi.fn()) }));

function storeKey(uid, hid) {
  return `nt.app.caregivers-known:${uid}:${hid}`;
}

function mountHost(householdId, myUid, onJoin = vi.fn()) {
  let api;
  const Host = defineComponent({
    setup() {
      api = useCaregiverJoins(householdId, myUid, onJoin);
      return () => h("div");
    },
  });
  return { wrapper: mount(Host), api: () => api, onJoin };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  subscribeHouseholdMembers.mockImplementation(() => vi.fn());
});

describe("useCaregiverJoins", () => {
  it("does nothing with no household id or uid", () => {
    const householdId = ref("");
    const myUid = ref("me1");
    mountHost(householdId, myUid);
    expect(subscribeHouseholdMembers).not.toHaveBeenCalled();
  });

  it("treats everyone already in the household as known on a first-ever visit", () => {
    const householdId = ref("house1");
    const myUid = ref("me1");
    const { api, onJoin } = mountHost(householdId, myUid);
    const onData = subscribeHouseholdMembers.mock.calls[0][1];
    onData([{ uid: "c1", accessLevel: "caregiver", role: "grandparent", displayName: "Nana" }]);
    expect(onJoin).not.toHaveBeenCalled();
    expect(api().unseen.value).toEqual([]);
    expect(JSON.parse(localStorage.getItem(storeKey("me1", "house1")))).toEqual(["c1"]);
  });

  it("announces a caregiver who joins after the first known snapshot", () => {
    const householdId = ref("house1");
    const myUid = ref("me1");
    const { onJoin } = mountHost(householdId, myUid);
    const onData = subscribeHouseholdMembers.mock.calls[0][1];
    onData([]); // nobody yet, becomes known baseline
    onData([{ uid: "c1", accessLevel: "caregiver", role: "babysitter", displayName: "Mei" }]);
    expect(onJoin).toHaveBeenCalledWith({ uid: "c1", name: "Mei", role: "Babysitter" });
  });

  it("does not re-announce a caregiver already known from a previous visit", () => {
    localStorage.setItem(storeKey("me1", "house1"), JSON.stringify(["c1"]));
    const householdId = ref("house1");
    const myUid = ref("me1");
    const { onJoin } = mountHost(householdId, myUid);
    const onData = subscribeHouseholdMembers.mock.calls[0][1];
    onData([{ uid: "c1", accessLevel: "caregiver", role: "babysitter", displayName: "Mei" }]);
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("ignores non-caregiver members entirely", () => {
    const householdId = ref("house1");
    const myUid = ref("me1");
    const { api } = mountHost(householdId, myUid);
    const onData = subscribeHouseholdMembers.mock.calls[0][1];
    onData([{ uid: "p1", accessLevel: "parent", displayName: "Partner" }]);
    expect(api().unseen.value).toEqual([]);
  });

  it("falls back to 'A caregiver' and 'Caregiver' for missing name/role", () => {
    const householdId = ref("house1");
    const myUid = ref("me1");
    const { onJoin } = mountHost(householdId, myUid);
    const onData = subscribeHouseholdMembers.mock.calls[0][1];
    onData([]);
    onData([{ uid: "c1", accessLevel: "caregiver", role: "bogus-role", displayName: "   " }]);
    expect(onJoin).toHaveBeenCalledWith({ uid: "c1", name: "A caregiver", role: "Caregiver" });
  });

  it("unseen lists caregivers not yet marked known, and markSeen clears it", () => {
    const householdId = ref("house1");
    const myUid = ref("me1");
    const { api } = mountHost(householdId, myUid);
    const onData = subscribeHouseholdMembers.mock.calls[0][1];
    onData([]);
    onData([{ uid: "c1", accessLevel: "caregiver", role: "babysitter", displayName: "Mei" }]);
    expect(api().unseen.value).toEqual([{ uid: "c1", name: "Mei", role: "Babysitter" }]);
    api().markSeen();
    expect(api().unseen.value).toEqual([]);
    expect(JSON.parse(localStorage.getItem(storeKey("me1", "house1")))).toEqual(["c1"]);
  });

  it("re-subscribes when the household id changes, and resets known/members", async () => {
    const householdId = ref("house1");
    const myUid = ref("me1");
    const { api } = mountHost(householdId, myUid);
    subscribeHouseholdMembers.mock.calls[0][1]([{ uid: "c1", accessLevel: "caregiver", displayName: "Mei" }]);
    householdId.value = "house2";
    await vi.waitFor(() => expect(subscribeHouseholdMembers).toHaveBeenCalledTimes(2));
    expect(subscribeHouseholdMembers).toHaveBeenNthCalledWith(2, "house2", expect.any(Function), expect.any(Function));
    expect(api().unseen.value).toEqual([]);
  });

  it("unsubscribes on unmount", () => {
    const stop = vi.fn();
    subscribeHouseholdMembers.mockImplementationOnce(() => stop);
    const householdId = ref("house1");
    const myUid = ref("me1");
    const { wrapper } = mountHost(householdId, myUid);
    wrapper.unmount();
    expect(stop).toHaveBeenCalled();
  });
});
