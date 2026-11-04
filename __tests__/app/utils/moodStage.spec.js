import { describe, it, expect } from "vitest";
import { MOOD_STAGES, NEEDS, DEFAULT_NEED, moodStageFor, isStruggling } from "@/app/utils/moodStage";

describe("constants", () => {
  it("MOOD_STAGES lists the five stages in bloom order and is frozen", () => {
    expect(MOOD_STAGES).toEqual(["budding", "opening", "bloom", "drooping", "wilted"]);
    expect(Object.isFrozen(MOOD_STAGES)).toBe(true);
  });

  it("NEEDS lists the three asks and is frozen", () => {
    expect(NEEDS).toEqual(["coverTonight", "checkOnMe", "giveSpace"]);
    expect(Object.isFrozen(NEEDS)).toBe(true);
  });

  it("DEFAULT_NEED is checkOnMe", () => {
    expect(DEFAULT_NEED).toBe("checkOnMe");
  });
});

describe("moodStageFor", () => {
  it("is wilted when mood is 1, regardless of stress", () => {
    expect(moodStageFor({ mood: 1, stress: 1 })).toBe("wilted");
    expect(moodStageFor({ mood: 1, stress: 3 })).toBe("wilted");
  });

  it("is wilted when stress is 5, regardless of mood", () => {
    expect(moodStageFor({ mood: 5, stress: 5 })).toBe("wilted");
  });

  it("is drooping when mood is 2 (and not already wilted)", () => {
    expect(moodStageFor({ mood: 2, stress: 1 })).toBe("drooping");
  });

  it("is drooping when stress is 4 (and not already wilted), even with a great mood", () => {
    expect(moodStageFor({ mood: 5, stress: 4 })).toBe("drooping");
  });

  it("is bloom when mood is 4 or 5 and stress is 3 or less", () => {
    expect(moodStageFor({ mood: 4, stress: 3 })).toBe("bloom");
    expect(moodStageFor({ mood: 5, stress: 1 })).toBe("bloom");
  });

  it("is opening for a middling day (mood 3, stress 3)", () => {
    expect(moodStageFor({ mood: 3, stress: 3 })).toBe("opening");
  });

  it("falls back to opening when mood/stress are missing or out of range", () => {
    expect(moodStageFor({})).toBe("opening");
    expect(moodStageFor()).toBe("opening");
    expect(moodStageFor({ mood: 3 })).toBe("opening");
  });

  it("never returns 'budding' (that stage is only the pre-check-in/resolved default, not derived)", () => {
    for (let mood = 1; mood <= 5; mood += 1) {
      for (let stress = 1; stress <= 5; stress += 1) {
        expect(moodStageFor({ mood, stress })).not.toBe("budding");
      }
    }
  });
});

describe("isStruggling", () => {
  it("is true for drooping and wilted", () => {
    expect(isStruggling("drooping")).toBe(true);
    expect(isStruggling("wilted")).toBe(true);
  });

  it("is false for budding, opening and bloom", () => {
    expect(isStruggling("budding")).toBe(false);
    expect(isStruggling("opening")).toBe(false);
    expect(isStruggling("bloom")).toBe(false);
  });

  it("is false for an unknown or missing value", () => {
    expect(isStruggling("")).toBe(false);
    expect(isStruggling(undefined)).toBe(false);
  });
});
