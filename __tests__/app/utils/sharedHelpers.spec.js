import { describe, it, expect } from "vitest";
import { ownerLabel, ownerKey, ownerUid, relativeTime, updatedLine, describeSharedError } from "@/app/utils/sharedHelpers";

describe("ownerLabel", () => {
  it("labels 'both' and 'open'", () => {
    expect(ownerLabel("both", "me1")).toBe("Both");
    expect(ownerLabel("open", "me1")).toBe("Open");
  });

  it("returns '' for an empty owner", () => {
    expect(ownerLabel(null, "me1")).toBe("");
    expect(ownerLabel("", "me1")).toBe("");
  });

  it("labels the signed-in user's own uid as meName", () => {
    expect(ownerLabel("me1", "me1", "Jess")).toBe("Jess");
    expect(ownerLabel("me1", "me1")).toBe("Me");
  });

  it("labels the literal 'me'/'partner' keys too", () => {
    expect(ownerLabel("me", "me1", "Jess")).toBe("Jess");
    expect(ownerLabel("partner", "me1", "Jess", "Pat")).toBe("Pat");
  });

  it("labels any other uid as the partner", () => {
    expect(ownerLabel("partner1", "me1", "Jess", "Pat")).toBe("Pat");
  });

  it("falls back to default names when custom ones are blank", () => {
    expect(ownerLabel("me1", "me1", "")).toBe("Me");
    expect(ownerLabel("partner1", "me1", "Jess", "")).toBe("Your partner");
  });
});

describe("ownerKey", () => {
  it("passes through 'both'/'open'/'me'/'partner' unchanged", () => {
    for (const v of ["both", "open", "me", "partner"]) expect(ownerKey(v, "me1")).toBe(v);
  });

  it("returns null for a falsy owner", () => {
    expect(ownerKey(null, "me1")).toBeNull();
    expect(ownerKey("", "me1")).toBeNull();
  });

  it("resolves the caller's own uid to 'me'", () => {
    expect(ownerKey("me1", "me1")).toBe("me");
  });

  it("resolves any other non-empty value to 'partner'", () => {
    expect(ownerKey("partner1", "me1")).toBe("partner");
    expect(ownerKey("whatever", "")).toBe("partner");
  });
});

describe("ownerUid", () => {
  it("maps 'both' through unchanged", () => {
    expect(ownerUid("both", "me1", "p1")).toBe("both");
  });
  it("maps 'me'/'partner' to the given uids, or null if unknown", () => {
    expect(ownerUid("me", "me1", "p1")).toBe("me1");
    expect(ownerUid("me", "", "p1")).toBeNull();
    expect(ownerUid("partner", "me1", "p1")).toBe("p1");
    expect(ownerUid("partner", "me1", "")).toBeNull();
  });
  it("maps anything else (e.g. 'none') to null", () => {
    expect(ownerUid("none", "me1", "p1")).toBeNull();
    expect(ownerUid(undefined, "me1", "p1")).toBeNull();
  });
});

describe("relativeTime", () => {
  const now = new Date(2026, 10, 4, 12, 0, 0);

  it("returns '' for an unusable value", () => {
    expect(relativeTime(null, now)).toBe("");
  });

  it("says 'just now' under 45 seconds, and for a future time (negative seconds)", () => {
    expect(relativeTime(new Date(now.getTime() - 10000), now)).toBe("just now");
    expect(relativeTime(new Date(now.getTime() + 5000), now)).toBe("just now");
  });

  it("says '1 minute ago' between 45 and 90 seconds", () => {
    expect(relativeTime(new Date(now.getTime() - 60000), now)).toBe("1 minute ago");
  });

  it("says '<n> minutes ago' under an hour", () => {
    expect(relativeTime(new Date(now.getTime() - 10 * 60000), now)).toBe("10 minutes ago");
  });

  it("says '1 hour ago' for roughly an hour", () => {
    expect(relativeTime(new Date(now.getTime() - 65 * 60000), now)).toBe("1 hour ago");
  });

  it("says '<n> hours ago' later the same day", () => {
    expect(relativeTime(new Date(now.getTime() - 5 * 3600000), now)).toBe("5 hours ago");
  });

  it("says 'yesterday' for exactly one calendar day back", () => {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(relativeTime(yesterday, now)).toBe("yesterday");
  });

  it("says 'on D Month' for anything older than yesterday", () => {
    expect(relativeTime(new Date(2026, 9, 1, 12, 0), now)).toBe("on 1 October");
  });
});

describe("updatedLine", () => {
  const now = new Date(2026, 10, 4, 12, 0, 0);

  it("returns '' when there is no updatedAt", () => {
    expect(updatedLine({}, "me1", "you", "your partner", now)).toBe("");
    expect(updatedLine(null, "me1", "you", "your partner", now)).toBe("");
  });

  it("includes who updated it when updatedBy is known", () => {
    const record = { updatedAt: new Date(now.getTime() - 5 * 60000), updatedBy: "me1" };
    expect(updatedLine(record, "me1", "you", "your partner", now)).toBe("Updated by you 5 minutes ago");
  });

  it("omits 'by <who>' when updatedBy is missing", () => {
    const record = { updatedAt: new Date(now.getTime() - 5 * 60000) };
    expect(updatedLine(record, "me1", "you", "your partner", now)).toBe("Updated 5 minutes ago");
  });
});

describe("describeSharedError", () => {
  it("names the 'what' in a permission-denied message", () => {
    expect(describeSharedError("permission-denied", "sleep rota").text).toContain("sleep rota");
  });

  it("gives an index message for failed-precondition", () => {
    expect(describeSharedError("failed-precondition").text).toContain("index");
  });

  it("gives a connection message naming 'what' for unavailable/timeout/deadline-exceeded", () => {
    for (const code of ["unavailable", "timeout", "deadline-exceeded"]) {
      expect(describeSharedError(code, "calendar").text).toContain("calendar");
    }
  });

  it("defaults 'what' to 'page' when not given", () => {
    expect(describeSharedError("permission-denied").text).toContain("page");
  });

  it("falls back to a generic message with the code as detail", () => {
    const { text, detail } = describeSharedError("weird-code", "tasks");
    expect(text).toBe("We could not load the tasks.");
    expect(detail).toBe("Error code: weird-code");
  });
});
