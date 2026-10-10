import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callServer,
  deleteAccount,
  describeServerError,
  describeSyncResult,
  disconnectGoogle,
  isServerUnreachable,
  SERVER_UNREACHABLE,
  startGoogleConnect,
  syncGoogleCalendar,
} from "@/app/api/server";

function answer({ status = 200, body = {}, text = false } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (text) throw new Error("not json");
      return body;
    },
  };
}

let assigned;
const navigate = (url) => assigned.push(url);

beforeEach(() => {
  assigned = [];
  vi.stubGlobal("fetch", vi.fn(async () => answer()));
});
afterEach(() => vi.unstubAllGlobals());

describe("callServer", () => {
  it("posts JSON to /api/<path> and returns the answer", async () => {
    fetch.mockResolvedValue(answer({ body: { ok: true } }));
    const data = await callServer("account/delete", { body: { uid: "u1" } });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("/api/account/delete");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({ uid: "u1" });
    expect(data).toEqual({ ok: true });
  });

  it("treats a missing function as unreachable rather than an error page", async () => {
    for (const status of [404, 405, 501]) {
      fetch.mockResolvedValue(answer({ status }));
      await expect(callServer("account/delete")).rejects.toMatchObject({ code: SERVER_UNREACHABLE });
    }
  });

  it("treats a network failure as unreachable", async () => {
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await callServer("account/delete").catch((e) => e);
    expect(isServerUnreachable(error)).toBe(true);
  });

  it("treats the dev server answering the app shell as unreachable", async () => {
    fetch.mockResolvedValue(answer({ text: true }));
    await expect(callServer("account/delete")).rejects.toMatchObject({ code: SERVER_UNREACHABLE });
  });

  it("passes on a real server error with its code", async () => {
    fetch.mockResolvedValue(answer({ status: 500, body: { code: "account/busy", message: "Try later." } }));
    await expect(callServer("account/delete")).rejects.toMatchObject({
      code: "account/busy",
      message: "Try later.",
      status: 500,
    });
  });
});

describe("the endpoints", () => {
  it("sends the browser to the URL the server gives back", async () => {
    fetch.mockResolvedValue(answer({ body: { url: "https://accounts.google.com/o/oauth2/auth?x=1" } }));
    const target = await startGoogleConnect(navigate);
    expect(fetch.mock.calls[0][1].method).toBe("GET");
    expect(target).toBe("https://accounts.google.com/o/oauth2/auth?x=1");
    expect(assigned).toEqual(["https://accounts.google.com/o/oauth2/auth?x=1"]);
  });

  it("falls back to the endpoint itself, which redirects", async () => {
    fetch.mockResolvedValue(answer({ body: {} }));
    expect(await startGoogleConnect(navigate)).toBe("/api/google/connect");
    expect(assigned).toEqual(["/api/google/connect"]);
  });

  it("posts the disconnect and the deletion", async () => {
    await disconnectGoogle();
    expect(fetch.mock.calls[0][0]).toBe("/api/google/disconnect");
    await deleteAccount();
    expect(fetch.mock.calls[1][0]).toBe("/api/account/delete");
  });
});

describe("describeServerError", () => {
  it("names the missing part in plain words", () => {
    const missing = { code: SERVER_UNREACHABLE };
    expect(describeServerError(missing, "calendar")).toBe("The calendar server is not set up yet.");
    expect(describeServerError(missing)).toBe("The server is not set up yet.");
  });
  it("shows a real server message as it came", () => {
    expect(describeServerError({ code: "account/busy", message: "Try later." })).toBe("Try later.");
    expect(describeServerError(null)).toBe("Something went wrong. Please try again.");
  });
});

describe("the Authorization header", () => {
  it("sends the signed in user's ID token as a bearer token", async () => {
    await callServer("account/delete", { getToken: async () => "id-token-123" });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer id-token-123");
  });

  it("sends no header at all when nobody is signed in", async () => {
    await callServer("account/delete", { getToken: async () => null });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("keeps the Accept and Content-Type headers beside it", async () => {
    await callServer("google/sync", { body: { householdId: "h1" }, getToken: async () => "t" });
    const headers = fetch.mock.calls[0][1].headers;
    expect(headers.Accept).toBe("application/json");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer t");
  });

  it("still asks for a token on a GET, which carries no body", async () => {
    const asked = [];
    await callServer("google/connect", {
      method: "GET",
      getToken: async () => {
        asked.push(1);
        return "t";
      },
    });
    expect(asked.length).toBe(1);
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
  });

  it("asks for the token once and reuses it for the connect fallback URL", async () => {
    fetch.mockResolvedValue(answer({ body: {} }));
    let calls = 0;
    const target = await startGoogleConnect(navigate, {
      getToken: async () => {
        calls += 1;
        return "tok en";
      },
    });
    expect(calls).toBe(1);
    expect(target).toBe("/api/google/connect?token=tok%20en");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer tok en");
  });

  it("prefers the URL the server gave over the fallback", async () => {
    fetch.mockResolvedValue(answer({ body: { url: "https://accounts.google.com/o/oauth2/auth?x=1" } }));
    const target = await startGoogleConnect(navigate, { getToken: async () => "t" });
    expect(target).toBe("https://accounts.google.com/o/oauth2/auth?x=1");
  });
});

describe("syncing the calendar", () => {
  it("posts the household id", async () => {
    fetch.mockResolvedValue(answer({ body: { ok: true, pushed: 2, pulled: 1, errors: [] } }));
    const result = await syncGoogleCalendar("house-1");
    expect(fetch.mock.calls[0][0]).toBe("/api/google/sync");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ householdId: "house-1" });
    expect(result.pushed).toBe(2);
  });

  it("says what happened in one plain line", () => {
    expect(describeSyncResult({ pushed: 2, pulled: 1, errors: [] })).toBe("2 sent to Google, 1 brought in.");
    expect(describeSyncResult({ pushed: 3, pulled: 0, errors: [] })).toBe("3 sent to Google.");
    expect(describeSyncResult({ pushed: 0, pulled: 4, errors: [] })).toBe("4 brought in.");
    expect(describeSyncResult({ pushed: 0, pulled: 0, errors: [] })).toBe("Everything was already in step.");
    expect(describeSyncResult(null)).toBe("Everything was already in step.");
  });

  it("owns up when some events could not be synced", () => {
    expect(describeSyncResult({ pushed: 1, pulled: 0, errors: ["one failed"] })).toBe(
      "1 sent to Google. Some events could not be synced.",
    );
    expect(describeSyncResult({ pushed: 0, pulled: 0, errors: ["one failed"] })).toBe(
      "Nothing changed, and some events could not be synced.",
    );
  });
});
