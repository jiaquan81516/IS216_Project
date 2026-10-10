// Loads the mall entries shown on the pumping rooms map. A mall listing does not prove that the
// mall has a pumping room, so these are labelled "not confirmed" and are never verified.
import { FALLBACK_MALLS, MALLS_SOURCE, SEED_COORDS } from "@/app/data/malls.fallback";

export { SEED_COORDS };

export const MALL_LABEL = "Mall, nursing room not confirmed";

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Turns one raw mall record into the room shape used by the list and the map.
export function mallToRoom(mall, source = MALLS_SOURCE) {
  const lat = Number(mall?.lat);
  const lng = Number(mall?.lng);
  const name = String(mall?.name ?? "").trim();
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: `mall-${slug(name)}`,
    name,
    address: String(mall.address ?? ""),
    details: "Shopping mall",
    placeId: "",
    lat,
    lng,
    features: [],
    status: "mall",
    verifiedDaysAgo: null,
    seed: false,
    kind: "mall",
    source: mall.source || source.name,
    sourceUrl: mall.sourceUrl || source.url,
  };
}

// The data is a static module, so there is no network call. The records can be replaced by
// passing a list (tests do this), or later by a generated JSON file.
export async function loadMalls(records = FALLBACK_MALLS, source = MALLS_SOURCE) {
  const seen = new Set();
  const rooms = [];
  for (const record of records) {
    const room = mallToRoom(record, source);
    if (!room || seen.has(room.id)) continue;
    seen.add(room.id);
    rooms.push(room);
  }
  return rooms;
}
