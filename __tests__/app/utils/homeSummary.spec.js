import { describe, it, expect } from "vitest";
import { buildRotaView, tonightDate, todaySummary, agoText } from "@/app/utils/homeSummary";

describe("buildRotaView", () => {
  it("defaults pattern to 'alternate' when hasPartner is true (or omitted) and nothing is saved", () => {
    expect(buildRotaView({ uid: "me1" }).pattern).toBe("alternate");
    expect(buildRotaView({ uid: "me1", hasPartner: true }).pattern).toBe("alternate");
  });

  it("defaults pattern to 'manual' when hasPartner is false and nothing is saved", () => {
    expect(buildRotaView({ uid: "me1", hasPartner: false }).pattern).toBe("manual");
  });

  it("keeps an explicitly stored pattern regardless of hasPartner", () => {
    expect(buildRotaView({ rotaSettings: { pattern: "split" }, hasPartner: false }).pattern).toBe("split");
    expect(buildRotaView({ rotaSettings: { pattern: "manual" }, hasPartner: true }).pattern).toBe("manual");
  });

  it("falls back to 'alternate' for an invalid stored pattern string when partnered", () => {
    expect(buildRotaView({ rotaSettings: { pattern: "bogus" }, hasPartner: true }).pattern).toBe("alternate");
  });

  it("maps night overrides from uids to 'me'/'partner' via the given uid", () => {
    const view = buildRotaView({
      uid: "me1",
      nights: { "2026-11-04": { onCall: "me1" }, "2026-11-05": { onCall: "partner1" } },
    });
    expect(view.overrides["2026-11-04"]).toBe("me");
    expect(view.overrides["2026-11-05"]).toBe("partner");
  });

  it("defaults firstOnDuty to 'me' when nothing is stored", () => {
    expect(buildRotaView({ uid: "me1", rotaSettings: {} }).firstOnDuty).toBe("me");
  });

  it("resolves firstOnDuty to 'partner' when the stored uid is not me", () => {
    expect(buildRotaView({ uid: "me1", rotaSettings: { firstOnDuty: "partner1" } }).firstOnDuty).toBe("partner");
  });

  it("resolves firstOnDuty to 'me' when the stored uid is mine", () => {
    expect(buildRotaView({ uid: "me1", rotaSettings: { firstOnDuty: "me1" } }).firstOnDuty).toBe("me");
  });

  it("defaults startDate to the Monday of 'now' when missing/invalid", () => {
    const now = new Date(2026, 10, 4); // Wednesday
    const view = buildRotaView({ now, rotaSettings: {} });
    expect(view.startDate).toBe("2026-11-02");
  });

  it("defaults handoverTime to 07:00 when missing/invalid", () => {
    expect(buildRotaView({ rotaSettings: {} }).handoverTime).toBe("07:00");
    expect(buildRotaView({ rotaSettings: { handoverTime: "7am" } }).handoverTime).toBe("07:00");
  });

  it("defaults carerNights to [] when not an array", () => {
    expect(buildRotaView({ rotaSettings: {} }).carerNights).toEqual([]);
  });

  it("maps swap 'from' uids to 'me'/'partner' too", () => {
    const view = buildRotaView({ uid: "me1", swaps: [{ from: "me1", date: "x" }] });
    expect(view.swaps[0].from).toBe("me");
  });
});

describe("tonightDate", () => {
  it("returns today's ISO date once past the handover time", () => {
    const now = new Date(2026, 10, 4, 8, 0);
    expect(tonightDate(now, "07:00")).toBe("2026-11-04");
  });

  it("returns yesterday's ISO date before the handover time", () => {
    const now = new Date(2026, 10, 4, 6, 0);
    expect(tonightDate(now, "07:00")).toBe("2026-11-03");
  });

  it("defaults the handover time to 07:00 when malformed", () => {
    const now = new Date(2026, 10, 4, 6, 30);
    expect(tonightDate(now, "bogus")).toBe("2026-11-03");
  });
});

describe("todaySummary", () => {
  it("wraps todayStats and adds the most recent feed's Date (or null)", () => {
    const now = new Date(2026, 10, 4, 12, 0);
    const entries = [{ type: "feed", at: new Date(2026, 10, 4, 8, 0) }];
    const out = todaySummary({ entries, now });
    expect(out.feeds).toBe(1);
    expect(out.lastFeedAt).toBeInstanceOf(Date);
  });

  it("lastFeedAt is null when there is no feed", () => {
    expect(todaySummary({ entries: [], now: new Date() }).lastFeedAt).toBeNull();
  });
});

describe("agoText", () => {
  const now = new Date(2026, 10, 4, 12, 0, 0);

  it("says 'just now' under a minute", () => {
    expect(agoText(new Date(now.getTime() - 30 * 1000), now)).toBe("just now");
  });

  it("says '<n> min ago' under an hour", () => {
    expect(agoText(new Date(now.getTime() - 5 * 60000), now)).toBe("5 min ago");
  });

  it("says '<n> h ago' under a day", () => {
    expect(agoText(new Date(now.getTime() - 3 * 3600000), now)).toBe("3 h ago");
  });

  it("says 'yesterday' for exactly one day back", () => {
    expect(agoText(new Date(now.getTime() - 24 * 3600000), now)).toBe("yesterday");
  });

  it("says '<n> d ago' beyond a day", () => {
    expect(agoText(new Date(now.getTime() - 3 * 86400000), now)).toBe("3 d ago");
  });

  it("returns '' for an unusable value", () => {
    expect(agoText(null, now)).toBe("");
  });
});
