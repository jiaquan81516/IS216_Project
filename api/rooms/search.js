import { requireUser } from "../_lib/auth.js";
import { allowMethod, fail, ok } from "../_lib/respond.js";
import { oneMapToken } from "../_lib/onemap.js";

// Place suggestions for the address picker: a name, street or postal code in, up to six
// Singapore places out. Any signed in user may search; the OneMap token stays on the server.
const MAX_RESULTS = 6;
const clean = (value) => (value && String(value).trim().toUpperCase() !== "NIL" ? String(value).trim() : "");

export default async function handler(req, res) {
  if (!allowMethod(req, res, "GET")) return;
  try {
    await requireUser(req);
    const text = String(req.query?.q ?? "").trim();
    if (text.length < 3 || text.length > 100) {
      return fail(res, 400, "rooms/search-text", "Type at least three characters to search.");
    }
    // OneMap's search is open to everyone. Send the token when there is one, and if that is
    // refused (for example it has expired) try again without it.
    const token = await oneMapToken();
    const query = new URLSearchParams({ searchVal: text, returnGeom: "Y", getAddrDetails: "Y", pageNum: "1" });
    const search = async (headers) => {
      const response = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?${query}`, {
        headers, signal: AbortSignal.timeout(10000),
      });
      const body = await response.json();
      return response.ok && !body.error ? body : null;
    };
    const data = (token && (await search({ Authorization: token }))) || (await search({}));
    if (!data) {
      return fail(res, 502, "rooms/location-unavailable", "OneMap search failed. Please try again in a moment.");
    }
    const seen = new Set();
    const places = [];
    for (const row of Array.isArray(data.results) ? data.results : []) {
      const lat = row.LATITUDE == null || row.LATITUDE === "" ? NaN : Number(row.LATITUDE);
      const lng = row.LONGITUDE == null || row.LONGITUDE === "" ? NaN : Number(row.LONGITUDE);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
      const address = clean(row.ADDRESS);
      const name = clean(row.BUILDING) || clean(row.SEARCHVAL) || address;
      const key = `${name}|${address}`;
      if (!address || seen.has(key)) continue;
      seen.add(key);
      places.push({ name, address, postalCode: clean(row.POSTAL), lat, lng });
      if (places.length === MAX_RESULTS) break;
    }
    ok(res, { places });
  } catch (error) {
    console.error("[rooms search]", error?.code || error?.name, error?.message);
    fail(res, error.status || 502, error.code || "rooms/location-unavailable",
      error.status === 401 ? "Sign in again to search for a place." : "Address search is unavailable. Please try again.");
  }
}
