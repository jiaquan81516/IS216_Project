import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import PartnerToast from "@/app/components/PartnerToast.vue";
import ChatDock from "@/app/components/ChatDock.vue";

vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const photo = `data:image/jpeg;base64,${"A".repeat(40)}`;
const messageToast = { id: "m1", kind: "message", title: "Alex", text: "On my way" };
const reminderToast = { id: "r1", kind: "tasks", title: "Checklist", text: "2 left today" };

describe("PartnerToast", () => {
  it("shows the partner's photo on a message from them", () => {
    const wrapper = mount(PartnerToast, { props: { toasts: [messageToast], partnerName: "Alex", partnerPhoto: photo } });
    expect(wrapper.find("img.app-avatar__img").attributes("src")).toBe(photo);
  });

  it("falls back to their initial when they have no photo", () => {
    const wrapper = mount(PartnerToast, { props: { toasts: [messageToast], partnerName: "Alex", partnerPhoto: "" } });
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.find(".app-avatar").text()).toBe("A");
  });

  it("shows no face on an app reminder", () => {
    const wrapper = mount(PartnerToast, { props: { toasts: [reminderToast], partnerName: "Alex", partnerPhoto: photo } });
    expect(wrapper.find(".app-avatar").exists()).toBe(false);
  });

  it("also shows it on partner care notes", () => {
    const toast = { id: "p1", kind: "partner-feeling", title: "Alex", text: "Rough night" };
    const wrapper = mount(PartnerToast, { props: { toasts: [toast], partnerName: "Alex", partnerPhoto: photo } });
    expect(wrapper.find("img.app-avatar__img").exists()).toBe(true);
  });
});

function chat(partnerPhoto) {
  return {
    partnerFirst: ref("Alex"),
    partnerPhoto: ref(partnerPhoto),
    open: ref(true),
    nudges: ref([]),
    suggestions: ref([]),
    messages: ref([]),
    unread: ref(0),
    writeError: ref(""),
    openChat: vi.fn(),
    closeChat: vi.fn(),
    send: vi.fn(),
  };
}

describe("ChatDock header", () => {
  it("shows the partner's photo beside their name", () => {
    const wrapper = mount(ChatDock, { props: { chat: chat(photo), me: "me" }, global: { stubs: { Transition: false } } });
    expect(wrapper.find(".cd__head img.app-avatar__img").attributes("src")).toBe(photo);
    expect(wrapper.find(".cd__title").text()).toBe("Alex");
  });

  it("shows their initial when there is no photo", () => {
    const wrapper = mount(ChatDock, { props: { chat: chat(""), me: "me" } });
    expect(wrapper.find(".cd__head img").exists()).toBe(false);
    expect(wrapper.find(".cd__head .app-avatar").text()).toBe("A");
  });
});
