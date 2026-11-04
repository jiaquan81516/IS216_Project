import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { subscribeSupportList } from "@/api/supportContent";
import { SUPPORT_GUIDES, TRUSTED_RESOURCES, contactHref } from "@/app/data/support";
import { useSupportContent } from "@/app/composables/useSupportContent";

vi.mock("@/api/supportContent", () => ({ subscribeSupportList: vi.fn(() => vi.fn()) }));

function mountHost() {
  let api;
  const Host = defineComponent({
    setup() {
      api = useSupportContent();
      return () => h("div");
    },
  });
  const wrapper = mount(Host);
  return { wrapper, api: () => api };
}

beforeEach(() => {
  vi.clearAllMocks();
  subscribeSupportList.mockImplementation(() => vi.fn());
});

describe("useSupportContent", () => {
  it("falls back to the built-in guides and contacts before anything loads", () => {
    const { api } = mountHost();
    expect(api().guides.value).toBe(SUPPORT_GUIDES);
    expect(api().contacts.value).toEqual(TRUSTED_RESOURCES.map((c) => ({ ...c, tel: contactHref(c) })));
  });

  it("subscribes to both the guides and contacts lists on mount", () => {
    mountHost();
    expect(subscribeSupportList).toHaveBeenCalledWith("guides", expect.any(Function), expect.any(Function));
    expect(subscribeSupportList).toHaveBeenCalledWith("contacts", expect.any(Function), expect.any(Function));
  });

  it("uses the saved guides once they arrive, and reapplies contactHref to saved contacts", () => {
    const { api } = mountHost();
    const onGuides = subscribeSupportList.mock.calls.find((c) => c[0] === "guides")[1];
    const onContacts = subscribeSupportList.mock.calls.find((c) => c[0] === "contacts")[1];
    onGuides([{ slug: "custom", title: "Custom guide" }]);
    onContacts([{ id: "c1", name: "Custom contact", telLabel: "6123 4567" }]);
    expect(api().guides.value).toEqual([{ slug: "custom", title: "Custom guide" }]);
    expect(api().contacts.value).toEqual([{ id: "c1", name: "Custom contact", telLabel: "6123 4567", tel: "tel:61234567" }]);
  });

  it("falls back to the defaults again if the saved list errors out", () => {
    const { api } = mountHost();
    const onGuides = subscribeSupportList.mock.calls.find((c) => c[0] === "guides")[1];
    const onGuidesError = subscribeSupportList.mock.calls.find((c) => c[0] === "guides")[2];
    onGuides([{ slug: "custom", title: "Custom guide" }]);
    expect(api().guides.value).not.toBe(SUPPORT_GUIDES);
    onGuidesError();
    expect(api().guides.value).toBe(SUPPORT_GUIDES);
  });

  it("unsubscribes both listeners on unmount", () => {
    const stopGuides = vi.fn();
    const stopContacts = vi.fn();
    subscribeSupportList.mockImplementationOnce(() => stopGuides).mockImplementationOnce(() => stopContacts);
    const { wrapper } = mountHost();
    wrapper.unmount();
    expect(stopGuides).toHaveBeenCalled();
    expect(stopContacts).toHaveBeenCalled();
  });
});
