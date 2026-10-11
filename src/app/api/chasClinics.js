// Lazy loader for the CHAS clinic snapshot. The JSON is only imported when the Clinics view
// opens, so it never weighs on the Emergency view or the rest of the app.
import { clinicToPlace } from "@/app/api/kidsCareHelpers";

const EMPTY = Object.freeze({ meta: { retrievedAt: null, count: 0 }, clinics: [] });

export function shapeSnapshot(data) {
  const meta = { ...EMPTY.meta, ...(data?.meta ?? {}) };
  const seen = new Set();
  const clinics = [];
  for (const raw of Array.isArray(data?.clinics) ? data.clinics : []) {
    if (!raw || !raw.id || !String(raw.name ?? "").trim()) continue;
    const place = clinicToPlace(raw);
    if (seen.has(place.id)) continue;
    seen.add(place.id);
    clinics.push(place);
  }
  return { meta, clinics };
}

export async function loadChasClinics(loader = () => import("@/app/data/chasClinics.json")) {
  try {
    const mod = await loader();
    return shapeSnapshot(mod?.default ?? mod);
  } catch {
    return { meta: { ...EMPTY.meta }, clinics: [], failed: true };
  }
}
