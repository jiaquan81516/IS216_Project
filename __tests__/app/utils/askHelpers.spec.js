import { describe, it, expect } from "vitest";
import { ASKS, REPLIES, askKind, answersAsk } from "@/app/utils/askHelpers";

describe("ASKS / REPLIES", () => {
  it("ASKS and REPLIES are frozen", () => {
    expect(Object.isFrozen(ASKS)).toBe(true);
    expect(Object.isFrozen(REPLIES)).toBe(true);
  });

  it("every ASKS entry has a matching REPLIES entry for its need", () => {
    for (const { need } of ASKS) expect(REPLIES[need]).toBeTruthy();
  });
});

describe("askKind", () => {
  it("recognises each ask phrase, case-insensitively, anywhere in the text", () => {
    expect(askKind("Can you take over tonight?")).toBe("coverTonight");
    expect(askKind("please check in on me later")).toBe("checkOnMe");
    expect(askKind("I need you to give me some quiet please")).toBe("giveSpace");
  });

  it("returns null for text that matches no ask", () => {
    expect(askKind("good morning")).toBeNull();
    expect(askKind("")).toBeNull();
    expect(askKind(null)).toBeNull();
    expect(askKind(undefined)).toBeNull();
  });
});

describe("answersAsk", () => {
  it("coverTonight is answered only by its accept or decline canned replies", () => {
    expect(answersAsk("coverTonight", REPLIES.coverTonight)).toBe(true);
    expect(answersAsk("coverTonight", REPLIES.coverDeclined)).toBe(true);
    expect(answersAsk("coverTonight", REPLIES.checkOnMe)).toBe(false);
    expect(answersAsk("coverTonight", "sure, no problem")).toBe(false);
  });

  it("giveSpace is answered only by its own canned reply", () => {
    expect(answersAsk("giveSpace", REPLIES.giveSpace)).toBe(true);
    expect(answersAsk("giveSpace", REPLIES.checkOnMe)).toBe(false);
    expect(answersAsk("giveSpace", "ok, taking space")).toBe(false);
  });

  it("checkOnMe is answered by its own canned reply AND by any message that is not another ask's canned reply", () => {
    expect(answersAsk("checkOnMe", REPLIES.checkOnMe)).toBe(true);
    expect(answersAsk("checkOnMe", "I'm okay, thanks for checking")).toBe(true);
  });

  it("checkOnMe is NOT answered by another ask's canned reply", () => {
    expect(answersAsk("checkOnMe", REPLIES.coverTonight)).toBe(false);
    expect(answersAsk("checkOnMe", REPLIES.giveSpace)).toBe(false);
  });

  it("trims whitespace before comparing", () => {
    expect(answersAsk("giveSpace", `  ${REPLIES.giveSpace}  `)).toBe(true);
  });
});
