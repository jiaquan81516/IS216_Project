// Pure helpers for the kids care page: links, text filter, paging and labels.
// Distance and sorting are reused from mapHelpers (sortByDistance, formatDistance).
import { mapsDirectionsLink, mapsSearchLink } from "@/app/api/roomHelpers";

export const KIDS_VIEWS = Object.freeze(["emergency", "clinics"]);
export const DEFAULT_KIDS_VIEW = "emergency";
export const SAVED_KIDS_KEY = "nurturetrack:saved-kids-care";
export const PAGE_SIZE = 50;

export function normalizeView(value) {
  const v = Array.isArray(value) ? value[0] : value;
  return KIDS_VIEWS.includes(v) ? v : DEFAULT_KIDS_VIEW;
}

// Key free Google Maps embed. With no place it shows Singapore.
export function embedUrl(place) {
  const q = place ? [place.name, place.address].filter(Boolean).join(", ") : "Singapore";
  const zoom = place ? 15 : 11;
  return `https://www.google.com/maps?q=${encodeURIComponent(q || "Singapore")}&output=embed&z=${zoom}`;
}

export { mapsDirectionsLink, mapsSearchLink };

// "6357 8754" becomes tel:+6563578754. Anything that does not look like a number gives "".
export function telHref(phone) {
  const digits = String(phone ?? "").replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (digits.length === 8) return `tel:+65${digits}`;
  if (digits.length === 10 && digits.startsWith("65")) return `tel:+${digits}`;
  return /^\d{3,}$/.test(digits) ? `tel:${digits}` : "";
}

// Search by name, address and postal code. Dental clinics are hidden unless asked for.
export function filterPlaces(places, { text = "", includeDental = false } = {}) {
  const q = String(text).trim().toLowerCase();
  return places.filter((p) => {
    if (p.type === "dental" && !includeDental) return false;
    if (!q) return true;
    return `${p.name} ${p.address} ${p.postal ?? ""}`.toLowerCase().includes(q);
  });
}

export function byName(places) {
  return [...places].sort((a, b) => a.name.localeCompare(b.name));
}

export function countText(n, label) {
  return `${n} ${n === 1 ? "place" : "places"} ${label}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return "";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

// A compact clinic record from chasClinics.json becomes a card shaped place.
export function clinicToPlace(c) {
  return {
    id: `chas-${c.id}`,
    name: c.name,
    address: c.address,
    postal: c.postal ?? "",
    lat: Number.isFinite(c.lat) ? c.lat : null,
    lng: Number.isFinite(c.lng) ? c.lng : null,
    phone: c.phone || null,
    type: c.type === "dental" ? "dental" : "gp",
    kind: "chas",
  };
}
