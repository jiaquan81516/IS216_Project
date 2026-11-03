import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import RoomFeedbackManager from "@/app/components/RoomFeedbackManager.vue";
const mocks = vi.hoisted(() => ({ save: vi.fn(), subscribe: vi.fn(), stop: vi.fn() }));
vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: ref({ uid: "admin" }) }) }));
vi.mock("@/api/roomFeedbackAdmin", () => ({ editRoomFeedback: mocks.save, subscribeAdminRoomFeedback: mocks.subscribe }));
const rooms = [{ id: "room", name: "Mall nursing room", feedback: "Original room note" }];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.subscribe.mockImplementation((_id, receive) => {
    receive([{ id: "comment", roomId: "room", text: "Parent comment", by: "parent" }]);
    return mocks.stop;
  });
});
describe("feedback management", () => {
  it("shows room names and legacy feedback, saves edits and cleans up its listener", async () => {
    const wrapper = mount(RoomFeedbackManager, { props: { rooms } });
    expect(wrapper.text()).toContain("Mall nursing room");
    expect(wrapper.text()).toContain("Original room note");
    await wrapper.findAll("button")[0].trigger("click");
    await wrapper.get("textarea").setValue("Corrected comment");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith("admin", "room", "comment", "Corrected comment");
    expect(wrapper.text()).toContain("Corrected comment");
    expect(wrapper.text()).toContain("Edited by an administrator");
    wrapper.unmount();
    expect(mocks.stop).toHaveBeenCalledOnce();
  });
  it("keeps the draft when saving fails and lets the admin cancel", async () => {
    mocks.save.mockRejectedValueOnce(new Error("permission-denied"));
    const wrapper = mount(RoomFeedbackManager, { props: { rooms, roomId: "room" } });
    await wrapper.findAll("button")[0].trigger("click");
    await wrapper.get("textarea").setValue("Draft");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("Could not save");
    expect(wrapper.get("textarea").element.value).toBe("Draft");
    await wrapper.findAll("form button")[1].trigger("click");
    expect(wrapper.text()).toContain("Parent comment");
    expect(wrapper.find("textarea").exists()).toBe(false);
    wrapper.unmount();
  });
});
