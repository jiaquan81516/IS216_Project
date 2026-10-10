// Pure helpers for the pumping room directory.
import { toDate } from "./entryHelpers";

const query = (room) =>
  encodeURIComponent(Number.isFinite(room.lat) && Number.isFinite(room.lng) ? `${room.lat},${room.lng}` : `${room.name}, ${room.address}`);

export function mapEmbedUrl(room) {
  return "https://www.google.com/maps?q=" + query(room) + "&output=embed";
}

export function mapOpenUrl(room) {
  return "https://www.google.com/maps/search/?api=1&query=" + query(room);
}

export function statusText(room) {
  if (room.status !== "verified") return "Needs verification";
  const d = room.verifiedDaysAgo;
  if (d === 0) return "Verified today";
  if (d === 1) return "Verified 1 day ago";
  return `Verified ${d ?? 0} days ago`;
}

// status: "all" | "verified" | "needs verification". Features combine with AND.
export function filterRooms(rooms, { status = "all", features = [], search = "" } = {}) {
  const q = String(search).trim().toLowerCase();
  return rooms.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (!features.every((f) => r.features.includes(f))) return false;
    if (q && !`${r.name} ${r.address}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

// Firestore keeps features as a map so a rule can check them; the UI uses labels. These two
// helpers are the only place the two shapes meet.
export const ROOM_FEATURES = Object.freeze([
  ["chair", "Chair"],
  ["power", "Power outlet"],
  ["lockable", "Lockable"],
  ["sink", "Sink"],
  ["stroller", "Stroller access"],
]);

export function featureLabels(features) {
  if (Array.isArray(features)) return features.map(String);
  const map = features && typeof features === "object" ? features : {};
  return ROOM_FEATURES.filter(([key]) => map[key] === true).map(([, label]) => label);
}

export function featureMap(labels = []) {
  const chosen = new Set(labels.map(String));
  return Object.fromEntries(ROOM_FEATURES.map(([key, label]) => [key, chosen.has(label)]));
}

const DAY_MS = 86400000;

// Whole days between a timestamp and now, or null when there is none.
export function daysSince(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return null;
  const days = Math.floor((toDate(now).getTime() - date.getTime()) / DAY_MS);
  return days < 0 ? 0 : days;
}

// A pumpingRooms document becomes the shape the list, the filters and statusText already
// use. Firestore stores "unverified"; the UI has always said "needs verification".
export function roomView(id, data = {}, now = new Date()) {
  const verified = data.status === "verified";
  return {
    id,
    name: String(data.name ?? ""),
    address: String(data.address ?? ""),
    details: String(data.details ?? ""),
    placeId: String(data.placeId ?? ""),
    lat: Number.isFinite(data.lat) ? data.lat : null,
    lng: Number.isFinite(data.lng) ? data.lng : null,
    region: data.region ?? null,
    features: featureLabels(data.features),
    status: verified ? "verified" : "needs verification",
    verifiedAt: data.verifiedAt ?? null,
    verifiedDaysAgo: verified ? daysSince(data.verifiedAt, now) : null,
    createdBy: data.createdBy ?? null,
    seed: false,
  };
}
