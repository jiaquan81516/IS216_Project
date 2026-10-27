import { callServer } from "./server";

export function postalCodeFromAddress(address) {
  const matches = [...String(address ?? "").matchAll(/(?:^|[^0-9])([0-9]{6})(?![0-9])/g)];
  const codes = [...new Set(matches.map((match) => match[1]))];
  if (codes.length !== 1) {
    const error = new Error("Include one six-digit Singapore postal code in the address, for example Singapore 012345.");
    error.code = "rooms/postal-code";
    throw error;
  }
  return codes[0];
}

export async function resolveRoomLocation(address) {
  return lookupPostalCode(postalCodeFromAddress(address));
}

// Looks one postal code up on OneMap through our server. Returns { lat, lng } and, when
// OneMap names the place, { address, building }.
export async function lookupPostalCode(postalCode) {
  try {
    const result = await callServer(`rooms/location?postalCode=${postalCode}`, { method: "GET" });
    if (!Number.isFinite(result.lat) || !Number.isFinite(result.lng) ||
        result.lat < -90 || result.lat > 90 || result.lng < -180 || result.lng > 180) {
      throw new Error("No valid map location was returned for that postal code.");
    }
    return { lat: result.lat, lng: result.lng, address: result.address ?? "", building: result.building ?? "" };
  } catch (cause) {
    const error = new Error(cause.code === "server/unreachable"
      ? "The address lookup server is unavailable. Restart the dev server or check the API deployment."
      : cause.message || "The postal code could not be located. Please try again.");
    error.code = "rooms/location";
    throw error;
  }
}

// Place suggestions for text typed in the address picker: [{ name, address, postalCode, lat, lng }].
// OneMap's search is public, so the browser asks it directly; that works without our server or
// any token. If that fails (offline, blocked), our own server endpoint is tried next.
const ONEMAP_SEARCH = "https://www.onemap.gov.sg/api/common/elastic/search";
const clean = (value) => (value && String(value).trim().toUpperCase() !== "NIL" ? String(value).trim() : "");

export function placesFromOneMap(results, limit = 6) {
  const seen = new Set();
  const places = [];
  for (const row of Array.isArray(results) ? results : []) {
    const lat = row.LATITUDE == null || row.LATITUDE === "" ? NaN : Number(row.LATITUDE);
    const lng = row.LONGITUDE == null || row.LONGITUDE === "" ? NaN : Number(row.LONGITUDE);
    const address = clean(row.ADDRESS);
    if (!address || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const name = clean(row.BUILDING) || clean(row.SEARCHVAL) || address;
    const key = `${name}|${address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({ name, address, postalCode: clean(row.POSTAL), lat, lng });
    if (places.length === limit) break;
  }
  return places;
}

async function searchOneMapDirect(text) {
  const query = new URLSearchParams({ searchVal: text, returnGeom: "Y", getAddrDetails: "Y", pageNum: "1" });
  const response = await fetch(`${ONEMAP_SEARCH}?${query}`, { signal: AbortSignal.timeout(8000) });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error("OneMap search was refused.");
  return placesFromOneMap(data.results);
}

export async function searchPlaces(text) {
  const term = String(text).trim();
  try {
    return await searchOneMapDirect(term);
  } catch {
    const result = await callServer(`rooms/search?q=${encodeURIComponent(term)}`, { method: "GET" });
    return Array.isArray(result.places) ? result.places : [];
  }
}
