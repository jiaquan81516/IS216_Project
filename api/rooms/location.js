/* global process */
import { requireUser } from "../_lib/auth.js";
import { allowMethod, fail, ok } from "../_lib/respond.js";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "GET")) return;
  try {
    const user = await requireUser(req);
    if (user.admin !== true) return fail(res, 403, "permission-denied", "Only admins can look up room locations.");
    const postalCode = req.query?.postalCode;
    if (typeof postalCode !== "string" || !/^[0-9]{6}$/.test(postalCode)) {
      return fail(res, 400, "rooms/postal-code", "Enter a six-digit postal code in the address.");
    }
    const token = process.env.ONEMAP_TOKEN?.trim();
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
    ok(res, { postalCode, ...points[0] });
  } catch (error) {
    fail(res, error.status || 502, error.code || "rooms/location-unavailable",
      error.status === 401 ? "Sign in again to look up a room location." : "Address lookup is unavailable. Please try again.");
  }
}
