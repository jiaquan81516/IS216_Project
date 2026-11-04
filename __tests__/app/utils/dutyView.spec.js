import { describe, it, expect } from "vitest";
import { dutyForCarer } from "@/app/utils/dutyView";

const parent1 = { uid: "p1", displayName: "Jess Tan", accessLevel: "parent" };
const parent2 = { uid: "p2", displayName: "Daniel Lee", accessLevel: "parent" };
const caregiver = { uid: "c1", displayName: "Grace", accessLevel: "caregiver" };

describe("dutyForCarer", () => {
  it("returns an empty result with no settings", () => {
    expect(dutyForCarer({ settings: null })).toEqual({ today: [], night: null });
    expect(dutyForCarer({})).toEqual({ today: [], night: null });
  });

  describe("today's shifts", () => {
    const now = new Date(2026, 9, 14, 12, 0, 0); // Wednesday -> dayIndex 2
    const members = [parent1, parent2, caregiver];

    it("resolves 'me' and 'partner' shifts to the actual parent's name", () => {
      const settings = {
        schedule: [
          { day: 2, start: "06:00", end: "12:00", who: "me" },
          { day: 2, start: "12:00", end: "18:00", who: "partner" },
        ],
      };
      const out = dutyForCarer({ settings, members, meUid: "c1", now });
      expect(out.today).toEqual([
        { start: "6:00 AM", end: "12:00 PM", name: "Jess", isMe: false },
        { start: "12:00 PM", end: "6:00 PM", name: "Daniel", isMe: false },
      ]);
    });

    it("marks isMe true when the viewing caregiver is themselves one of the parents", () => {
      const settings = { schedule: [{ day: 2, start: "06:00", end: "12:00", who: "me" }] };
      const out = dutyForCarer({ settings, members, meUid: "p1", now });
      expect(out.today[0]).toMatchObject({ name: "You", isMe: true });
    });

    it("labels a 'both' shift as 'Both parents' and an 'other' shift by its name", () => {
      const settings = {
        schedule: [
          { day: 2, start: "06:00", end: "10:00", who: "both" },
          { day: 2, start: "10:00", end: "12:00", who: "other", label: "Nanny Mae" },
        ],
      };
      const out = dutyForCarer({ settings, members, meUid: "c1", now });
      expect(out.today[0]).toMatchObject({ name: "Both parents", isMe: false });
      expect(out.today[1]).toMatchObject({ name: "Nanny Mae", isMe: false });
    });

    it("defaults an 'other' shift with no label to 'Someone else'", () => {
      const settings = { schedule: [{ day: 2, start: "06:00", end: "12:00", who: "other" }] };
      const out = dutyForCarer({ settings, members, meUid: "c1", now });
      expect(out.today[0].name).toBe("Someone else");
    });

    it("falls back to 'A parent' for a 'partner' shift in a solo household", () => {
      const settings = { schedule: [{ day: 2, start: "06:00", end: "12:00", who: "partner" }] };
      const out = dutyForCarer({ settings, members: [parent1, caregiver], meUid: "c1", now });
      expect(out.today[0].name).toBe("A parent");
    });

    it("sorts shifts by start time regardless of input order", () => {
      const settings = {
        schedule: [
          { day: 2, start: "12:00", end: "18:00", who: "partner" },
          { day: 2, start: "06:00", end: "12:00", who: "me" },
        ],
      };
      const out = dutyForCarer({ settings, members, meUid: "c1", now });
      expect(out.today.map((s) => s.start)).toEqual(["6:00 AM", "12:00 PM"]);
    });

    it("excludes shifts on other days and malformed shifts", () => {
      const settings = {
        schedule: [
          { day: 3, start: "06:00", end: "12:00", who: "me" }, // wrong day
          { day: 2, start: "6:00", end: "12:00", who: "me" }, // unpadded hour, malformed
          { day: 2, start: "06:00", end: "12:00", who: "" }, // no who
          { day: 2, who: "me" }, // no times at all
        ],
      };
      expect(dutyForCarer({ settings, members, meUid: "c1", now }).today).toEqual([]);
    });

    it("handles a missing or non-array schedule", () => {
      expect(dutyForCarer({ settings: {}, members, meUid: "c1", now }).today).toEqual([]);
      expect(dutyForCarer({ settings: { schedule: "nope" }, members, meUid: "c1", now }).today).toEqual([]);
    });

    it("formats midnight and noon correctly", () => {
      const settings = { schedule: [{ day: 2, start: "00:00", end: "12:00", who: "me" }] };
      const out = dutyForCarer({ settings, members, meUid: "c1", now });
      expect(out.today[0]).toMatchObject({ start: "12:00 AM", end: "12:00 PM" });
    });
  });

  describe("tonight's duty", () => {
    const members = [parent1, parent2, caregiver];
    const baseSettings = { pattern: "manual", startDate: "2026-10-01", handoverTime: "07:00", carerNights: [], schedule: [] };
    const noonToday = new Date(2026, 9, 14, 12, 0, 0); // after handover -> "tonight" is 2026-10-14

    it("reports an 'open' night as no one on duty", () => {
      const out = dutyForCarer({ settings: baseSettings, members, meUid: "c1", now: noonToday });
      expect(out.night).toBeNull();
    });

    it("reports the first parent's own night with their name and the handover time", () => {
      const nights = { "2026-10-14": { onCall: "p1" } };
      const out = dutyForCarer({ settings: baseSettings, nights, members, meUid: "c1", now: noonToday });
      expect(out.night).toMatchObject({ name: "Jess", isMe: false, handover: "7:00 AM", shared: false });
    });

    it("reports the second parent's night", () => {
      const nights = { "2026-10-14": { onCall: "p2" } };
      const out = dutyForCarer({ settings: baseSettings, nights, members, meUid: "c1", now: noonToday });
      expect(out.night.name).toBe("Daniel");
    });

    it("reports a named carer's fixed night and recognises when the viewer is that carer", () => {
      const settings = { ...baseSettings, carerNights: [{ label: "Nanny Mae", uid: "nanny1", days: [2] }] };
      const asOther = dutyForCarer({ settings, members, meUid: "c1", now: noonToday });
      expect(asOther.night).toMatchObject({ name: "Nanny Mae", isMe: false });
      const asTheCarer = dutyForCarer({ settings, members, meUid: "nanny1", now: noonToday });
      expect(asTheCarer.night).toMatchObject({ name: "Nanny Mae", isMe: true });
    });

    it("lets an explicit onCall override to the viewer's own uid win, naming them 'You'", () => {
      const settings = { ...baseSettings, carerNights: [{ label: "Nanny Mae", uid: "nanny1", days: [2] }] };
      const nights = { "2026-10-14": { onCall: "c1" } };
      const out = dutyForCarer({ settings, nights, members, meUid: "c1", now: noonToday });
      expect(out.night).toMatchObject({ name: "You", isMe: true });
    });

    it("marks a shared (split) night", () => {
      const settings = { ...baseSettings, pattern: "split", firstOnDuty: "me" };
      const out = dutyForCarer({ settings, members, meUid: "c1", now: noonToday });
      expect(out.night?.shared).toBe(true);
    });

    it("falls back to manual (no phantom partner) for a solo household with no stored pattern", () => {
      const settings = { startDate: "2026-10-01", handoverTime: "07:00", carerNights: [], schedule: [] };
      const out = dutyForCarer({ settings, members: [parent1, caregiver], meUid: "c1", now: noonToday });
      // manual with no override -> night is "open" -> no duty shown, instead of a phantom alternating partner
      expect(out.night).toBeNull();
    });

    it("picks the previous calendar date as 'tonight' before the handover time", () => {
      const beforeHandover = new Date(2026, 9, 14, 5, 0, 0); // 5am, before 07:00 handover
      const nights = { "2026-10-13": { onCall: "p1" } };
      const out = dutyForCarer({ settings: baseSettings, nights, members, meUid: "c1", now: beforeHandover });
      expect(out.night).toMatchObject({ name: "Jess" });
    });

    it("handles no members/parents at all without throwing", () => {
      expect(() => dutyForCarer({ settings: baseSettings, members: [], meUid: "c1", now: noonToday })).not.toThrow();
      expect(dutyForCarer({ settings: baseSettings, members: [], meUid: "c1", now: noonToday }).night).toBeNull();
    });
  });
});
