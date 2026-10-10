let mapsPromise;

export function loadGoogleMaps() {
  if (globalThis.google?.maps?.importLibrary) return Promise.resolve(globalThis.google.maps);
  if (mapsPromise) return mapsPromise;

  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error("Google Maps API key is not configured."));

  mapsPromise = new Promise((resolve, reject) => {
    const callback = `__nurtureTrackMapsReady${Date.now()}`;
    globalThis[callback] = () => {
      delete globalThis[callback];
      resolve(globalThis.google.maps);
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=places&v=weekly&callback=${callback}`;
    script.async = true;
    script.onerror = () => {
      delete globalThis[callback];
      mapsPromise = null;
      reject(new Error("Google Maps could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return mapsPromise;
}
