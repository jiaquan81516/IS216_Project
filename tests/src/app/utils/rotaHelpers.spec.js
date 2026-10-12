import { describe, expect, it } from "vitest";
import {
  addDays,
  applySwap,
  cancelSwap,
  formatHandover,
  mondayOf,
  resolveSwap,
  restSummary,
  suggest,
  weekLabel,
  weekNights,
} from "@/app/utils/rotaHelpers";

// 2026-10-12 is a Monday.
const MON = "2026-10-12";
const base = (over = {}) => ({
  pattern: "alternate",
  firstOnDuty: "me",
  startDate: MON,
  overrides: {},
  swaps: [],
  ...over,
});
const whos = (nights) => nights.map((n) => n.who);
const night = (date, who, shared = false) => ({ date, who, shared });

describe("dates", () => {
  it("finds the Monday of a week", () => {
    expect(mondayOf("2026-10-18")).toBe(MON);
    expect(mondayOf("2026-10-12")).toBe(MON);
    expect(mondayOf(new Date(2026, 9, 14))).toBe(MON);
  });
  it("labels a week with to and never a dash", () => {
    expect(weekLabel(MON)).toBe("12 to 18 October");
    expect(weekLabel("2026-10-26")).toBe("26 October to 1 November");
  });
  it("formats the handover time", () => {
    expect(formatHandover("07:00")).toBe("7:00 AM");
    expect(formatHandover("13:30")).toBe("1:30 PM");
    expect(formatHandover("00:15")).toBe("12:15 AM");
  });
});

describe("weekNights", () => {
  it("alternates nights starting with the first person", () => {
    const nights = weekNights(base(), MON);
    expect(nights).toHaveLength(7);
    expect(whos(nights)).toEqual(["me", "partner", "me", "partner", "me", "partner", "me"]);
    expect(nights[0].resting).toBe("partner");
    expect(nights.every((n) => n.source === "pattern" && !n.shared)).toBe(true);
  });
  it("starts with the partner and keeps the rhythm in other weeks", () => {
    expect(whos(weekNights(base({ firstOnDuty: "partner" }), MON)).slice(0, 2)).toEqual(["partner", "me"]);
    // Seven nights later the parity flips.
    expect(whos(weekNights(base(), addDays(MON, 7))).slice(0, 2)).toEqual(["partner", "me"]);
    // Dates before the start date also alternate.
    expect(whos(weekNights(base(), addDays(MON, -7))).slice(0, 2)).toEqual(["partner", "me"]);
  });
  it("shares every night in split mode and alternates who goes first", () => {
    const nights = weekNights(base({ pattern: "split" }), MON);
    expect(nights.every((n) => n.shared)).toBe(true);
    expect(nights[0]).toMatchObject({ who: "me", second: "partner", resting: null });
    expect(nights[1]).toMatchObject({ who: "partner", second: "me" });
  });
  it("leaves manual nights open until overridden", () => {
    const nights = weekNights(base({ pattern: "manual", overrides: { [addDays(MON, 2)]: "partner" } }), MON);
    expect(nights[0].who).toBe("open");
    expect(nights[2]).toMatchObject({ who: "partner", source: "override", resting: "me" });
  });
  it("lets an override beat the pattern, including in split mode", () => {
    const nights = weekNights(base({ pattern: "split", overrides: { [MON]: "partner" } }), MON);
    expect(nights[0]).toMatchObject({ who: "partner", shared: false, source: "override" });
  });
  it("applies accepted swaps only", () => {
    const a = addDays(MON, 0);
    const b = addDays(MON, 1);
    const pending = { id: "1", date: a, withDate: b, from: "me", status: "pending" };
    expect(whos(weekNights(base({ swaps: [pending] }), MON)).slice(0, 2)).toEqual(["me", "partner"]);
    const accepted = { ...pending, status: "accepted" };
    const nights = weekNights(base({ swaps: [accepted] }), MON);
    expect(whos(nights).slice(0, 2)).toEqual(["partner", "me"]);
    expect(nights[0].source).toBe("swap");
    const declined = { ...pending, status: "declined" };
    expect(whos(weekNights(base({ swaps: [declined] }), MON)).slice(0, 2)).toEqual(["me", "partner"]);
  });
  it("gives a night away when there is nothing in return", () => {
    const swap = { id: "1", date: MON, withDate: null, from: "me", status: "accepted" };
    expect(whos(weekNights(base({ swaps: [swap] }), MON)).slice(0, 3)).toEqual(["partner", "partner", "me"]);
  });
});

describe("restSummary", () => {
  it("counts nights on duty, longest run and nights off", () => {
    const s = restSummary(weekNights(base(), MON));
    expect(s.me).toEqual({ onDuty: 4, longestRun: 1, off: 3 });
    expect(s.partner).toEqual({ onDuty: 3, longestRun: 1, off: 4 });
    expect(s.shared).toBe(0);
    expect(s.open).toBe(0);
  });
  it("finds a run of consecutive nights", () => {
    const nights = [night("a", "me"), night("b", "me"), night("c", "me"), night("d", "partner"), night("e", "me"), night("f", "partner"), night("g", "partner")];
    const s = restSummary(nights);
    expect(s.me.longestRun).toBe(3);
    expect(s.partner.longestRun).toBe(2);
  });
  it("leaves shared and open nights out of on duty counts", () => {
    const s = restSummary(weekNights(base({ pattern: "split" }), MON));
    expect(s.me.onDuty).toBe(0);
    expect(s.shared).toBe(7);
    expect(restSummary(weekNights(base({ pattern: "manual" }), MON)).open).toBe(7);
  });
});

describe("suggest", () => {
  const names = { me: "Daniel", partner: "Mei" };
  it("says the week is balanced for the alternate pattern", () => {
    expect(suggest(weekNights(base(), MON), names)).toEqual({ text: "This week is balanced.", action: null });
  });
  it("suggests moving a night when the difference is more than one", () => {
    const dates = Array.from({ length: 7 }, (_, i) => addDays(MON, i));
    const nights = ["me", "partner", "me", "me", "partner", "me", "me"].map((w, i) => night(dates[i], w));
    // me 5, partner 2
    const result = suggest(nights, names);
    expect(result.text).toMatch(/^Swap \w{3} \d+ October so Daniel has one more night off$/);
    expect(result.action.from).toBe("me");
    expect(result.action.withDate).toBeNull();
    expect(nights.find((n) => n.date === result.action.date).who).toBe("me");
  });
  it("prefers the night that also breaks a run", () => {
    const dates = Array.from({ length: 7 }, (_, i) => addDays(MON, i));
    const nights = ["me", "me", "me", "me", "partner", "me", "partner"].map((w, i) => night(dates[i], w));
    // me 5, partner 2; a middle night of the run of 4 is best
    const result = suggest(nights, names);
    expect([dates[1], dates[2]]).toContain(result.action.date);
  });
  it("suggests an exchange to break a run of three when counts are even", () => {
    const dates = Array.from({ length: 7 }, (_, i) => addDays(MON, i));
    const nights = ["me", "me", "me", "partner", "partner", "partner", "me"].map((w, i) => night(dates[i], w));
    // me 4, partner 3 (diff 1) but runs of three
    const result = suggest(nights, names);
    expect(result.text).toContain("3 nights in a row");
    expect(result.action.withDate).not.toBeNull();
    expect(result.action.from).toBe("me");
    expect([dates[3], dates[4], dates[5]]).toContain(result.action.withDate);
  });
  it("mentions open nights when nothing else is wrong", () => {
    expect(suggest(weekNights(base({ pattern: "manual" }), MON), names).text).toBe("Some nights are still open.");
  });
  it("falls back to default names", () => {
    const dates = Array.from({ length: 7 }, (_, i) => addDays(MON, i));
    const nights = ["partner", "partner", "partner", "partner", "me", "partner", "me"].map((w, i) => night(dates[i], w));
    expect(suggest(nights).text).toContain("Your partner");
  });
});

describe("swap list helpers", () => {
  it("applySwap adds an accepted swap and keeps the old list intact", () => {
    const before = [];
    const after = applySwap(before, { date: MON, withDate: addDays(MON, 1), from: "me" });
    expect(before).toHaveLength(0);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ status: "accepted", from: "me", withDate: addDays(MON, 1) });
    expect(whos(weekNights(base({ swaps: after }), MON)).slice(0, 2)).toEqual(["partner", "me"]);
  });
  it("accepts and declines only pending partner requests", () => {
    const swaps = [
      { id: "p", date: MON, withDate: null, from: "partner", status: "pending" },
      { id: "m", date: MON, withDate: null, from: "me", status: "pending" },
    ];
    expect(resolveSwap(swaps, "p", true)[0].status).toBe("accepted");
    expect(resolveSwap(swaps, "p", false)[0].status).toBe("declined");
    expect(resolveSwap(swaps, "m", true)[1].status).toBe("pending");
  });
  it("cancels only my pending requests", () => {
    const swaps = [
      { id: "p", from: "partner", status: "pending" },
      { id: "m", from: "me", status: "pending" },
    ];
    expect(cancelSwap(swaps, "m").map((s) => s.id)).toEqual(["p"]);
    expect(cancelSwap(swaps, "p")).toHaveLength(2);
  });
});
