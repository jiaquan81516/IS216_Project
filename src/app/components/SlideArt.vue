<script setup>
defineOptions({ name: "SlideArt" });

// Wide flat scenes for the Home carousel. Decorative only (aria-hidden): the words carry the
// meaning. The left half stays calm so the words sit on it, and the scene lives on the right.
defineProps({
  art: { type: String, default: "sunrise" },
});
</script>

<template>
  <svg class="art" viewBox="0 0 1200 400" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
    <!-- Night: moon, stars, hills -->
    <template v-if="art === 'moon'">
      <defs><linearGradient :id="`g-${art}`" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#162b50" /><stop offset="1" stop-color="#3a4f86" /></linearGradient></defs>
      <rect width="1200" height="400" :fill="`url(#g-${art})`" />
      <g fill="#fdf3e6">
        <circle cx="90" cy="70" r="2.4" /><circle cx="210" cy="140" r="1.8" /><circle cx="330" cy="60" r="2.4" /><circle cx="470" cy="120" r="1.8" /><circle cx="590" cy="48" r="2.4" /><circle cx="700" cy="150" r="1.8" /><circle cx="800" cy="70" r="2.4" /><circle cx="1090" cy="60" r="2.4" /><circle cx="1150" cy="170" r="1.8" /><circle cx="60" cy="210" r="1.8" /><circle cx="760" cy="240" r="1.8" />
      </g>
      <circle cx="960" cy="130" r="62" fill="#fbe7c4" />
      <circle cx="992" cy="112" r="56" fill="#2a447c" />
      <path d="M0 310 C200 250 380 270 560 300 C760 335 960 270 1200 300 L1200 400 L0 400 Z" fill="#162b50" />
      <path d="M0 360 C260 330 520 372 780 350 C960 336 1100 338 1200 346 L1200 400 L0 400 Z" fill="#0f2142" />
    </template>

    <!-- Sunrise over hills -->
    <template v-else-if="art === 'sunrise'">
      <defs><linearGradient :id="`g-${art}`" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbd9c0" /><stop offset="1" stop-color="#fdeed2" /></linearGradient></defs>
      <rect width="1200" height="400" :fill="`url(#g-${art})`" />
      <g stroke="#f3c37a" stroke-width="5" stroke-linecap="round" opacity="0.85">
        <path d="M940 220 L940 160" /><path d="M1000 236 L1040 196" /><path d="M880 236 L840 196" /><path d="M1050 280 L1100 280" /><path d="M830 280 L780 280" />
      </g>
      <circle cx="940" cy="300" r="70" fill="#f6b86a" />
      <path d="M0 300 C200 250 400 270 600 305 C800 340 1000 300 1200 318 L1200 400 L0 400 Z" fill="#e9b9a0" />
      <path d="M0 362 C260 332 520 376 780 356 C960 342 1100 346 1200 352 L1200 400 L0 400 Z" fill="#d89c85" />
    </template>

    <!-- Two overlapping circles: you and your partner -->
    <template v-else-if="art === 'pair'">
      <rect width="1200" height="400" fill="#eef4fa" />
      <circle cx="900" cy="200" r="140" fill="#9bb8d9" />
      <circle cx="1040" cy="200" r="140" fill="#f2b896" opacity="0.92" />
      <path d="M970 79 A140 140 0 0 1 970 321 A140 140 0 0 1 970 79 Z" fill="#fff3d9" />
      <circle cx="970" cy="200" r="24" fill="#e3a584" />
    </template>

    <!-- Leaves -->
    <template v-else-if="art === 'leaf'">
      <rect width="1200" height="400" fill="#e3eddc" />
      <g fill="#9fc08f">
        <ellipse cx="900" cy="230" rx="38" ry="130" transform="rotate(-24 900 230)" />
        <ellipse cx="1010" cy="220" rx="34" ry="118" transform="rotate(16 1010 220)" />
        <ellipse cx="820" cy="300" rx="30" ry="96" transform="rotate(-54 820 300)" />
      </g>
      <g fill="#7ba46c">
        <ellipse cx="950" cy="260" rx="30" ry="108" transform="rotate(-4 950 260)" />
        <ellipse cx="1090" cy="300" rx="28" ry="90" transform="rotate(44 1090 300)" />
      </g>
      <path d="M950 400 C954 330 958 270 962 190" stroke="#5f8751" stroke-width="5" fill="none" stroke-linecap="round" />
    </template>

    <!-- Two cups of tea -->
    <template v-else-if="art === 'tea'">
      <rect width="1200" height="400" fill="#fbeeb0" />
      <g stroke="#c9a94a" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.8">
        <path d="M840 150 C822 124 858 112 840 86" /><path d="M900 152 C882 126 918 114 900 88" /><path d="M1000 150 C982 124 1018 112 1000 86" /><path d="M1060 152 C1042 126 1078 114 1060 88" />
      </g>
      <g fill="#fffaf0" stroke="#d8c06a" stroke-width="3">
        <path d="M812 190 H928 V240 A58 58 0 0 1 870 298 A58 58 0 0 1 812 240 Z" />
        <path d="M972 190 H1088 V240 A58 58 0 0 1 1030 298 A58 58 0 0 1 972 240 Z" />
        <path d="M928 206 C968 206 968 262 928 262" fill="none" />
      </g>
      <ellipse cx="870" cy="330" rx="86" ry="12" fill="#e9d27a" />
      <ellipse cx="1030" cy="330" rx="86" ry="12" fill="#e9d27a" opacity="0.7" />
    </template>

    <!-- A path over the hills -->
    <template v-else>
      <defs><linearGradient :id="`g-${art}`" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0f2" /><stop offset="1" stop-color="#eef4fa" /></linearGradient></defs>
      <rect width="1200" height="400" :fill="`url(#g-${art})`" />
      <circle cx="1020" cy="96" r="38" fill="#fbe7c4" />
      <path d="M0 270 C260 220 500 236 740 276 C920 306 1070 270 1200 280 L1200 400 L0 400 Z" fill="#9bb8d6" />
      <path d="M0 340 C300 306 620 350 900 326 C1030 315 1130 318 1200 324 L1200 400 L0 400 Z" fill="#7f9fc2" />
      <path d="M760 400 C790 360 860 336 960 318 C1040 304 1100 290 1150 266" stroke="#f6e7c8" stroke-width="20" fill="none" stroke-linecap="round" opacity="0.92" />
    </template>
  </svg>
</template>

<style scoped>
.art { position: absolute; inset: 0; width: 100%; height: 100%; }
</style>
