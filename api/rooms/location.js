/* global process */
import { requireUser } from "../_lib/auth.js";
import { allowMethod, fail, ok } from "../_lib/respond.js";
import { oneMapToken } from "../_lib/onemap.js";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "GET")) return;
  try {
    // Any signed in user may look up a postal code, so parents can add a room by postal code.
    await requireUser(req);
    const postalCode = req.query?.postalCode;
    if (typeof postalCode !== "string" || !/^[0-9]{6}$/.test(postalCode)) {
      return fail(res, 400, "rooms/postal-code", "Enter a six-digit postal code in the address.");
    }
    const token = await oneMapToken();
    if (!token) return fail(res, 503, "rooms/location-config", "Address lookup needs a server-side ONEMAP_TOKEN. Ask the administrator to configure it.");
    const query = new URLSearchParams({ searchVal: postalCode, returnGeom: "Y", getAddrDetails: "Y", pageNum: "1" });
    const response = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?${query}`, {
      headers: { Authorization: token }, signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      return fail(res, 502, "rooms/location-unavailable", "OneMap lookup failed. Please retry or ask the administrator to check the OneMap token.");
    }
    const matches = (Array.isArray(data.results) ? data.results : []).filter((row) => String(row.POSTAL) === postalCode);
    const points = matches.flatMap((row) => {
      const lat = row.LATITUDE == null || row.LATITUDE === "" ? NaN : Number(row.LATITUDE);
      const lng = row.LONGITUDE == null || row.LONGITUDE === "" ? NaN : Number(row.LONGITUDE);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
        ? [{ lat, lng }] : [];
    });
    if (!points.length) return fail(res, 422, "rooms/location-not-found", "OneMap could not locate that postal code. Check the address and try again.");
    if (Number(data.totalNumPages) > 1 || points.some((point) => point.lat !== points[0].lat || point.lng !== points[0].lng)) {
      return fail(res, 422, "rooms/location-ambiguous", "That postal code has multiple map locations. Check that you entered the building's postal code.");
    }
    // The first match also names the place, so the form can fill in the address.
    const row = matches[0];
    const clean = (value) => (value && String(value).trim().toUpperCase() !== "NIL" ? String(value).trim() : "");
    const address = clean(row.ADDRESS);
    const building = clean(row.BUILDING);
    ok(res, { postalCode, ...points[0], ...(address ? { address } : {}), ...(building ? { building } : {}) });
  } catch (error) {
    console.error("[rooms location]", error?.code || error?.name, error?.message);
    fail(res, error.status || 502, error.code || "rooms/location-unavailable",
      error.status === 401 ? "Sign in again to look up a room location." : "Address lookup is unavailable. Please try again.");
  }
}
