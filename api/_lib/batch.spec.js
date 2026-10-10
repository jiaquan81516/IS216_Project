import { describe, expect, it } from "vitest";
import { batchCount, BATCH_MAX, chunk } from "./batch.js";

describe("chunking writes", () => {
  it("stays under Firestore's limit of 500 by default", () => {
    expect(BATCH_MAX).toBe(400);
    const items = Array.from({ length: 1000 }, (_, i) => i);
    const groups = chunk(items);
    expect(groups.map((g) => g.length)).toEqual([400, 400, 200]);
    expect(groups.flat()).toEqual(items);
  });

  it("gives one group when everything fits", () => {
    expect(chunk([1, 2, 3], 400)).toEqual([[1, 2, 3]]);
    expect(chunk([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it("splits exactly on the boundary", () => {
    const items = Array.from({ length: 800 }, (_, i) => i);
    expect(chunk(items).length).toBe(2);
    expect(chunk(Array.from({ length: 801 }, (_, i) => i)).length).toBe(3);
  });

  it("gives nothing back for an empty or missing list", () => {
    expect(chunk([])).toEqual([]);
    expect(chunk(null)).toEqual([]);
    expect(chunk(undefined)).toEqual([]);
  });

  it("falls back to the default rather than looping forever on a bad size", () => {
    expect(chunk([1, 2, 3], 0).length).toBe(1);
    expect(chunk([1, 2, 3], -5).length).toBe(1);
    expect(chunk([1, 2, 3], 1.7)).toEqual([[1], [2], [3]]);
  });

  it("counts the batches a list will take", () => {
    expect(batchCount(Array.from({ length: 401 }, (_, i) => i))).toBe(2);
    expect(batchCount([])).toBe(0);
  });
});
