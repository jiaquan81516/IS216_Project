import { hasMapsKey, installAuthHook, setMapsState, mapsState } from "./mapsState";

export { hasMapsKey, mapsState };

export const MAPS_LOAD_TIMEOUT_MS = 10000;

let mapsPromise;

export function loadGoogleMaps() {
  if (globalThis.google?.maps?.importLibrary) return Promise.resolve(globalThis.google.maps);
  if (mapsPromise) return mapsPromise;

  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!hasMapsKey(key)) {
    setMapsState("no-key");
    return Promise.reject(new Error("Google Maps API key is not configured."));
  }
  installAuthHook();

  mapsPromise = new Promise((resolve, reject) => {
    const callback = `__nurtureTrackMapsReady${Date.now()}`;
    const timer = setTimeout(() => {
      delete globalThis[callback];
      mapsPromise = null;
      setMapsState("failed");
      reject(new Error("Google Maps took too long to load."));
    }, MAPS_LOAD_TIMEOUT_MS);
    globalThis[callback] = () => {
      clearTimeout(timer);
      delete globalThis[callback];
      if (mapsState.value !== "failed") setMapsState("ready");
      resolve(globalThis.google.maps);
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=places&v=weekly&callback=${callback}`;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      setMapsState("failed");
      delete globalThis[callback];
      mapsPromise = null;
      reject(new Error("Google Maps could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return mapsPromise;
}
