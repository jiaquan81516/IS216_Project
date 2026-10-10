import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/firebase", () => ({ default: {}, auth: {} }));
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  arrayUnion: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
}));

import { babySummary } from "@/app/api/profile";

const today = new Date(2026, 9, 9);

describe("babySummary", () => {
  it("describes a born baby in weeks", () => {
    expect(babySummary({ babyName: " Aria ", babyStatus: "born", babyDate: "2026-08-28" }, today)).toEqual({
      name: "Aria",
      line: "6 weeks old",
    });
    expect(babySummary({ babyStatus: "born", babyDate: "2026-10-02" }, today).line).toBe("1 week old");
  });
  it("uses days under one week", () => {
    expect(babySummary({ babyStatus: "born", babyDate: "2026-10-06" }, today).line).toBe("3 days old");
    expect(babySummary({ babyStatus: "born", babyDate: "2026-10-08" }, today).line).toBe("1 day old");
    expect(babySummary({ babyStatus: "born", babyDate: "2026-10-09" }, today).line).toBe("Born today");
  });
  it("describes an expected baby", () => {
    expect(babySummary({ babyStatus: "expected", babyDate: "2026-10-30" }, today).line).toBe("Due in 3 weeks");
    expect(babySummary({ babyStatus: "expected", babyDate: "2026-10-16" }, today).line).toBe("Due in 1 week");
    expect(babySummary({ babyStatus: "expected", babyDate: "2026-10-12" }, today).line).toBe("Due this week");
    expect(babySummary({ babyStatus: "expected", babyDate: "2026-10-09" }, today).line).toBe("Due today");
    expect(babySummary({ babyStatus: "expected", babyDate: "2026-10-01" }, today).line).toBe("Past due date");
  });
  it("handles missing, invalid and unknown input", () => {
    expect(babySummary({}, today)).toEqual({ name: null, line: "" });
    expect(babySummary({ babyName: "  ", babyDate: "09/10/2026" }, today)).toEqual({ name: null, line: "" });
    expect(babySummary({ babyStatus: "weird", babyDate: "2026-10-02" }, today).line).toBe("1 week old");
    expect(babySummary({ babyStatus: "born", babyDate: "2026-12-01" }, today).line).toBe("");
  });
});
