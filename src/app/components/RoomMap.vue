<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { loadGoogleMaps } from "@/app/api/googleMaps";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  PIN_SIZE,
  SELECTED_PIN_SIZE,
  clusterLabel,
  clusterRooms,
  pinSvg,
  clusterSvg,
  svgDataUrl,
  verificationText,
} from "@/app/api/mapHelpers";
import { mapOpenUrl } from "@/app/api/roomHelpers";
import Icon from "@/app/components/Icon.vue";

defineOptions({ name: "RoomMap" });
const props = defineProps({
  rooms: { type: Array, default: () => [] },
  selectedId: { type: String, default: "" },
  center: { type: Object, default: () => ({ ...DEFAULT_CENTER }) },
  zoom: { type: Number, default: DEFAULT_ZOOM },
});
const emit = defineEmits(["select", "centerChanged", "zoomChanged", "unavailable"]);

const host = ref(null);
const ready = ref(false);
const selectedRoom = computed(() => props.rooms.find((r) => r.id === props.selectedId) ?? null);

let maps = null;
let map = null;
let Marker = null;
let markers = [];
let listeners = [];
let currentZoom = props.zoom;
let destroyed = false;

function clearMarkers() {
  for (const { marker, handle } of markers) {
    handle?.remove?.();
    marker.setMap(null);
  }
  markers = [];
}

function iconFor(item) {
  if (item.count > 1) {
    const label = clusterLabel(item.count);
    const width = 40 + label.length * 7;
    return {
      url: svgDataUrl(clusterSvg(item.count)),
      scaledSize: new maps.Size(width, 34),
      anchor: new maps.Point(width / 2, 17),
    };
  }
  const selected = item.id === props.selectedId;
  const size = selected ? SELECTED_PIN_SIZE : PIN_SIZE;
  return {
    url: svgDataUrl(pinSvg({ selected })),
    scaledSize: new maps.Size(size, size),
    anchor: new maps.Point(size / 2, size / 2),
  };
}

function render() {
  if (!map || !Marker || destroyed) return;
  clearMarkers();
  for (const item of clusterRooms(props.rooms, currentZoom)) {
    const marker = new Marker({
      map,
      position: { lat: item.lat, lng: item.lng },
      icon: iconFor(item),
      title: item.count > 1 ? clusterLabel(item.count) : item.room.name,
      zIndex: item.id === props.selectedId ? 1000 : item.count > 1 ? 10 : 1,
    });
    const handle = marker.addListener("click", () => {
      if (item.count > 1) {
        map.setZoom(Math.min(currentZoom + 2, 18));
        map.panTo({ lat: item.lat, lng: item.lng });
      } else {
        emit("select", item.id);
      }
    });
    markers.push({ marker, handle });
  }
}

onMounted(async () => {
  try {
    maps = await loadGoogleMaps();
    const mapsLib = await maps.importLibrary("maps");
    const markerLib = await maps.importLibrary("marker");
    if (destroyed || !host.value) return;
    Marker = markerLib.Marker;
    map = new mapsLib.Map(host.value, {
      center: { ...props.center },
      zoom: props.zoom,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
      clickableIcons: false,
    });
    currentZoom = props.zoom;
    listeners.push(
      map.addListener("zoom_changed", () => {
        currentZoom = map.getZoom();
        emit("zoomChanged", currentZoom);
        render();
      }),
      map.addListener("dragend", () => {
        const c = map.getCenter();
        emit("centerChanged", { lat: c.lat(), lng: c.lng() });
      }),
    );
    ready.value = true;
    render();
  } catch (cause) {
    emit("unavailable", cause?.message || "Google Maps could not be loaded.");
  }
});

onBeforeUnmount(() => {
  destroyed = true;
  for (const l of listeners) l?.remove?.();
  listeners = [];
  clearMarkers();
  map = null;
  Marker = null;
});

watch(() => props.rooms, render);
watch(() => props.selectedId, render);
watch(
  () => props.center,
  (c) => {
    if (map && c) map.panTo({ lat: c.lat, lng: c.lng });
  },
);
watch(
  () => props.zoom,
  (z) => {
    if (map && map.getZoom() !== z) map.setZoom(z);
  },
);
</script>

<template>
  <div class="rm">
    <div ref="host" class="rm__canvas" role="region" aria-label="Map of pumping rooms"></div>
    <section v-if="ready && selectedRoom" class="rm__card" aria-label="Selected room">
      <button type="button" class="rm__close" aria-label="Close room details" @click="emit('select', '')">
        <Icon name="close" :size="18" />
      </button>
      <h2 class="rm__name">{{ selectedRoom.name }}</h2>
      <p class="rm__text">{{ selectedRoom.address }}</p>
      <p class="rm__muted">{{ verificationText(selectedRoom) }}</p>
      <a class="app-link" :href="mapOpenUrl(selectedRoom)" target="_blank" rel="noopener noreferrer">Get directions</a>
    </section>
  </div>
</template>

<style scoped>
.rm { position: relative; width: 100%; height: 100%; min-height: 360px; background: var(--nt-gray); }
.rm__canvas { position: absolute; inset: 0; }
.rm__card { position: absolute; left: 16px; bottom: 16px; width: min(320px, calc(100% - 32px)); display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 16px 44px 16px 16px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 12px; box-shadow: none; }
.rm__name { margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.4; font-family: inherit; color: var(--nt-ink); }
.rm__text { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.rm__muted { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.rm__close { position: absolute; top: 8px; right: 8px; display: inline-flex; padding: 6px; background: transparent; border: 0; border-radius: 8px; color: var(--nt-muted); cursor: pointer; }
.rm__close:hover { background: var(--nt-gray); color: var(--nt-ink); }
.rm__close:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
</style>
