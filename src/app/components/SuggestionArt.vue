<script setup>
// Flat illustrations of parents for the wellness insights, drawn in the app's own colours. The page names the scene.
import { computed } from "vue";

const props = defineProps({ kind: { type: String, default: "hold" } });

const ALIAS = { breathe: "calm", water: "tea", note: "plate", sun: "hold", handover: "hug" };
const KNOWN = ["sleep", "calm", "tea", "plate", "walk", "apart", "hug", "hold"];
const scene = computed(() => {
  const name = ALIAS[props.kind] ?? props.kind;
  return KNOWN.includes(name) ? name : "hold";
});

const BG = { sleep: "#e6ebf6", calm: "#e7f0ea", tea: "#fbeee0", plate: "#f6efe3", walk: "#e8f1f7", apart: "#eceff5", hug: "#fbeee8", hold: "#fdf0d8" };

// A parent sitting with their knees up, drawn facing left. `flip` turns them to face right.
const sitters = {
  apart: [
    { x: 92, flip: false, shirt: "#7ea6dc", pants: "#3a3f73", skin: "#f1c5a5", hair: "#2b2540", long: false, beard: true },
    { x: 268, flip: true, shirt: "#e8705a", pants: "#3a3f73", skin: "#f1c5a5", hair: "#2b2540", long: true, beard: false },
  ],
  sleep: [{ x: 120, flip: true, shirt: "#e8705a", pants: "#3a3f73", skin: "#f1c5a5", hair: "#2b2540", long: true, beard: false }],
};
const flipOf = (s) => `translate(${s.x} 172) scale(${s.flip ? -1 : 1} 1)`;
</script>

<template>
  <svg class="sa" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="360" height="200" :fill="BG[scene]" />
    <ellipse cx="180" cy="180" rx="150" ry="8" fill="#000" opacity="0.06" />

    <!-- Apart, or worn out: parents sitting by a cot -->
    <g v-if="scene === 'apart' || scene === 'sleep'">
      <!-- the cot -->
      <g :transform="scene === 'apart' ? 'translate(0 0)' : 'translate(70 0)'">
        <path d="M152 78 q28 -30 56 0" fill="none" stroke="#b27a63" stroke-width="4" />
        <g stroke="#e8705a" stroke-width="2"><path d="M164 66v14M180 62v18M196 66v14" /></g>
        <path d="M164 82l3 5-5-3h4l-5 3z" fill="#e8705a" />
        <circle cx="180" cy="86" r="5" fill="#e8705a" /><circle cx="196" cy="84" r="5" fill="#e8705a" /><circle cx="164" cy="84" r="5" fill="#e8705a" />
        <rect x="132" y="96" width="96" height="62" rx="6" fill="#fff" opacity="0.55" />
        <rect x="140" y="130" width="80" height="22" rx="8" fill="#bcd4ee" />
        <ellipse cx="174" cy="132" rx="12" ry="11" fill="#f1c5a5" />
        <rect x="184" y="126" width="34" height="18" rx="9" fill="#fff" />
        <path d="M164 128q10-8 20 0" fill="none" stroke="#2b2540" stroke-width="0" />
        <circle cx="170" cy="130" r="1.6" fill="#2b2540" /><circle cx="179" cy="130" r="1.6" fill="#2b2540" />
        <ellipse v-if="scene === 'apart'" cx="174.5" cy="137" rx="3.2" ry="3.8" fill="#c0302f" />
        <path v-else d="M171 137q3.5 3 7 0" fill="none" stroke="#2b2540" stroke-width="1.6" stroke-linecap="round" />
        <rect x="124" y="92" width="10" height="72" rx="5" fill="#b27a63" /><rect x="226" y="92" width="10" height="72" rx="5" fill="#b27a63" />
        <circle cx="129" cy="90" r="7" fill="#b27a63" /><circle cx="231" cy="90" r="7" fill="#b27a63" />
        <rect x="126" y="108" width="108" height="7" rx="3" fill="#b27a63" /><rect x="126" y="148" width="108" height="7" rx="3" fill="#b27a63" />
        <g stroke="#b27a63" stroke-width="4" stroke-linecap="round"><path d="M148 115v33M164 115v33M180 115v33M196 115v33M212 115v33" /></g>
      </g>
      <g v-if="scene === 'sleep'" fill="#f5e7b8">
        <path d="M60 40a16 16 0 1 0 14 24a13 13 0 0 1-14-24z" />
        <circle cx="96" cy="34" r="2.5" /><circle cx="40" cy="78" r="2" /><circle cx="300" cy="40" r="2.5" /><circle cx="324" cy="70" r="2" />
        <text x="238" y="64" font-family="Inter, sans-serif" font-size="16" font-weight="700" fill="#7ea6dc">z</text>
        <text x="252" y="52" font-family="Inter, sans-serif" font-size="12" font-weight="700" fill="#7ea6dc">z</text>
      </g>
      <!-- the parents -->
      <g v-for="(s, i) in sitters[scene]" :key="i" :transform="flipOf(s)">
        <path v-if="s.long" d="M2 -104c16 4 22 24 14 46l-12 0z" :fill="s.hair" />
        <line x1="-32" y1="-6" x2="-18" y2="-52" :stroke="s.pants" stroke-width="18" stroke-linecap="round" />
        <line x1="-18" y1="-52" x2="24" y2="-16" :stroke="s.pants" stroke-width="20" stroke-linecap="round" />
        <ellipse cx="-36" cy="-3" rx="15" ry="6" :fill="s.long ? '#e8705a' : '#2b2f55'" />
        <line x1="22" y1="-26" x2="8" y2="-68" :stroke="s.shirt" stroke-width="28" stroke-linecap="round" />
        <circle cx="-2" cy="-92" r="15" :fill="s.skin" />
        <path d="M-17 -95a15 15 0 0 1 30-3c-5-8-11-11-17-11-8 0-13 5-13 14z" :fill="s.hair" />
        <path v-if="s.beard" d="M-15 -90c0 14 6 20 14 20s9-4 9-10c-7 3-14 0-17-10z" :fill="s.hair" />
        <line x1="6" y1="-80" x2="-22" y2="-60" :stroke="s.shirt" stroke-width="11" stroke-linecap="round" />
        <line x1="-22" y1="-60" x2="-8" y2="-90" :stroke="s.shirt" stroke-width="10" stroke-linecap="round" />
        <circle cx="-7" cy="-92" r="6" :fill="s.skin" />
      </g>
    </g>

    <!-- Close: a hug -->
    <g v-else-if="scene === 'hug'">
      <rect x="156" y="140" width="18" height="40" rx="6" fill="#3a3f73" /><rect x="180" y="140" width="18" height="40" rx="6" fill="#3a3f73" />
      <ellipse cx="164" cy="181" rx="13" ry="5" fill="#2b2f55" /><ellipse cx="190" cy="181" rx="13" ry="5" fill="#2b2f55" />
      <rect x="146" y="72" width="60" height="76" rx="18" fill="#fffaf2" stroke="#e6ddcf" stroke-width="2" />
      <rect x="168" y="62" width="18" height="16" rx="6" fill="#f1c5a5" />
      <circle cx="177" cy="52" r="17" fill="#f1c5a5" />
      <path d="M160 52a17 17 0 0 1 34-4c-3-10-10-15-17-15s-14 5-17 19z" fill="#2b2540" />
      <path d="M170 56q7 6 14 0" fill="none" stroke="#2b2540" stroke-width="2" stroke-linecap="round" /><circle cx="171" cy="52" r="1.6" fill="#2b2540" /><circle cx="183" cy="52" r="1.6" fill="#2b2540" />
      <path d="M216 120v56l-16 6h-16l-8-14z" fill="#243560" opacity="0" />
      <rect x="196" y="150" width="14" height="30" rx="6" fill="#f1c5a5" /><rect x="214" y="150" width="14" height="30" rx="6" fill="#f1c5a5" />
      <path d="M186 118h48l8 38h-64z" fill="#243560" />
      <rect x="192" y="96" width="44" height="40" rx="14" fill="#e8705a" />
      <circle cx="216" cy="86" r="14" fill="#f1c5a5" />
      <path d="M202 86a14 14 0 0 1 28-2c-3-9-9-12-14-12s-11 3-14 14z" fill="#2b2540" /><path d="M230 82q12 4 6 26l-8 -6z" fill="#2b2540" />
      <path d="M210 90q6 5 12 0" fill="none" stroke="#2b2540" stroke-width="2" stroke-linecap="round" /><circle cx="210" cy="86" r="1.4" fill="#2b2540" /><circle cx="222" cy="86" r="1.4" fill="#2b2540" />
      <circle cx="207" cy="92" r="3" fill="#e8705a" opacity="0.5" /><circle cx="225" cy="92" r="3" fill="#e8705a" opacity="0.5" />
      <line x1="152" y1="86" x2="214" y2="126" stroke="#fffaf2" stroke-width="13" stroke-linecap="round" />
      <line x1="200" y1="112" x2="160" y2="124" stroke="#e8705a" stroke-width="10" stroke-linecap="round" />
      <g fill="#e8705a">
        <path transform="translate(112 54) scale(1.1)" d="M0 5C-8-3-16 6 0 18 16 6 8-3 0 5z" />
        <path transform="translate(250 50)" d="M0 5C-8-3-16 6 0 18 16 6 8-3 0 5z" />
        <path transform="translate(262 112) scale(1.3)" d="M0 5C-8-3-16 6 0 18 16 6 8-3 0 5z" />
        <path transform="translate(104 118) scale(0.9)" d="M0 5C-8-3-16 6 0 18 16 6 8-3 0 5z" />
      </g>
      <g fill="#f2a477">
        <path transform="translate(228 26) scale(0.9)" d="M0 5C-8-3-16 6 0 18 16 6 8-3 0 5z" />
        <path transform="translate(88 84) scale(0.8)" d="M0 5C-8-3-16 6 0 18 16 6 8-3 0 5z" />
      </g>
    </g>

    <!-- A lot on your plate: a stack held up high -->
    <g v-else-if="scene === 'plate'">
      <rect x="160" y="144" width="16" height="36" rx="6" fill="#3a3f73" /><rect x="184" y="144" width="16" height="36" rx="6" fill="#3a3f73" />
      <ellipse cx="166" cy="181" rx="13" ry="5" fill="#2b2f55" /><ellipse cx="194" cy="181" rx="13" ry="5" fill="#2b2f55" />
      <rect x="156" y="92" width="48" height="60" rx="16" fill="#7ea6dc" />
      <circle cx="180" cy="78" r="15" fill="#f1c5a5" />
      <path d="M165 78a15 15 0 0 1 30-3c-4-9-10-12-15-12s-12 4-15 15z" fill="#6b3f2a" />
      <path d="M173 84q7-4 14 0" fill="none" stroke="#2b2540" stroke-width="2" stroke-linecap="round" /><circle cx="174" cy="77" r="1.6" fill="#2b2540" /><circle cx="186" cy="77" r="1.6" fill="#2b2540" />
      <line x1="162" y1="102" x2="150" y2="62" stroke="#7ea6dc" stroke-width="11" stroke-linecap="round" /><line x1="198" y1="102" x2="210" y2="62" stroke="#7ea6dc" stroke-width="11" stroke-linecap="round" />
      <circle cx="149" cy="58" r="6" fill="#f1c5a5" /><circle cx="211" cy="58" r="6" fill="#f1c5a5" />
      <rect x="138" y="48" width="84" height="14" rx="5" fill="#e8705a" />
      <rect x="146" y="34" width="68" height="14" rx="5" fill="#f2a477" transform="rotate(-3 180 41)" />
      <rect x="152" y="20" width="56" height="14" rx="5" fill="#243560" transform="rotate(4 180 27)" />
      <rect x="160" y="6" width="42" height="14" rx="5" fill="#7fb59a" transform="rotate(-6 180 13)" />
      <rect x="246" y="52" width="36" height="14" rx="5" fill="#f5e7b8" transform="rotate(24 264 59)" />
      <g fill="#7ea6dc" opacity="0.85"><path d="M150 84q-4 6 0 8q4-2 0-8z" /><path d="M210 86q-4 6 0 8q4-2 0-8z" /></g>
    </g>

    <!-- Calm: sitting cross-legged -->
    <g v-else-if="scene === 'calm'">
      <circle cx="180" cy="104" r="78" fill="#cfe5d6" opacity="0.7" /><circle cx="180" cy="104" r="54" fill="#b4d6c0" opacity="0.8" />
      <path d="M40 178c0-30 8-52 24-66-4 26 2 46 14 66zM320 178c0-26-6-46-20-58 2 22-2 40-12 58z" fill="#7fb59a" opacity="0.8" />
      <ellipse cx="180" cy="158" rx="52" ry="17" fill="#3a3f73" />
      <ellipse cx="146" cy="166" rx="22" ry="8" fill="#2f3361" /><ellipse cx="214" cy="166" rx="22" ry="8" fill="#2f3361" />
      <rect x="158" y="88" width="44" height="72" rx="18" fill="#7fb59a" />
      <circle cx="180" cy="70" r="16" fill="#f1c5a5" />
      <path d="M163 70a17 17 0 0 1 34-3c-4-10-11-13-17-13s-13 4-17 16z" fill="#2b2540" /><path d="M163 66q-4 22 6 34l4-6z" fill="#2b2540" /><path d="M197 66q4 22-6 34l-4-6z" fill="#2b2540" />
      <path d="M172 74q3 3 6 0M182 74q3 3 6 0" fill="none" stroke="#2b2540" stroke-width="1.8" stroke-linecap="round" />
      <path d="M174 80q6 4 12 0" fill="none" stroke="#c0553b" stroke-width="1.8" stroke-linecap="round" />
      <line x1="162" y1="102" x2="144" y2="146" stroke="#7fb59a" stroke-width="11" stroke-linecap="round" /><line x1="198" y1="102" x2="216" y2="146" stroke="#7fb59a" stroke-width="11" stroke-linecap="round" />
      <circle cx="143" cy="150" r="6" fill="#f1c5a5" /><circle cx="217" cy="150" r="6" fill="#f1c5a5" />
    </g>

    <!-- Tea: on the sofa with a warm cup -->
    <g v-else-if="scene === 'tea'">
      <rect x="64" y="86" width="232" height="62" rx="20" fill="#f2b79a" />
      <rect x="56" y="112" width="40" height="64" rx="16" fill="#e8a07a" /><rect x="264" y="112" width="40" height="64" rx="16" fill="#e8a07a" />
      <rect x="84" y="128" width="192" height="42" rx="14" fill="#e8a07a" />
      <path d="M316 176v-96" stroke="#b27a63" stroke-width="4" /><path d="M300 82h32l-6-20h-20z" fill="#f5e7b8" />
      <rect x="132" y="108" width="36" height="46" rx="16" fill="#243560" opacity="0" />
      <rect x="150" y="96" width="44" height="58" rx="18" fill="#243560" />
      <circle cx="172" cy="78" r="16" fill="#c68b64" />
      <path d="M156 78a16 16 0 0 1 32-3c-4-10-10-13-16-13s-12 4-16 16z" fill="#2b2540" />
      <path d="M166 84q6 4 12 0" fill="none" stroke="#2b2540" stroke-width="2" stroke-linecap="round" /><circle cx="166" cy="77" r="1.6" fill="#2b2540" /><circle cx="178" cy="77" r="1.6" fill="#2b2540" />
      <rect x="146" y="148" width="26" height="14" rx="6" fill="#3a3f73" /><rect x="170" y="148" width="40" height="14" rx="6" fill="#3a3f73" />
      <line x1="158" y1="110" x2="180" y2="130" stroke="#243560" stroke-width="11" stroke-linecap="round" /><line x1="188" y1="110" x2="198" y2="128" stroke="#243560" stroke-width="11" stroke-linecap="round" />
      <rect x="186" y="118" width="24" height="22" rx="6" fill="#fffaf2" /><path d="M210 124h6a6 6 0 0 1 0 12h-6" fill="none" stroke="#fffaf2" stroke-width="4" />
      <circle cx="184" cy="132" r="6" fill="#c68b64" />
      <path d="M192 112c-5-7 5-9 0-16M202 112c-5-7 5-9 0-16" fill="none" stroke="#c0553b" stroke-width="2.5" stroke-linecap="round" opacity="0.7" />
    </g>

    <!-- Walk: out with the pram -->
    <g v-else-if="scene === 'walk'">
      <circle cx="288" cy="48" r="22" fill="#f5c46a" />
      <path d="M0 150c40-30 90-34 130-14s100 16 140-10 60-8 90 4v70H0z" fill="#bcd9c3" />
      <path d="M0 168c50-14 110-10 160 2s130 4 200-8v38H0z" fill="#9ccaa8" />
      <path d="M214 170h56" stroke="#e9d9b8" stroke-width="0" />
      <circle cx="92" cy="86" r="14" fill="#f1c5a5" />
      <path d="M78 86a14 14 0 0 1 28-2c-3-8-9-12-14-12s-11 4-14 14z" fill="#6b3f2a" /><path d="M78 84q-6 14 2 28l6-8z" fill="#6b3f2a" />
      <path d="M86 92q6 4 12 0" fill="none" stroke="#2b2540" stroke-width="1.8" stroke-linecap="round" />
      <line x1="94" y1="104" x2="96" y2="144" stroke="#e8705a" stroke-width="30" stroke-linecap="round" />
      <line x1="90" y1="144" x2="74" y2="176" stroke="#3a3f73" stroke-width="14" stroke-linecap="round" /><line x1="100" y1="144" x2="118" y2="174" stroke="#3a3f73" stroke-width="14" stroke-linecap="round" />
      <ellipse cx="70" cy="178" rx="12" ry="5" fill="#2b2f55" /><ellipse cx="122" cy="178" rx="12" ry="5" fill="#2b2f55" />
      <line x1="104" y1="112" x2="140" y2="126" stroke="#e8705a" stroke-width="10" stroke-linecap="round" /><circle cx="143" cy="127" r="5.5" fill="#f1c5a5" />
      <path d="M143 127l16-14" stroke="#243560" stroke-width="4" stroke-linecap="round" />
      <path d="M154 122c0 24 12 36 44 36h44c0-24-20-44-48-44-12 0-28 2-40 8z" fill="#7ea6dc" />
      <path d="M166 112c8-14 30-20 54-14 16 4 22 14 22 24l-76 -2z" fill="#fffaf2" opacity="0" />
      <path d="M170 118c12-18 38-22 62-10-4 14-26 18-62 10z" fill="#e8705a" />
      <circle cx="176" cy="172" r="12" fill="#243560" /><circle cx="176" cy="172" r="5" fill="#fffaf2" /><circle cx="232" cy="172" r="12" fill="#243560" /><circle cx="232" cy="172" r="5" fill="#fffaf2" />
    </g>

    <!-- Hold: a parent with the baby, the sun behind -->
    <g v-else>
      <g stroke="#f2a477" stroke-width="5" stroke-linecap="round"><path d="M270 20v14M270 78v14M236 56h14M290 56h14M246 32l10 10M294 32l-10 10M246 80l10-10M294 80l-10-10" /></g>
      <circle cx="270" cy="56" r="22" fill="#f5c46a" />
      <rect x="160" y="146" width="16" height="34" rx="6" fill="#3a3f73" /><rect x="184" y="146" width="16" height="34" rx="6" fill="#3a3f73" />
      <ellipse cx="166" cy="181" rx="13" ry="5" fill="#2b2f55" /><ellipse cx="194" cy="181" rx="13" ry="5" fill="#2b2f55" />
      <rect x="154" y="88" width="52" height="64" rx="18" fill="#e8705a" />
      <circle cx="180" cy="72" r="16" fill="#f1c5a5" />
      <path d="M163 72a17 17 0 0 1 34-3c-4-10-11-13-17-13s-13 4-17 16z" fill="#2b2540" /><path d="M163 68q-5 24 6 38l4-8z" fill="#2b2540" />
      <path d="M172 78q8 6 16 0" fill="none" stroke="#2b2540" stroke-width="2" stroke-linecap="round" /><circle cx="173" cy="70" r="1.7" fill="#2b2540" /><circle cx="187" cy="70" r="1.7" fill="#2b2540" />
      <circle cx="169" cy="77" r="3" fill="#e8705a" opacity="0.45" /><circle cx="191" cy="77" r="3" fill="#e8705a" opacity="0.45" />
      <rect x="150" y="104" width="64" height="30" rx="15" fill="#fffaf2" stroke="#e6ddcf" stroke-width="2" transform="rotate(-8 182 119)" />
      <circle cx="206" cy="108" r="11" fill="#f1c5a5" /><path d="M195 106a11 11 0 0 1 22-2c-3-6-8-8-11-8s-8 3-11 10z" fill="#f2a477" />
      <circle cx="203" cy="109" r="1.3" fill="#2b2540" /><circle cx="210" cy="108" r="1.3" fill="#2b2540" />
      <line x1="160" y1="102" x2="176" y2="128" stroke="#e8705a" stroke-width="11" stroke-linecap="round" /><circle cx="178" cy="130" r="5.5" fill="#f1c5a5" />
    </g>
  </svg>
</template>

<style scoped>
.sa { display: block; width: 100%; height: 100%; }
</style>
