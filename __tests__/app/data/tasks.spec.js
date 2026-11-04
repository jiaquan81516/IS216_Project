import { describe, it, expect } from "vitest";
import { TASK_GROUPS } from "@/app/data/tasks";

describe("TASK_GROUPS", () => {
  it("has unique values with labels", () => {
    const values = TASK_GROUPS.map((g) => g.value);
    expect(new Set(values).size).toBe(values.length);
    for (const g of TASK_GROUPS) expect(g.label).toBeTruthy();
  });
  it("is frozen", () => {
    expect(Object.isFrozen(TASK_GROUPS)).toBe(true);
  });
});
