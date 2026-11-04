import { describe, it, expect } from "vitest";
import { suggestionsFor, MAX_SUGGESTIONS } from "@/app/utils/chatHelpers";
import { weeklyPrompt } from "@/app/utils/loadHelpers";

describe("suggestionsFor", () => {
  it("offers a thank-you and a next-one offer when the partner has had a heavy stretch", () => {
    const list = suggestionsFor({ nudges: [{ id: "n1", kind: "partner-heavy" }] });
    expect(list.map((s) => s.text)).toEqual(["Thank you for carrying that", "I can take the next one"]);
    expect(list[0]).toMatchObject({ kind: "thanks", label: "Send a thank you", nudgeId: "n1" });
    expect(list[1]).toMatchObject({ kind: "text", nudgeId: "n1" });
  });

  it("offers comfort replies when the partner shared a hard day", () => {
    const list = suggestionsFor({ nudges: [{ id: "n2", kind: "partner-feeling" }] });
    expect(list.map((s) => s.text)).toEqual(["Thinking of you", "I have got tonight"]);
  });

  it("combines both heavy and hard-day suggestions, capped at MAX_SUGGESTIONS", () => {
    const list = suggestionsFor({ nudges: [{ id: "n1", kind: "partner-heavy" }, { id: "n2", kind: "partner-feeling" }] });
    expect(list).toHaveLength(MAX_SUGGESTIONS);
    expect(list.map((s) => s.text)).toEqual(["Thank you for carrying that", "I can take the next one", "Thinking of you"]);
  });

  it("falls back to a thank-you (if logs>0) plus the weekly prompt with no heavy/hard nudge", () => {
    const now = new Date(2026, 10, 5);
    const list = suggestionsFor({ nudges: [], partnerLogs: 2, now });
    expect(list.map((s) => s.text)).toEqual(["Thank you for everything today", weeklyPrompt(now)]);
  });

  it("omits the generic thank-you when the partner has not logged anything", () => {
    const now = new Date(2026, 10, 5);
    const list = suggestionsFor({ nudges: [], partnerLogs: 0, now });
    expect(list.map((s) => s.text)).toEqual([weeklyPrompt(now)]);
  });

  it("filters out a suggestion already sent today (case-insensitive)", () => {
    const now = new Date(2026, 10, 5, 12, 0);
    const messages = [{ from: "me1", text: "thank you for carrying that", createdAt: now.toISOString() }];
    const list = suggestionsFor({ nudges: [{ id: "n1", kind: "partner-heavy" }], messages, uid: "me1", now });
    expect(list.map((s) => s.text)).toEqual(["I can take the next one"]);
  });

  it("does not filter a message sent by someone else, or on a different day", () => {
    const now = new Date(2026, 10, 5, 12, 0);
    const messages = [
      { from: "partner1", text: "Thank you for carrying that", createdAt: now.toISOString() },
      { from: "me1", text: "Thank you for carrying that", createdAt: new Date(2026, 10, 1).toISOString() },
    ];
    const list = suggestionsFor({ nudges: [{ id: "n1", kind: "partner-heavy" }], messages, uid: "me1", now });
    expect(list.map((s) => s.text)).toContain("Thank you for carrying that");
  });

  it("ignores a message with no parseable createdAt when checking for duplicates", () => {
    const now = new Date(2026, 10, 5, 12, 0);
    const messages = [{ from: "me1", text: "Thank you for carrying that", createdAt: "not a date" }];
    const list = suggestionsFor({ nudges: [{ id: "n1", kind: "partner-heavy" }], messages, uid: "me1", now });
    expect(list.map((s) => s.text)).toContain("Thank you for carrying that");
  });
});
