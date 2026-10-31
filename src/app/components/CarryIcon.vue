<script setup>
// A parent holding a baby. Mum has long hair, Dad short hair, anyone else a neutral look.
defineProps({
  role: { type: String, default: null },
  who: { type: String, default: "me" },
  size: { type: Number, default: 30 },
});
</script>

<template>
  <svg class="carry" :width="size" :height="size" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path v-if="role === 'mum'" d="M12.5 13 C12.5 3.5 27.5 3.5 27.5 13 L29 24 L11 24 Z" fill="#6b4a3a" />
    <path d="M10 46 C10 31 14 22 20 22 C26 22 30 31 30 46 Z" :fill="who === 'partner' ? '#e3a584' : who === 'other' ? '#7aa38c' : '#5c7a9e'" />
    <circle cx="20" cy="13" r="6.5" fill="#f1c9a5" />
    <path v-if="role !== 'mum'" d="M13.5 12 C13.5 4.5 26.5 4.5 26.5 12 C24 9.2 16 9.2 13.5 12 Z" fill="#6b4a3a" />
    <path v-else d="M13.5 12.5 C16 8 24 8 26.5 12.5 C24 11 16 11 13.5 12.5 Z" fill="#6b4a3a" />
    <g transform="rotate(-18 33 31)">
      <rect x="23" y="27" width="22" height="12" rx="6" fill="#fff" stroke="#8a97ad" stroke-width="1.2" />
      <circle cx="41" cy="33" r="4.6" fill="#f6d4b8" />
      <circle cx="42.3" cy="32.4" r="0.7" fill="#6b4a3a" />
    </g>
    <path d="M14 33 C20 37 26 38 33 36" fill="none" :stroke="who === 'partner' ? '#e3a584' : who === 'other' ? '#7aa38c' : '#5c7a9e'" stroke-width="4.5" stroke-linecap="round" />
    <path d="M14 33 C20 37 26 38 33 36" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="1" stroke-linecap="round" />
  </svg>
</template>
