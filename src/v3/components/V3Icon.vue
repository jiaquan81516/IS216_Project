<script setup>
import { computed } from "vue";

const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 20 },
});

// Simple 24px line icons, drawn with a 1.75 stroke.
const PATHS = {
  home: ["M3 10.5 12 3l9 7.5", "M5 9v11h5v-6h4v6h5V9"],
  clock: ["M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0", "M12 7v5l3 2"],
  moon: ["M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"],
  briefcase: [
    "M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z",
    "M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2",
    "M3 13h18",
  ],
  calendar: [
    "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    "M8 3v4M16 3v4M3 10h18",
  ],
  heart: [
    "M12 20s-7-4.4-9-9.2C1.6 7.4 3.8 4 7.2 4c2 0 3.6 1 4.8 2.7C13.2 5 14.8 4 16.8 4 20.2 4 22.4 7.4 21 10.8 19 15.6 12 20 12 20z",
  ],
  lifebuoy: [
    "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0",
    "M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
    "M5.6 5.6l3.2 3.2M15.2 15.2l3.2 3.2M18.4 5.6l-3.2 3.2M8.8 15.2l-3.2 3.2",
  ],
  menu: ["M4 7h16M4 12h16M4 17h16"],
  close: ["M6 6l12 12M18 6L6 18"],
  chevron: ["M9 6l6 6-6 6"],
  "chevron-left": ["M15 6l-6 6 6 6"],
  "chevron-down": ["M6 9l6 6 6-6"],
  search: ["M3 11a8 8 0 1 0 16 0a8 8 0 1 0-16 0", "M21 21l-4.3-4.3"],
  pin: ["M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z", "M9.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0"],
  external: ["M14 4h6v6", "M20 4l-9 9", "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"],
  feed: [
    "M10 2h4",
    "M10 2v3h4V2",
    "M9 5h6v2.2a3 3 0 0 1 1 2.3V20a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9.5a3 3 0 0 1 1-2.3z",
    "M8 13h8",
  ],
  diaper: ["M3 6h18v4c0 5-3 9-9 11C6 19 3 15 3 10z", "M8.5 12.5c1.8 1.2 5.2 1.2 7 0"],
  note: [
    "M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5",
    "M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z",
  ],
  medication: ["M10.5 20.5a5 5 0 0 1-7-7l10-10a5 5 0 0 1 7 7z", "M8.5 8.5l7 7"],
  edit: ["M17 3a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"],
  trash: ["M3 6h18", "M8 6V4h8v2", "M6 6l1 14h10l1-14", "M10 11v6M14 11v6"],
  plus: ["M12 5v14M5 12h14"],
  check: ["M5 12.5l4.5 4.5L19 7"],
  x: ["M6 6l12 12M18 6L6 18"],
};

const paths = computed(() => PATHS[props.name] ?? []);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="d in paths" :key="d" :d="d" />
  </svg>
</template>
