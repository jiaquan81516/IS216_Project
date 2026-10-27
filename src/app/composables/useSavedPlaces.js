import { ref, watch } from "vue";
import { useAuth } from "@/composables/useAuth";

// A parent's saved places, kept on this device under their own account, so a partner or a
// second account on the same phone has a separate list.
export function useSavedPlaces(baseKey) {
  const { currentUser } = useAuth();
  const savedIds = ref([]);
  const keyFor = (uid) => `${baseKey}:${uid || "guest"}`;

  watch(
    () => currentUser.value?.uid,
    (uid) => {
      try {
        const value = JSON.parse(localStorage.getItem(keyFor(uid)) || "[]");
        savedIds.value = Array.isArray(value) ? value.map(String) : [];
      } catch {
        savedIds.value = [];
      }
    },
    { immediate: true },
  );

  function toggleSaved(place) {
    savedIds.value = savedIds.value.includes(place.id)
      ? savedIds.value.filter((id) => id !== place.id)
      : [...savedIds.value, place.id];
    try {
      localStorage.setItem(keyFor(currentUser.value?.uid), JSON.stringify(savedIds.value));
    } catch {
      // Saving is a convenience; the list still works for this visit.
    }
  }
  return { savedIds, toggleSaved };
}
