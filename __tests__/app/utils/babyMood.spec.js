import { describe, it, expect } from "vitest";
import { readBaby } from "@/app/utils/babyMood";

describe("readBaby", () => {
  const name = "Baby 1";

  it("is 'sleeping' for an ongoing sleep with no end", () => {
    const at = new Date(2026, 10, 4, 14, 0);
    const list = [{ type: "sleep", at: new Date(2026, 10, 4, 13, 0) }];
    const out = readBaby(list, name, at);
    expect(out.state).toBe("sleeping");
    expect(out.title).toBe("Baby 1 is sleeping");
    expect(out.detail).toContain("1:00 PM");
    expect(out.detail).toContain("1 h");
  });

  it("is not 'sleeping' once a sleep has an end time", () => {
    const at = new Date(2026, 10, 4, 14, 0);
    const list = [{ type: "sleep", at: new Date(2026, 10, 4, 12, 0), endedAt: new Date(2026, 10, 4, 13, 0) }];
    expect(readBaby(list, name, at).state).not.toBe("sleeping");
  });

  it("is not 'sleeping' once the open sleep has run 16h or more (treated as stale/forgotten)", () => {
    const at = new Date(2026, 10, 4, 14, 0);
    const list = [{ type: "sleep", at: new Date(2026, 10, 3, 22, 0) }]; // 16h ago
    expect(readBaby(list, name, at).state).not.toBe("sleeping");
  });

  it("is 'fed' within 40 minutes of the last feed", () => {
    const at = new Date(2026, 10, 4, 14, 0);
    const list = [{ type: "feed", at: new Date(2026, 10, 4, 13, 30) }];
    const out = readBaby(list, name, at);
    expect(out.state).toBe("fed");
    expect(out.title).toBe("Baby 1 has just been fed");
  });

  it("is 'hungry' once 3 hours have passed since the last feed", () => {
    const at = new Date(2026, 10, 4, 14, 0);
    const list = [{ type: "feed", at: new Date(2026, 10, 4, 11, 0) }];
    const out = readBaby(list, name, at);
    expect(out.state).toBe("hungry");
    expect(out.title).toBe("Baby 1 may be getting hungry");
  });

  it("is plain 'awake' between 40 minutes and 3 hours after a feed", () => {
    const at = new Date(2026, 10, 4, 14, 0);
    const list = [{ type: "feed", at: new Date(2026, 10, 4, 13, 0) }];
    const out = readBaby(list, name, at);
    expect(out.state).toBe("awake");
    expect(out.detail).toContain("Last fed");
  });

  it("is 'awake' with 'No feeds logged yet' when there is no feed at all", () => {
    const at = new Date(2026, 10, 4, 14, 0);
    const out = readBaby([], name, at);
    expect(out.state).toBe("awake");
    expect(out.detail).toBe("No feeds logged yet");
  });

  it("sleeping takes priority over a recent feed", () => {
    const at = new Date(2026, 10, 4, 14, 0);
    const list = [
      { type: "feed", at: new Date(2026, 10, 4, 13, 50) },
      { type: "sleep", at: new Date(2026, 10, 4, 13, 55) },
    ];
    expect(readBaby(list, name, at).state).toBe("sleeping");
  });

  it("includes today's tallies alongside the state", () => {
    const at = new Date(2026, 10, 4, 14, 0);
    const list = [
      { type: "feed", at: new Date(2026, 10, 4, 8, 0) },
      { type: "nappy", at: new Date(2026, 10, 4, 9, 0) },
    ];
    const out = readBaby(list, name, at);
    expect(out.feeds).toBe(1);
    expect(out.nappies).toBe(1);
    expect(out.sleep).toBe("0 m");
  });
});
