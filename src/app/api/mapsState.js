// Whether Google Maps can be used right now. Pure detection plus one shared, reactive state.
// "ready" | "no-key" | "failed" | "loading"
import { ref } from "vue";

// A missing, blank or placeholder key counts as no key at all.
export function hasMapsKey(key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
  const value = typeof key === "string" ? key.trim() : "";
  if (!value) return false;
  if (/^paste/i.test(value)) return false;
  if (value.toLowerCase().includes("your-google-maps")) return false;
  return true;
}

export const mapsState = ref(hasMapsKey() ? "loading" : "no-key");

export function setMapsState(next) {
  mapsState.value = next;
}

// Re-read the key. A previous "failed" or "ready" is kept while a key is still present.
export function syncMapsState() {
  if (!hasMapsKey()) mapsState.value = "no-key";
  else if (mapsState.value === "no-key") mapsState.value = "loading";
  installAuthHook();
  return mapsState.value;
}

export function resetMapsState() {
  mapsState.value = hasMapsKey() ? "loading" : "no-key";
}

// Google calls window.gm_authFailure when the key is rejected (bad key, billing, API off).
let hooked = false;
export function installAuthHook() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  const previous = window.gm_authFailure;
  window.gm_authFailure = () => {
    mapsState.value = "failed";
    if (typeof previous === "function") previous();
  };
}

export function resetAuthHookForTests() {
  hooked = false;
}
