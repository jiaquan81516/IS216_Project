<script setup>
// The baby in a bassinet. The picture follows what the care log says: asleep, just fed, getting
// hungry, or simply awake. All motion is gentle and stops for people who ask for less movement.
const props = defineProps({
  state: { type: String, default: "awake" }, // "sleeping" | "fed" | "hungry" | "awake"
  title: { type: String, default: "" },
  detail: { type: String, default: "" },
  titleId: { type: String, default: "" },
  onDark: { type: Boolean, default: false },
});
</script>

<template>
  <figure class="bs" :class="[`bs--${props.state}`, { 'bs--dark': props.onDark }]">
    <svg class="bs__art" viewBox="0 0 240 224" role="img" :aria-label="props.title">
      <ellipse cx="120" cy="216" rx="84" ry="6" fill="#16233b" opacity="0.08" />

      <!-- Sleeping: a moon, a star, and Zs drifting up -->
      <g v-if="props.state === 'sleeping'">
        <g transform="translate(-196 6)"><path class="bs__twinkle" d="M222 28 C212 29 206 37 206 46 C206 56 214 62 223 62 C228 62 232 60 235 57 C226 57 220 51 220 43 C220 37 221 32 222 28 Z" fill="#fbe7c4" stroke="#1f3a68" stroke-width="2" stroke-linejoin="round" /></g>
        <circle class="bs__twinkle bs__d1" cx="22" cy="100" r="2.4" fill="#1f3a68" />
        <circle class="bs__twinkle bs__d2" cx="30" cy="150" r="2" fill="#1f3a68" />
        <text class="bs__z bs__z1" x="200" y="76" font-size="16" font-weight="700" fill="#1f3a68">z</text>
        <text class="bs__z bs__z2" x="208" y="56" font-size="21" font-weight="700" fill="#1f3a68">z</text>
        <text class="bs__z bs__z3" x="214" y="32" font-size="26" font-weight="700" fill="#1f3a68">Z</text>
      </g>

      <!-- Just fed: hearts rising -->
      <g v-else-if="props.state === 'fed'">
        <path class="bs__heart bs__h1" d="M214 70 c-6 -8 -18 -2 -10 8 l10 9 l10 -9 c8 -10 -4 -16 -10 -8 z" fill="#e07a62" />
        <path class="bs__heart bs__h2" d="M16 60 c-4 -6 -13 -1 -7 6 l7 6 l7 -6 c6 -7 -3 -12 -7 -6 z" fill="#f0a08c" />
        <path class="bs__heart bs__h3" d="M214 36 c-3 -5 -10 -1 -5 5 l5 5 l5 -5 c5 -6 -2 -9 -5 -5 z" fill="#e07a62" />
      </g>

      <!-- Hungry: a thought bubble with a drop of milk -->
      <g v-else-if="props.state === 'hungry'" class="bs__ask">
        <circle cx="200" cy="64" r="3.5" fill="#fff" stroke="#1f3a68" stroke-width="2" />
        <circle cx="206" cy="52" r="5" fill="#fff" stroke="#1f3a68" stroke-width="2" />
        <ellipse cx="208" cy="26" rx="26" ry="20" fill="#fff" stroke="#1f3a68" stroke-width="2.5" />
        <path d="M208 15 C203 22 201 26 201 29 a7 7 0 0 0 14 0 c0 -3 -2 -7 -7 -14 z" fill="#cfe0f3" stroke="#1f3a68" stroke-width="2" />
      </g>

      <!-- The bassinet from above: a woven rim and a soft mattress -->
      <rect x="44" y="6" width="152" height="204" rx="30" fill="#ead6b4" stroke="#1f3a68" stroke-width="3" />
      <path d="M52 40 V176 M188 40 V176" stroke="#c9ab7c" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="2 7" />
      <rect x="58" y="20" width="124" height="176" rx="18" fill="#fbf3e6" stroke="#1f3a68" stroke-width="2.4" />

      <!-- The baby, seen from above, face up: a round head on a pillow, and a snug swaddle below -->
      <g class="bs__baby">
        <rect x="74" y="26" width="92" height="52" rx="20" fill="#fff" stroke="#1f3a68" stroke-width="2.2" />
        <g class="bs__breathe">
          <path d="M84 96 C80 140 88 188 120 192 C152 188 160 140 156 96 Z" fill="#cfe0f3" stroke="#1f3a68" stroke-width="2.5" stroke-linejoin="round" />
          <path d="M84 116 C112 134 134 130 157 112 M86 144 C112 162 134 158 156 142" fill="none" stroke="#9db8d8" stroke-width="2.4" stroke-linecap="round" />
          <circle cx="104" cy="172" r="2" fill="#9db8d8" /><circle cx="120" cy="178" r="2" fill="#9db8d8" /><circle cx="136" cy="172" r="2" fill="#9db8d8" />
        </g>

        <g class="bs__head">
          <circle cx="120" cy="62" r="37" fill="#cfe0f3" stroke="#1f3a68" stroke-width="2.5" />
          <circle cx="120" cy="64" r="30" fill="#f8d9bf" stroke="#1f3a68" stroke-width="2.4" />
          <path d="M117 36 C113 29 125 27 126 33 C127 38 120 39 118 35" fill="none" stroke="#8a5a3c" stroke-width="2.8" stroke-linecap="round" />
          <circle cx="102" cy="74" r="6" fill="#f4a79a" opacity="0.6" />
          <circle cx="138" cy="74" r="6" fill="#f4a79a" opacity="0.6" />

          <!-- Eyes: closed when asleep or content, big and open (with a blink) otherwise -->
          <g v-if="props.state === 'sleeping' || props.state === 'fed'" fill="none" stroke="#1f3a68" stroke-width="2.6" stroke-linecap="round">
            <path d="M104 64 Q110 70 116 64" />
            <path d="M124 64 Q130 70 136 64" />
          </g>
          <g v-else class="bs__blink" fill="#1f3a68">
            <ellipse cx="110" cy="65" rx="4.2" ry="5.4" />
            <ellipse cx="130" cy="65" rx="4.2" ry="5.4" />
            <circle cx="111.5" cy="63.2" r="1.5" fill="#fff" />
            <circle cx="131.5" cy="63.2" r="1.5" fill="#fff" />
          </g>

          <circle cx="120" cy="72" r="1.4" fill="#e6a98e" />

          <!-- Mouth -->
          <path v-if="props.state === 'sleeping'" d="M116 80 Q120 82.5 124 80" fill="none" stroke="#1f3a68" stroke-width="2.2" stroke-linecap="round" />
          <path v-else-if="props.state === 'fed'" d="M112 77 Q120 88 128 77 Z" fill="#fff" stroke="#1f3a68" stroke-width="2.2" stroke-linejoin="round" />
          <ellipse v-else-if="props.state === 'hungry'" class="bs__mouth" cx="120" cy="80" rx="4.2" ry="5" fill="#b5532f" stroke="#1f3a68" stroke-width="2" />
          <path v-else d="M113 77 Q120 84 127 77" fill="none" stroke="#1f3a68" stroke-width="2.2" stroke-linecap="round" />
        </g>

        <!-- A tiny fist waving out of the swaddle when the baby is hungry -->
        <g v-if="props.state === 'hungry'" class="bs__wave">
          <circle cx="165" cy="100" r="8" fill="#f8d9bf" stroke="#1f3a68" stroke-width="2.4" />
        </g>
      </g>

      <!-- A bottle resting on the swaddle after a feed -->
      <g v-if="props.state === 'fed'" transform="translate(88 150) rotate(-14)">
        <rect x="0" y="0" width="44" height="17" rx="6" fill="#fff" stroke="#1f3a68" stroke-width="2.4" />
        <rect x="4" y="5" width="24" height="7" rx="3" fill="#eef3fa" />
        <rect x="44" y="3" width="8" height="11" rx="3" fill="#ead6b4" stroke="#1f3a68" stroke-width="2.2" />
      </g>
    </svg>
    <figcaption class="bs__cap">
      <p :id="props.titleId || undefined" class="bs__title">{{ props.title }}</p>
      <p v-if="props.detail" class="bs__detail">{{ props.detail }}</p>
    </figcaption>
  </figure>
</template>

<style scoped>
.bs { display: flex; flex-direction: column; align-items: center; gap: 6px; margin: 0; text-align: center; }
.bs__art { width: 100%; max-width: 230px; height: auto; overflow: visible; }
.bs__cap { display: flex; flex-direction: column; gap: 2px; }
.bs__title { margin: 0; font-family: var(--serif, Georgia, serif); font-size: 1.25rem; font-weight: 500; line-height: 1.3; color: #16233b; }
.bs__detail { margin: 0; font-size: 0.9375rem; color: #55627a; }

.bs__breathe { transform-box: fill-box; transform-origin: 50% 100%; animation: bs-breathe 4.2s ease-in-out infinite; }
.bs--sleeping .bs__breathe { animation-duration: 5.2s; }
.bs--hungry .bs__breathe { animation-duration: 2.6s; }
.bs__blink { transform-box: fill-box; transform-origin: 50% 50%; animation: bs-blink 5.5s infinite; }
.bs__head { transform-box: fill-box; transform-origin: 50% 100%; }
.bs--hungry .bs__head { animation: bs-fuss 1.8s ease-in-out infinite; }
.bs--fed .bs__head { animation: bs-sway 4s ease-in-out infinite; }
.bs__wave { transform-box: fill-box; transform-origin: 50% 100%; animation: bs-wave 1.1s ease-in-out infinite; }
.bs__mouth { transform-box: fill-box; transform-origin: 50% 50%; animation: bs-mouth 1.8s ease-in-out infinite; }
.bs__z { opacity: 0; animation: bs-z 3.6s ease-in-out infinite; }
.bs__z2 { animation-delay: 1.2s; }
.bs__z3 { animation-delay: 2.4s; }
.bs__twinkle { animation: bs-twinkle 3s ease-in-out infinite; }
.bs__d1 { animation-delay: 0.8s; }
.bs__d2 { animation-delay: 1.6s; }
.bs__heart { transform-box: fill-box; transform-origin: 50% 100%; opacity: 0; animation: bs-heart 3.2s ease-in-out infinite; }
.bs__h2 { animation-delay: 1s; }
.bs__h3 { animation-delay: 2s; }
.bs__ask { animation: bs-ask 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 20% 100%; }

@keyframes bs-breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.015, 1.07); } }
@keyframes bs-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
@keyframes bs-fuss { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2.5deg); } }
@keyframes bs-sway { 0%, 100% { transform: rotate(-1deg); } 50% { transform: rotate(1.5deg); } }
@keyframes bs-wave { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-9px) rotate(-8deg); } }
@keyframes bs-mouth { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18, 1.3); } }
@keyframes bs-z { 0% { opacity: 0; transform: translate(0, 8px); } 25% { opacity: 1; } 80% { opacity: 0.9; } 100% { opacity: 0; transform: translate(10px, -14px); } }
@keyframes bs-twinkle { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes bs-heart { 0% { opacity: 0; transform: translateY(10px) scale(0.6); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-22px) scale(1.1); } }
@keyframes bs-ask { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

/* On a dark panel the title and detail go light, and the dark Zs and stars turn cream */
.bs--dark .bs__title { color: #fbf3e6; }
.bs--dark .bs__detail { color: #c3cfe4; }
.bs--dark .bs__z { fill: #fbf3e6; }
.bs--dark circle.bs__twinkle { fill: #fbf3e6; }

@media (prefers-reduced-motion: reduce) {
  .bs__breathe, .bs__blink, .bs__head, .bs__wave, .bs__mouth, .bs__z, .bs__twinkle, .bs__heart, .bs__ask { animation: none; }
  .bs__z, .bs__heart { opacity: 1; }
}
</style>
