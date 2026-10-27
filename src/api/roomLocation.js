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
