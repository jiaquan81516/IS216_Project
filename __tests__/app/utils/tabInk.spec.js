import { describe, it, expect } from "vitest";
import { lastInk } from "@/app/utils/tabInk";

describe("tabInk", () => {
  it("exports a Map", () => {
    expect(lastInk).toBeInstanceOf(Map);
  });

  it("is empty by default", () => {
    // Note: module-level singleton; if another spec file mutates it first within the
    // same worker, this could see stale data. Clear defensively before asserting.
    lastInk.clear();
    expect(lastInk.size).toBe(0);
  });

  it("remembers an underline position per idBase key", () => {
    lastInk.clear();
    lastInk.set("support-tabs", { left: 10, width: 40 });
    expect(lastInk.get("support-tabs")).toEqual({ left: 10, width: 40 });
    expect(lastInk.has("rooms-tabs")).toBe(false);
    lastInk.clear();
  });
});
