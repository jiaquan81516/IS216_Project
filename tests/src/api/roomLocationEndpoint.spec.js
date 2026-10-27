// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("../../../api/_lib/auth.js", () => ({ requireUser: mocks.requireUser }));
import handler from "../../../api/rooms/location.js";
let fetchMock;
beforeEach(() => {
  mocks.requireUser.mockResolvedValue({ admin: true });
  vi.stubEnv("ONEMAP_TOKEN", "test-token");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function request(postalCode = "012345") {
  let body;
  const res = { setHeader: vi.fn(), end: (value) => { body = JSON.parse(value); } };
  await handler({ method: "GET", query: { postalCode } }, res);
  return { status: res.statusCode, body };
}
it("uses exact postal matches and returns numeric coordinates", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: [
    { POSTAL: "654321", LATITUDE: "2", LONGITUDE: "104" },
    { POSTAL: "012345", LATITUDE: "1.3", LONGITUDE: "103.8" },
  ] }) });
  expect((await request()).body).toEqual({ ok: true, postalCode: "012345", lat: 1.3, lng: 103.8 });
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("searchVal=012345"), expect.objectContaining({ headers: { Authorization: "test-token" } }));
});
it("requires an admin", async () => {
  mocks.requireUser.mockResolvedValue({ admin: false });
  expect((await request()).status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("rejects malformed postal codes", async () => {
  expect((await request("12345")).status).toBe(400);
});
it("explains missing credentials", async () => {
  vi.stubEnv("ONEMAP_TOKEN", "");
  expect((await request()).body.code).toBe("rooms/location-config");
});
it("handles expired tokens in HTTP 200 responses", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: "expired token" }) });
  expect((await request()).status).toBe(502);
});
it("rejects missing or ambiguous map locations", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
  expect((await request()).body.code).toBe("rooms/location-not-found");
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [
    { POSTAL: "012345", LATITUDE: "1.3", LONGITUDE: "103.8" },
    { POSTAL: "012345", LATITUDE: "1.4", LONGITUDE: "103.9" },
  ] }) });
  expect((await request()).body.code).toBe("rooms/location-ambiguous");
});
