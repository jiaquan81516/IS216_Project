import { describe, it, expect, afterEach } from "vitest";
import { ROUTES } from "@/app/routes";
import { STEP_ORDER, routeMotion, isStepPath, directionBetween, setStepDirection } from "@/app/utils/routeMotion";

describe("STEP_ORDER", () => {
  it("lists the sign-up steps in order and is frozen", () => {
    expect(STEP_ORDER).toEqual([ROUTES.JOURNEY, ROUTES.ROLE, ROUTES.ACCOUNT, ROUTES.HOUSEHOLD]);
    expect(Object.isFrozen(STEP_ORDER)).toBe(true);
  });
});

describe("routeMotion reactive state", () => {
  it("starts with pending:false and initial:true", () => {
    expect(routeMotion.pending).toBe(false);
    expect(routeMotion.initial).toBe(true);
  });
});

describe("isStepPath", () => {
  it("is true for every step route", () => {
    for (const path of STEP_ORDER) expect(isStepPath(path)).toBe(true);
  });

  it("is false for a non-step route", () => {
    expect(isStepPath(ROUTES.HOME)).toBe(false);
    expect(isStepPath("/not-a-real-route")).toBe(false);
  });
});

describe("directionBetween", () => {
  it("is forward when moving to a later step", () => {
    expect(directionBetween(ROUTES.JOURNEY, ROUTES.ROLE)).toBe("forward");
    expect(directionBetween(ROUTES.ROLE, ROUTES.HOUSEHOLD)).toBe("forward");
  });

  it("is back when moving to an earlier step", () => {
    expect(directionBetween(ROUTES.HOUSEHOLD, ROUTES.ACCOUNT)).toBe("back");
    expect(directionBetween(ROUTES.ROLE, ROUTES.JOURNEY)).toBe("back");
  });

  it("is forward when staying on the same step", () => {
    expect(directionBetween(ROUTES.ACCOUNT, ROUTES.ACCOUNT)).toBe("forward");
  });

  it("is forward when either path is not a recognised step", () => {
    expect(directionBetween("/unknown", ROUTES.JOURNEY)).toBe("forward");
    expect(directionBetween(ROUTES.HOUSEHOLD, "/unknown")).toBe("forward");
    expect(directionBetween("/a", "/b")).toBe("forward");
  });
});

describe("setStepDirection", () => {
  afterEach(() => {
    delete document.documentElement.dataset.stepDir;
  });

  it("writes the direction onto document.documentElement.dataset.stepDir", () => {
    setStepDirection("back");
    expect(document.documentElement.dataset.stepDir).toBe("back");
    setStepDirection("forward");
    expect(document.documentElement.dataset.stepDir).toBe("forward");
  });
});
