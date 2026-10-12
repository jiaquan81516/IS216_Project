<script setup>
import { computed } from "vue";
import { ONEMAP_HOME_URL, oneMapEmbedUrl } from "@/app/api/oneMapHelpers";

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
const title = computed(() => `Map of ${props.label || "Singapore"}`);
</script>

<template>
  <div class="omap">
    <iframe
      class="omap__frame"
      :src="src"
      :title="title"
      :style="{ height: `${height}px` }"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
    ></iframe>
    <p class="omap__credit">
      <a :href="ONEMAP_HOME_URL" target="_blank" rel="noopener noreferrer">Map by OneMap<span class="visually-hidden">, Singapore Land Authority, opens in a new tab</span></a>
    </p>
  </div>
</template>

<style scoped>
.omap { width: 100%; }
.omap__frame { display: block; width: 100%; border: 1px solid var(--nt-line); border-radius: 12px; background: var(--nt-gray); box-sizing: border-box; }
.omap__credit { margin: 6px 0 0; font-size: 0.75rem; line-height: 1.4; color: var(--nt-muted); }
.omap__credit a { color: var(--nt-muted); text-decoration: underline; text-underline-offset: 2px; }
.omap__credit a:hover { color: var(--nt-plum); }
.omap__credit a:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
</style>
