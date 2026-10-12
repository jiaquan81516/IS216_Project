import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MODULE = "@/api/googleCalendarClient";

function installGoogle({ response = { access_token: "tok-1", expires_in: 3600 }, granted = true } = {}) {
  const requests = [];
  const oauth2 = {
    initTokenClient: vi.fn((config) => ({
      requestAccessToken: vi.fn((options) => {
        requests.push(options);
        queueMicrotask(() => config.callback(response));
      }),
    })),
    hasGrantedAllScopes: vi.fn(() => granted),
    revoke: vi.fn((token, done) => done()),
  };
  window.google = { accounts: { oauth2 } };
  return { oauth2, requests };
}

const jsonResponse = (body, status = 200) =>
  Promise.resolve({ ok: status < 300, status, json: async () => body });

let client;
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("VITE_GOOGLE_OAUTH_CLIENT_ID", "123-abc.apps.googleusercontent.com");
  localStorage.clear();
  client = await import(MODULE);
  client.resetClientForTests();
});
afterEach(() => {
  delete window.google;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("connect", () => {
  it("asks for consent the first time and the right scope, then reads the primary calendar", async () => {
    const { oauth2, requests } = installGoogle();
    const fetchMock = vi.fn(() => jsonResponse({ summary: "dad@example.com" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await client.connect();
    expect(result.email).toBe("dad@example.com");
    expect(oauth2.initTokenClient.mock.calls[0][0]).toMatchObject({
      client_id: "123-abc.apps.googleusercontent.com",
      scope: "https://www.googleapis.com/auth/calendar.events",
    });
    expect(requests[0]).toEqual({ prompt: "consent" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&fields=summary");
    expect(init.headers.Authorization).toBe("Bearer tok-1");
  });

  it("does not ask for consent again on a later connect", async () => {
    const { requests } = installGoogle();
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ summary: "a@b.c" })));
    await client.connect();
    client.resetClientForTests();
    await client.connect();
    expect(requests[1]).toEqual({ prompt: "" });
  });

  it("never stores the token", async () => {
    installGoogle();
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ summary: "a@b.c" })));
    await client.connect();
    const dump = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(dump).not.toContain("tok-1");
  });

  it("maps a denied response and a missing scope", async () => {
    installGoogle({ response: { error: "access_denied" } });
    await expect(client.connect()).rejects.toMatchObject({ code: "denied" });
    client.resetClientForTests();
    installGoogle({ granted: false });
    await expect(client.connect()).rejects.toMatchObject({ code: "scope" });
  });

  it("fails clearly when no client id is set", async () => {
    vi.stubEnv("VITE_GOOGLE_OAUTH_CLIENT_ID", "PASTE_HERE");
    installGoogle();
    await expect(client.connect()).rejects.toMatchObject({ code: "config" });
  });
});

describe("script loading", () => {
  it("times out after 10 seconds with a clear error", async () => {
    vi.useFakeTimers();
    const promise = client.loadGis();
    const assertion = expect(promise).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(10001);
    await assertion;
    vi.useRealTimers();
    document.head.querySelectorAll("script[src*='gsi']").forEach((s) => s.remove());
  });

  it("adds the script once and reports a load error", async () => {
    const first = client.loadGis();
    const second = client.loadGis();
    const scripts = document.head.querySelectorAll("script[src='https://accounts.google.com/gsi/client']");
    expect(scripts).toHaveLength(1);
    scripts[0].onerror();
    await expect(first).rejects.toMatchObject({ code: "script" });
    await expect(second).rejects.toMatchObject({ code: "script" });
  });
});

describe("calendarFetch", () => {
  async function connected() {
    installGoogle();
    const fetchMock = vi.fn(() => jsonResponse({ summary: "a@b.c" }));
    vi.stubGlobal("fetch", fetchMock);
    await client.connect();
    fetchMock.mockClear();
    return fetchMock;
  }

  it("sends JSON bodies with the bearer token to googleapis.com only", async () => {
    const fetchMock = await connected();
    fetchMock.mockImplementation(() => jsonResponse({ id: "x" }));
    await client.calendarFetch("/calendars/primary/events", { method: "POST", body: { summary: "A" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.startsWith("https://www.googleapis.com/")).toBe(true);
    expect(init.body).toBe('{"summary":"A"}');
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("rejects a path that is not relative to the API", async () => {
    await connected();
    await expect(client.calendarFetch("https://evil.example/x")).rejects.toBeTruthy();
  });

  it.each([
    [401, "reconnect"],
    [403, "forbidden"],
    [429, "rate"],
  ])("maps HTTP %i to %s", async (status, code) => {
    const fetchMock = await connected();
    fetchMock.mockImplementation(() => jsonResponse({ error: {} }, status));
    await expect(client.calendarFetch("/calendars/primary")).rejects.toMatchObject({ code });
  });

  it("maps a network failure", async () => {
    const fetchMock = await connected();
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("offline")));
    await expect(client.calendarFetch("/calendars/primary")).rejects.toMatchObject({ code: "network" });
  });

  it("asks again silently when the token has expired", async () => {
    const { requests } = installGoogle({ response: { access_token: "tok-1", expires_in: 1 } });
    const fetchMock = vi.fn(() => jsonResponse({ summary: "a@b.c" }));
    vi.stubGlobal("fetch", fetchMock);
    await client.connect();
    await client.calendarFetch("/calendars/primary");
    expect(requests.map((r) => r.prompt)).toEqual(["consent", "", ""].slice(0, requests.length));
    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(requests[requests.length - 1]).toEqual({ prompt: "" });
  });

  it("is not connected before connect()", async () => {
    await expect(client.calendarFetch("/calendars/primary")).rejects.toMatchObject({ code: "notconnected" });
  });
});

describe("disconnect", () => {
  it("revokes the token and forgets it", async () => {
    const { oauth2 } = installGoogle();
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ summary: "a@b.c" })));
    await client.connect();
    await client.disconnect();
    expect(oauth2.revoke).toHaveBeenCalledWith("tok-1", expect.any(Function));
    expect(client.hasToken()).toBe(false);
  });
});

describe("403 shows what Google said", () => {
  it("adds Google's reason and message to the forbidden text", async () => {
    const { mapHttpError } = await import("@/app/utils/googleCalendarClientHelpers");
    const err = mapHttpError(403, { error: { message: "Google Calendar API has not been used in project 123 before.", errors: [{ reason: "accessNotConfigured" }] } });
    expect(err.code).toBe("forbidden");
    expect(err.message).toContain("Google said: accessNotConfigured: Google Calendar API has not been used");
  });

  it("keeps the plain text when there is no body", async () => {
    const { mapHttpError } = await import("@/app/utils/googleCalendarClientHelpers");
    expect(mapHttpError(403, null).message).not.toContain("Google said");
  });
});
