// The localStorage keys the shared App pages used before Firestore. They are only read once,
// to lift an old plan into the household, and then removed.
export const LEGACY_ROTA_KEY = "nt.app.rota";
export const LEGACY_CALENDAR_KEY = "nt.app.calendar";
export const LEGACY_RTW_KEY = "nt.app.rtw";

// Returns the parsed payload, or null when there is nothing usable.
export function readLegacy(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

export function clearLegacy(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage can be blocked. The payload is then read again next time and the household
    // already has data, so nothing is written twice.
  }
}

// Maps an old "me" or "partner" owner onto a user id. Returns null when that person is
// unknown, so the caller can leave the field out.
export function legacyOwner(who, meUid, partnerUid) {
  if (who === "both") return "both";
  if (who === "open") return "open";
  if (who === "me") return meUid || null;
  if (who === "partner") return partnerUid || null;
  return null;
}
