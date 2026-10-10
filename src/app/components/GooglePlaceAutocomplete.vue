<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { loadGoogleMaps } from "@/app/api/googleMaps";

defineOptions({ name: "GooglePlaceAutocomplete" });
const emit = defineEmits(["selected", "unavailable"]);
const host = ref(null);
const error = ref("");
let element;
let onSelect;

onMounted(async () => {
  try {
    const maps = await loadGoogleMaps();
    const { PlaceAutocompleteElement } = await maps.importLibrary("places");
    element = new PlaceAutocompleteElement({ includedRegionCodes: ["sg"] });
    element.placeholder = "Search for a building or address";
    element.setAttribute("aria-label", "Building or main address");
    element.classList.add("google-place-input");
    onSelect = async ({ placePrediction }) => {
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "id"] });
      const lat = typeof place.location?.lat === "function" ? place.location.lat() : place.location?.lat;
      const lng = typeof place.location?.lng === "function" ? place.location.lng() : place.location?.lng;
      emit("selected", {
        name: place.displayName || "",
        address: place.formattedAddress || "",
        placeId: place.id || "",
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
      });
    };
    element.addEventListener("gmp-select", onSelect);
    host.value?.appendChild(element);
  } catch (cause) {
    error.value = cause?.message || "Google place suggestions are unavailable.";
    emit("unavailable", error.value);
  }
});

onBeforeUnmount(() => {
  if (element && onSelect) element.removeEventListener("gmp-select", onSelect);
  element?.remove();
});
</script>

<template>
  <div>
    <div ref="host" class="place-host"></div>
    <p v-if="error" class="app-error-text mt-2" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.place-host { min-height: 48px; }
.place-host :deep(.google-place-input) { width: 100%; color-scheme: light; }
</style>
