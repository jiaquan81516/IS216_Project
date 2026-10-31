<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ONEMAP_HOME_URL, oneMapEmbedUrl } from "@/app/utils/oneMapHelpers";

defineOptions({ name: "OneMapEmbed" });
const props = defineProps({
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  label: { type: String, default: "" },
  zoom: { type: Number, default: null },
  markers: { type: Array, default: () => [] },
  height: { type: Number, default: 360 },
});

const src = computed(() => oneMapEmbedUrl({ lat: props.lat, lng: props.lng, zoom: props.zoom ?? undefined, markers: props.markers }));

// The OneMap page can grab focus while it loads, and the browser then scrolls the whole page
// to the map. For a few seconds after the map (re)loads, undo any page scroll the person did
// not cause themselves (wheel, touch or keys).
const GUARD_MS = 4000;
let anchorY = 0;
let until = 0;
let touched = false;
const note = () => {
  anchorY = window.scrollY;
  until = Date.now() + GUARD_MS;
  touched = false;
};
const touch = () => {
  touched = true;
};
function holdScroll() {
  if (touched || Date.now() > until || window.scrollY === anchorY) return;
  window.scrollTo({ top: anchorY, behavior: "instant" });
}
const INPUTS = ["wheel", "touchmove", "keydown", "mousedown"];
onMounted(() => {
  note();
  INPUTS.forEach((name) => window.addEventListener(name, touch, { passive: true }));
  window.addEventListener("scroll", holdScroll, { passive: true });
});
onBeforeUnmount(() => {
  INPUTS.forEach((name) => window.removeEventListener(name, touch));
  window.removeEventListener("scroll", holdScroll);
});
watch(src, note, { flush: "pre" });

// A soft placeholder shows until the map page has loaded.
const loaded = ref(false);
watch(src, () => { loaded.value = false; });
function onLoad() {
  loaded.value = true;
  holdScroll();
}

const title = computed(() => `Map of ${props.label || "Singapore"}`);
</script>

<template>
  <div class="omap">
    <div class="omap__wrap">
    <div v-if="!loaded" class="omap__ph" :style="{ height: `${height}px` }" role="status"><span class="omap__phdot" aria-hidden="true" /><span>Loading map</span></div>
    <iframe
      class="omap__frame"
      :src="src"
      :title="title"
      :style="{ height: `${height}px` }"
      loading="lazy"
      @load="onLoad"
      referrerpolicy="no-referrer-when-downgrade"
    ></iframe>
    </div>
    <p class="omap__credit">
      <a :href="ONEMAP_HOME_URL" target="_blank" rel="noopener noreferrer">Map by OneMap<span class="visually-hidden">, Singapore Land Authority, opens in a new tab</span></a>
    </p>
  </div>
</template>

<style scoped>
.omap { width: 100%; }
.omap__frame { display: block; width: 100%; border: 1px solid var(--nt-line); border-radius: 12px; background: var(--nt-gray); box-sizing: border-box; }
.omap__wrap { position: relative; }
.omap__ph { position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 12px; background: var(--nt-gray); font-size: 0.875rem; color: var(--nt-muted); pointer-events: none; }
.omap__phdot { width: 10px; height: 10px; border-radius: 50%; background: var(--nt-plum); animation: omap-breathe 2.4s ease-in-out infinite; }
@keyframes omap-breathe { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.15); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .omap__phdot { animation: none; } }
.omap__credit { margin: 6px 0 0; font-size: 0.75rem; line-height: 1.4; color: var(--nt-muted); }
.omap__credit a { color: var(--nt-muted); text-decoration: underline; text-underline-offset: 2px; }
.omap__credit a:hover { color: var(--nt-plum); }
.omap__credit a:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
</style>
