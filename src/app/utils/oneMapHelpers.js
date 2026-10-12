// Pure helpers for OneMap (Singapore Land Authority). The embeddable map needs no key and no token.
export const ONEMAP_HOME_URL = "https://www.onemap.gov.sg/";
const EMBED_BASE = "https://www.onemap.gov.sg/amm/amm.html";

export const ONEMAP_CENTER = Object.freeze({ lat: 1.3521, lng: 103.8198 });
export const ONEMAP_ISLAND_ZOOM = 12;
export const ONEMAP_PLACE_ZOOM = 15;

const isPoint = (p) => Boolean(p) && Number.isFinite(p.lat) && Number.isFinite(p.lng);
const pair = (p) => `${p.lat},${p.lng}`;
const markerParam = (p) => `marker=latLng:${pair(p)}!colour:${p.colour || "red"}`;

// Whole island by default. A lat and lng gives one marker; a markers array gives one marker each.
export function oneMapEmbedUrl({ lat, lng, zoom, markers = [] } = {}) {
  const points = (Array.isArray(markers) ? markers : []).filter(isPoint);
  const single = isPoint({ lat, lng }) ? { lat, lng } : null;
  if (single && !points.length) points.push(single);
  const centre = single || (points.length === 1 ? points[0] : ONEMAP_CENTER);
  const level = Number.isFinite(zoom) ? zoom : points.length ? ONEMAP_PLACE_ZOOM : ONEMAP_ISLAND_ZOOM;
  const parts = ["mapStyle=Default", `zoomLevel=${level}`, `latLng=${pair(centre)}`, ...points.map(markerParam)];
  if (points.length) parts.push("popupWidth=200");
  return `${EMBED_BASE}?${parts.join("&")}`;
}

// No deep link is documented for the OneMap website, so the link opens the embed page itself, zoomed in.
export function oneMapPlaceUrl(lat, lng) {
  if (!isPoint({ lat, lng })) return "";
  return oneMapEmbedUrl({ lat, lng, zoom: 18 });
}
