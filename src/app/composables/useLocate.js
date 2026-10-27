import { ref } from "vue";

// "Use my location" for the room and clinic lists: a busy state, a time limit and a message
// that says why it failed. `onFix` gets { lat, lng } when the browser answers.
export function useLocate() {
  const locating = ref(false);
  const message = ref("");

  function locate(onFix) {
    message.value = "";
    if (!globalThis.navigator?.geolocation) {
      message.value = "Location is not available in this browser. Search for a place instead.";
      return;
    }
    locating.value = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        locating.value = false;
        onFix({ lat: coords.latitude, lng: coords.longitude });
      },
      (failure) => {
        locating.value = false;
        message.value =
          failure?.code === 1
            ? "Location is blocked for this site. Allow it in your browser settings, or search for a place instead."
            : failure?.code === 3
              ? "Finding your location took too long. Try again, or search for a place instead."
              : "We could not find your location. Search for a place instead.";
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  return { locating, message, locate };
}
