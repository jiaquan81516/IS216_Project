import { describe, it, expect } from "vitest";
import {
  MOODS, ENERGY, STRESS, CLOSENESS, BODY_AREAS, LIFTS, CONCERNS, MAX_CONCERNS,
  kindWords, IDEAS, HARD_DAY_IDEA, STEADY_DAY_IDEA, ideasFor, readingFor,
} from "@/app/data/wellness";

describe("scale data", () => {
  it("has 5 values each for mood, energy, stress and closeness", () => {
    for (const scale of [MOODS, ENERGY, STRESS, CLOSENESS]) {
      expect(scale.map((o) => o.value)).toEqual([1, 2, 3, 4, 5]);
      expect(scale.every((o) => o.label)).toBe(true);
    }
  });
  it("caps concerns at MAX_CONCERNS and has unique values", () => {
    expect(MAX_CONCERNS).toBe(3);
    const values = CONCERNS.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });
  it("every concern and lift used by ideasFor/readingFor has an IDEAS entry or BODY_AREAS/LIFTS label", () => {
    for (const c of CONCERNS) expect(IDEAS[c.value]).toBeDefined();
    expect(BODY_AREAS.every((b) => b.label)).toBe(true);
    expect(LIFTS.every((l) => l.label)).toBe(true);
  });
});

describe("kindWords", () => {
  it("prioritises low mood or empty energy above everything else", () => {
    expect(kindWords({ mood: 2, energy: 3, stress: 5, lifts: ["sleep"] })).toBe("You are doing a hard thing on very little. That counts.");
    expect(kindWords({ mood: 4, energy: 1, stress: 1, lifts: [] })).toBe("You are doing a hard thing on very little. That counts.");
  });
  it("flags heavy stress next", () => {
    expect(kindWords({ mood: 4, energy: 3, stress: 4 })).toBe("You are carrying a lot. Putting one thing down is allowed.");
  });
  it("notices a lift when nothing else stands out", () => {
    expect(kindWords({ mood: 4, energy: 3, stress: 2, lifts: ["hug"] })).toBe("Something gave back today. Try to make room for it again tomorrow.");
  });
  it("falls back to noticing the check-in itself", () => {
    expect(kindWords({ mood: 4, energy: 3, stress: 2, lifts: [] })).toBe("You stopped for a minute to check on yourself. That counts too.");
    expect(kindWords({ mood: 4, energy: 3, stress: 2 })).toBe("You stopped for a minute to check on yourself. That counts too.");
  });
});

describe("ideasFor", () => {
  it("returns both ideas for a single chosen concern", () => {
    const out = ideasFor({ mood: 3, stress: 3, concerns: ["exhausted"] });
    expect(out).toEqual(IDEAS.exhausted);
  });

  it("interleaves first ideas, then second ideas, across multiple concerns", () => {
    const out = ideasFor({ mood: 3, stress: 3, concerns: ["exhausted", "anxious"] });
    expect(out).toEqual([IDEAS.exhausted[0], IDEAS.anxious[0], IDEAS.exhausted[1], IDEAS.anxious[1]]);
  });

  it("adds 'exhausted' when energy is very low, unless already chosen", () => {
    const added = ideasFor({ mood: 3, stress: 3, energy: 1, concerns: [] });
    expect(added).toEqual(IDEAS.exhausted);
    const notDuped = ideasFor({ mood: 3, stress: 3, energy: 2, concerns: ["exhausted"] });
    expect(notDuped).toEqual(IDEAS.exhausted); // not duplicated
  });

  it("adds 'disconnected' when closeness is very low, unless already chosen", () => {
    const added = ideasFor({ mood: 3, stress: 3, closeness: 1, concerns: [] });
    expect(added).toEqual(IDEAS.disconnected);
  });

  it("falls back to the hard-day idea when mood/stress say today is hard", () => {
    expect(ideasFor({ mood: 1, stress: 3, concerns: [] })).toEqual([HARD_DAY_IDEA]);
    expect(ideasFor({ mood: 4, stress: 5, concerns: [] })).toEqual([HARD_DAY_IDEA]);
  });

  it("falls back to the steady-day idea otherwise", () => {
    expect(ideasFor({ mood: 4, stress: 2, concerns: [] })).toEqual([STEADY_DAY_IDEA]);
  });
});

describe("readingFor", () => {
  it("builds a minimal reading for a plain, in-between day with no earlier check-ins", () => {
    const out = readingFor({ mood: 3, stress: 3 });
    expect(out.story).toBe("Today feels somewhere in between and you are carrying a fair amount.");
    expect(out.insights).toHaveLength(1);
    expect(out.insights[0].title).toBe("An in-between day");
    expect(out.plan.map((p) => p.id)).toEqual(["idea", "rest", "tomorrow"]);
    expect(out.plan[0].title).toBe(STEADY_DAY_IDEA.title);
    expect(out.compare).toBe("This is your first check-in this week. Come back tomorrow and a pattern will start to show.");
    expect(out.talk).toBeNull();
    expect(out.share).toBe("I checked in with myself today. I'm okay, but I could do with a hug.");
  });

  it("builds a full story, caps insights at 3, and prioritises closeness in the plan and share", () => {
    const answers = {
      mood: 1, energy: 1, stress: 5, closeness: 1,
      body: ["shoulders"], concerns: ["exhausted"], lifts: ["sleep"],
    };
    const out = readingFor(answers);
    expect(out.story).toBe(
      "Today feels really hard, your tank is empty, and you are carrying more than one person should. " +
      "You are holding it in your shoulders. You feel far apart from your partner. " +
      "Tiredness took the most out of you, and some sleep gave a little back.",
    );
    expect(out.insights).toHaveLength(3);
    expect(out.insights.map((i) => i.title)).toEqual([
      "Low mood and an empty tank", "Your body is carrying it too", "You and your partner feel apart",
    ]);
    expect(out.plan.map((p) => p.id)).toEqual(["idea", "release", "together"]);
    expect(out.talk).toBe("That sounds like a heavy day. If it keeps feeling like this, or you feel unsafe, please talk to someone today.");
    expect(out.share).toBe("I've been feeling a bit far from you lately. Could we have ten minutes tonight, just us?");
  });

  it("capitalises a named partner but keeps the default lowercase", () => {
    const withDefault = readingFor({ mood: 3, stress: 3, closeness: 1 });
    expect(withDefault.story).toContain("your partner");
    const withName = readingFor({ mood: 3, stress: 3, closeness: 1 }, { partner: "jess" });
    expect(withName.story).toContain("jess"); // story uses the raw partner value, not capitalised
    expect(withName.insights.find((i) => i.title.startsWith("You and"))?.title).toBe("You and Jess feel apart");
  });

  it("compares today against the week: lighter, heavier, and about the same", () => {
    const lighter = readingFor({ mood: 4, stress: 3 }, { earlier: [{ mood: 2 }] });
    expect(lighter.compare).toBe("Today is lighter than your other check-in this week.");
    const heavier = readingFor({ mood: 2, stress: 3 }, { earlier: [{ mood: 4 }, { mood: 4 }] });
    expect(heavier.compare).toBe("Today is heavier than your other 2 check-ins this week.");
    const same = readingFor({ mood: 3, stress: 3 }, { earlier: [{ mood: 3 }] });
    expect(same.compare).toBe("Today is about the same as your other check-in this week.");
  });

  it("flags a run of low days even without today being the worst", () => {
    const out = readingFor({ mood: 2, stress: 3 }, { earlier: [{ mood: 1 }, { mood: 2 }, { mood: 2 }] });
    expect(out.talk).toBe("You have had 4 low days this week. If that carries on for two weeks, it is worth seeing a doctor. The check on the Support page can help you decide.");
  });

  it("does not raise talk when nothing stands out", () => {
    const out = readingFor({ mood: 4, stress: 2 });
    expect(out.talk).toBeNull();
  });

  it("shares a positive note on a good day", () => {
    const out = readingFor({ mood: 5, stress: 1 });
    expect(out.share).toBe("Today was a better day. Thank you for your part in it.");
  });

  it("shares a tired note when running low on energy", () => {
    const out = readingFor({ mood: 3, stress: 2, energy: 1 });
    expect(out.share).toBe("I'm running low today. I don't need you to fix anything, but could you take the next feed so I can rest?");
  });

  it("never returns more than 3 plan items or 3 insights", () => {
    const out = readingFor({
      mood: 1, energy: 1, stress: 5, closeness: 1,
      body: ["shoulders", "jaw"], concerns: ["exhausted", "anxious", "isolated"], lifts: ["sleep", "hug"],
    });
    expect(out.insights.length).toBeLessThanOrEqual(3);
    expect(out.plan.length).toBeLessThanOrEqual(3);
  });
});
