// Loads the nursing rooms listed in the BMSG Nursing Room Directory (src/app/data/bmsgRooms.js)
// in the room shape used by the list and the map. They are shown as verified, with the source
// named on the card. They are static data, so there is no network call.
import { BMSG_ROOMS, BMSG_SOURCE } from "@/app/data/bmsgRooms";
import { daysSince } from "@/app/utils/roomHelpers";

// Turns one directory record into a page room, or null when it has no usable name or position.
export function bmsgToRoom(record, source = BMSG_SOURCE, now = new Date()) {
  const lat = Number(record?.lat);
  const lng = Number(record?.lng);
  const name = String(record?.name ?? "").trim();
  if (!record?.id || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const verifiedOn = record.verifiedOn || source.retrieved;
  return {
    id: String(record.id),
    name,
    address: String(record.address ?? ""),
    details: String(record.details ?? ""),
    placeId: "",
    lat,
    lng,
    features: [...(record.features ?? [])],
    facilities: [...(record.facilities ?? [])],
    feedback: String(record.feedback ?? ""),
    status: "verified",
    verifiedOn,
    verifiedDaysAgo: daysSince(new Date(`${verifiedOn}T00:00:00+08:00`), now) ?? 0,
    seed: false,
    kind: record.kind || "mall",
    source: record.source || source.name,
    sourceLabel: source.shortName,
    sourceUrl: record.sourceUrl || source.url,
  };
}

export async function loadBmsgRooms(records = BMSG_ROOMS, source = BMSG_SOURCE, now = new Date()) {
  const seen = new Set();
  const rooms = [];
  for (const record of records) {
    const room = bmsgToRoom(record, source, now);
    if (!room || seen.has(room.id)) continue;
    seen.add(room.id);
    rooms.push(room);
  }
  return rooms;
}
