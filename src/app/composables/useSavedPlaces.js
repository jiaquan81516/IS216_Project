import { ref, watch } from "vue";
import { useAuth } from "@/composables/useAuth";
import { useToast } from "@/app/composables/useToast";

// A parent's saved places, kept on this device under their own account, so a partner or a
// second account on the same phone has a separate list.
export function useSavedPlaces(baseKey) {
  const { currentUser } = useAuth();
  const savedIds = ref([]);
  const { showToast } = useToast();
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
    const adding = !savedIds.value.includes(place.id);
    savedIds.value = adding ? [...savedIds.value, place.id] : savedIds.value.filter((id) => id !== place.id);
    showToast({ title: adding ? "Saved to your places" : "Removed from saved places", text: place.name ?? "", ms: 3000 });
    try {
      localStorage.setItem(keyFor(currentUser.value?.uid), JSON.stringify(savedIds.value));
    } catch {
      // Saving is a convenience; the list still works for this visit.
    }
  }
  return { savedIds, toggleSaved };
}
