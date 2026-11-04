import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Avatar from "@/app/components/Avatar.vue";

const photo = `data:image/jpeg;base64,${"A".repeat(40)}`;

describe("Avatar", () => {
  it("shows initials when there is no photo", () => {
    const wrapper = mount(Avatar, { props: { name: "Jia Min Tan" } });
    expect(wrapper.text()).toBe("JT");
    expect(wrapper.find("img").exists()).toBe(false);
    expect(mount(Avatar, { props: { name: "mei" } }).text()).toBe("M");
    expect(mount(Avatar, { props: { name: "" } }).text()).toBe("?");
  });

  it("shows the photo instead of the initials", () => {
    const wrapper = mount(Avatar, { props: { name: "Jia Min", src: photo } });
    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe(photo);
    expect(img.attributes("alt")).toBe("");
    expect(wrapper.text()).toBe("");
    expect(wrapper.attributes("aria-hidden")).toBe("true");
  });

  it("shows a Google account photo from https", () => {
    const url = "https://lh3.googleusercontent.com/a/photo=s96-c";
    expect(mount(Avatar, { props: { name: "Jia", src: url } }).find("img").attributes("src")).toBe(url);
  });

  it.each(["javascript:alert(1)", "data:image/svg+xml;base64,AAAA", "http://example.com/a.jpg", ""])(
    "ignores an unsafe photo %j and shows initials",
    (src) => {
      const wrapper = mount(Avatar, { props: { name: "Jia Min", src } });
      expect(wrapper.find("img").exists()).toBe(false);
      expect(wrapper.text()).toBe("JM");
    },
  );

  it("falls back to initials when the photo cannot load, and tries again for a new one", async () => {
    const wrapper = mount(Avatar, { props: { name: "Jia Min", src: photo } });
    await wrapper.find("img").trigger("error");
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.text()).toBe("JM");
    await wrapper.setProps({ src: `data:image/jpeg;base64,${"B".repeat(40)}` });
    expect(wrapper.find("img").exists()).toBe(true);
  });

  it("sizes the circle and scales the initials for larger avatars", () => {
    const small = mount(Avatar, { props: { name: "A", size: 28 } });
    expect(small.attributes("style")).toContain("width: 28px");
    expect(small.attributes("style")).toContain("font-size: 12px");
    expect(mount(Avatar, { props: { name: "A", size: 36 } }).attributes("style")).toContain("font-size: 14px");
    const large = mount(Avatar, { props: { name: "A", size: 88 } });
    expect(large.attributes("style")).toContain("width: 88px");
    expect(large.attributes("style")).toContain("font-size: 33px");
  });
});
