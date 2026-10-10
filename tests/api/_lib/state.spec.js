import { describe, expect, it } from "vitest";
import { decodeState, encodeState, newNonce, STATE_TTL_MS } from "../../../api/_lib/state.js";

const SECRET = "a-test-secret-value";

describe("the OAuth state value", () => {
  it("encodes and decodes a uid and a nonce", () => {
    const now = 1_760_000_000_000;
    const state = encodeState({ uid: "user-1", nonce: "nonce-1" }, SECRET, { now });
    expect(state).toContain(".");
    const decoded = decodeState(state, SECRET, { now });
    expect(decoded.uid).toBe("user-1");
    expect(decoded.nonce).toBe("nonce-1");
    expect(decoded.exp).toBe(now + STATE_TTL_MS);
  });

  it("refuses a value whose payload was changed", () => {
    const state = encodeState({ uid: "user-1", nonce: "nonce-1" }, SECRET);
    const [payload, signature] = state.split(".");
    const other = encodeState({ uid: "user-2", nonce: "nonce-1" }, SECRET).split(".")[0];
    expect(() => decodeState(`${other}.${signature}`, SECRET)).toThrowError(/changed/);
    expect(() => decodeState(`${payload}.${signature}x`, SECRET)).toThrowError();
  });

  it("refuses a value signed with another secret", () => {
    const state = encodeState({ uid: "user-1", nonce: "nonce-1" }, SECRET);
    const error = (() => {
      try {
        decodeState(state, "a-different-secret");
        return null;
      } catch (cause) {
        return cause;
      }
    })();
    expect(error?.code).toBe("state/bad");
  });

  it("refuses a value with no signature at all", () => {
    for (const bad of ["", ".", "only-a-payload", "abc."]) {
      expect(() => decodeState(bad, SECRET)).toThrowError();
    }
  });

  it("expires after five minutes", () => {
    const now = 1_760_000_000_000;
    const state = encodeState({ uid: "user-1", nonce: "nonce-1" }, SECRET, { now });
    expect(decodeState(state, SECRET, { now: now + STATE_TTL_MS - 1 }).uid).toBe("user-1");
    let code = "";
    try {
      decodeState(state, SECRET, { now: now + STATE_TTL_MS });
    } catch (cause) {
      code = cause.code;
    }
    expect(code).toBe("state/expired");
  });

  it("needs a uid, a nonce and a secret", () => {
    expect(() => encodeState({ nonce: "n" }, SECRET)).toThrowError();
    expect(() => encodeState({ uid: "u" }, SECRET)).toThrowError();
    expect(() => encodeState({ uid: "u", nonce: "n" }, "")).toThrowError();
  });

  it("makes a different nonce every time", () => {
    const nonces = new Set(Array.from({ length: 20 }, () => newNonce()));
    expect(nonces.size).toBe(20);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
