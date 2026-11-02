// Pure helpers for the pumping rooms map page: distance, sorting, clustering, merging and
// filtering. Nothing here touches the DOM or a map, so all of it is unit tested.

export const DEFAULT_CENTER = Object.freeze({ lat: 1.3521, lng: 103.8198 });
const EARTH_RADIUS_M = 6371008.8;

export function hasCoords(point) {
  return Number.isFinite(point?.lat) && Number.isFinite(point?.lng);
}

// Great circle distance in metres.
export function haversineMeters(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// "850 m" under a kilometre (to the nearest 10 m), otherwise "2.4 km".
export function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) return "";
  const rounded = Math.round(meters / 10) * 10;
  if (rounded < 1000) return `${rounded} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// Adds `distance` (metres, or null) and sorts nearest first. Rooms with no coordinates, or a
// missing origin, go last in name order.
export function sortByDistance(rooms, origin) {
  const withDistance = rooms.map((room) => ({
    ...room,
    distance: hasCoords(origin) && hasCoords(room) ? haversineMeters(origin, room) : null,
  }));
  return withDistance.sort((a, b) => {
    if (a.distance === null && b.distance === null) return a.name.localeCompare(b.name);
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance || a.name.localeCompare(b.name);
  });
}

// Names are compared without filler words, so "Raffles City Family Room" matches "Raffles City".
export function normalizeName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(the|mall|shopping|centre|center|nursing|room|family|lactation|mothers?)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

export function isDuplicate(a, b) {
  if (a.placeId && a.placeId === b.placeId) return true;
  if (!hasCoords(a) || !hasCoords(b)) return false;
  if (haversineMeters(a, b) > 100) return false;
  const x = normalizeName(a.name);
  const y = normalizeName(b.name);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

// Community rooms from the database come first, then the directory rooms (BMSG), then the seed
// examples. A later entry is dropped when it duplicates an earlier one (same placeId, or a near
// identical name within 100 m), so a database room always beats a directory listing and a
// directory listing beats a sample.
export function mergeRooms(community, listed) {
  const real = community.filter((room) => !room.seed);
  const seeds = community.filter((room) => room.seed);
  const out = [];
  for (const room of [...real, ...listed, ...seeds]) {
    if (out.some((kept) => isDuplicate(kept, room))) continue;
    out.push(room);
  }
  return out;
}

// Rooms from the store become page rooms. Seed rooms are examples: they get coordinates and are
// never shown as verified, because they are not database rows anybody confirmed.
export function prepareCommunityRooms(rooms, seedCoords = {}) {
  return rooms.map((room) =>
    room.seed
      ? { ...room, ...seedCoords[room.id], kind: "seed", status: "needs verification", verifiedDaysAgo: null }
      : { ...room, kind: "community" },
  );
}

export function isVerified(room) {
  return !room.seed && room.status === "verified";
}

// The text under the room name. Only a room with status verified (a database room or a BMSG
// directory room) says "Verified".
export function verificationText(room) {
  if (room.approval === "pending") return "Pending review";
  if (room.seed) return "Example room, not confirmed";
  if (!isVerified(room)) return "Needs verification";
  const days = room.verifiedDaysAgo;
  if (days === 0) return "Verified today";
  if (days === 1) return "Verified 1 day ago";
  return `Verified ${days ?? 0} days ago`;
}

export function applyFilters(rooms, { text = "", features = [], verifiedOnly = false } = {}) {
  const q = String(text).trim().toLowerCase();
  return rooms.filter((room) => {
    if (verifiedOnly && !isVerified(room)) return false;
    if (!features.every((f) => room.features.includes(f))) return false;
    if (q && !`${room.name} ${room.address} ${room.details ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function activeFilterCount({ features = [], verifiedOnly = false } = {}) {
  return features.length + (verifiedOnly ? 1 : 0);
}

