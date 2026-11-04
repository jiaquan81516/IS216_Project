import { describe, it, expect } from "vitest";
import {
  RIGHT_NOW, CHECK_QUESTIONS, checkResult, CHECK_RESULTS, GUIDES,
} from "@/app/data/supportGuides";

describe("RIGHT_NOW", () => {
  it("has unique ids and at least 4 steps worth of content", () => {
    const ids = RIGHT_NOW.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RIGHT_NOW) {
      expect(r.label).toBeTruthy();
      expect(Array.isArray(r.steps)).toBe(true);
      expect(r.steps.length).toBeGreaterThan(0);
    }
  });
});

describe("CHECK_QUESTIONS", () => {
  it("has unique ids, each with a me/partner phrasing", () => {
    const ids = CHECK_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of CHECK_QUESTIONS) {
      expect(q.me).toBeTruthy();
      expect(q.partner).toBeTruthy();
    }
  });
  it("marks exactly the harm and psychosis questions as urgent", () => {
    const urgentIds = CHECK_QUESTIONS.filter((q) => q.urgent).map((q) => q.id);
    expect(urgentIds.sort()).toEqual(["harm", "psychosis"]);
  });
});

describe("checkResult", () => {
  const allFalse = Object.fromEntries(CHECK_QUESTIONS.map((q) => [q.id, false]));
  const allTrue = Object.fromEntries(CHECK_QUESTIONS.map((q) => [q.id, true]));

  it("returns null while any question is unanswered", () => {
    expect(checkResult({})).toBeNull();
    expect(checkResult({ harm: false })).toBeNull();
    const almostAll = { ...allFalse };
    delete almostAll.coping;
    expect(checkResult(almostAll)).toBeNull();
  });

  it("returns 'urgent' the moment an urgent question is true, even if others are unanswered", () => {
    expect(checkResult({ harm: true })).toBe("urgent");
    expect(checkResult({ psychosis: true })).toBe("urgent");
    expect(checkResult({ harm: true, psychosis: false })).toBe("urgent");
  });

  it("returns 'ordinary' when everything is answered and nothing is true", () => {
    expect(checkResult(allFalse)).toBe("ordinary");
  });

  it("returns 'doctor' when a non-urgent question is true but no urgent one is", () => {
    expect(checkResult({ ...allFalse, "two-weeks": true })).toBe("doctor");
  });

  it("returns 'urgent' over 'doctor' when both would otherwise apply", () => {
    expect(checkResult(allTrue)).toBe("urgent");
  });
});

describe("CHECK_RESULTS", () => {
  it("has a doctor and ordinary result, each with a title, body and links", () => {
    for (const key of ["doctor", "ordinary"]) {
      const r = CHECK_RESULTS[key];
      expect(r.title).toBeTruthy();
      expect(r.body).toBeTruthy();
      expect(Array.isArray(r.links)).toBe(true);
      expect(r.links.length).toBeGreaterThan(0);
    }
  });
});

describe("GUIDES", () => {
  it("has unique ids, each with the expected shape", () => {
    const ids = GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GUIDES) {
      expect(g.title).toBeTruthy();
      expect(g.summary).toBeTruthy();
      expect(Array.isArray(g.facts)).toBe(true);
      expect(Array.isArray(g.helps)).toBe(true);
      expect(Array.isArray(g.getHelp)).toBe(true);
      expect(Array.isArray(g.sources)).toBe(true);
      expect(g.sources.length).toBeGreaterThan(0);
      for (const s of g.sources) {
        expect(s.title).toBeTruthy();
        expect(s.url).toMatch(/^https:\/\//);
      }
    }
  });

  it("every guide link referenced elsewhere (RIGHT_NOW, CHECK_RESULTS) points to a real guide", () => {
    const guideIds = new Set(GUIDES.map((g) => g.id));
    const referenced = [];
    for (const item of RIGHT_NOW) {
      if (item.link?.to?.query?.guide) referenced.push(item.link.to.query.guide);
    }
    for (const result of Object.values(CHECK_RESULTS)) {
      for (const link of result.links) {
        if (link.to?.query?.guide) referenced.push(link.to.query.guide);
      }
    }
    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) expect(guideIds.has(id)).toBe(true);
  });
});
