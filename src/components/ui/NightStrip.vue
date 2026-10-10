<script setup>
// Signature piece: a 6 PM to 6 AM bar with feed ticks and a coral "Now" line.
// Times are hours on a 24h clock continuing past midnight (6:20 PM = 18.33, 12 AM = 24).
const props = defineProps({
  who: { type: String, default: "M" }, // who is on call: D or M
  marks: { type: Array, default: () => [] }, // [{ t, label, dashed }]
  now: { type: Number, default: null },
});
const pct = (t) => `${((t - 18) / 12) * 100}%`;
const TICKS = [["6 PM", 18], ["9 PM", 21], ["12 AM", 24], ["3 AM", 27], ["6 AM", 30]];
</script>

<template>
  <div class="strip" role="img" :aria-label="`On call tonight: ${who === 'M' ? 'Mei' : 'Daniel'}, 6 PM to 6 AM`">
    <div class="strip__bar" :class="`nt-who--${who}`" />
    <div v-for="m in marks" :key="m.label" class="strip__mark" :class="{ 'strip__mark--dashed': m.dashed }" :style="{ left: pct(m.t) }">
      <span class="strip__mark-label">{{ m.label }}</span>
      <span class="strip__mark-line" />
    </div>
    <div v-if="now !== null" class="strip__now" :style="{ left: pct(now) }">
      <span class="strip__now-label">Now {{ Math.floor(now - 12) }}:{{ String(Math.round((now % 1) * 60)).padStart(2, "0") }}</span>
    </div>
    <span v-for="[l, t] in TICKS" :key="l" class="strip__tick" :style="{ left: pct(t) }">{{ l }}</span>
  </div>
</template>

<style scoped>
.strip { position: relative; height: 96px; margin: 0 24px 0 24px; }
.strip__bar { position: absolute; left: 0; right: 0; top: 44px; height: 14px; border-radius: 7px; }
.strip__mark { position: absolute; top: 4px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; }
.strip__mark-label { font-size: 0.75rem; font-weight: 500; white-space: nowrap; }
.strip__mark-line { width: 2px; height: 18px; margin-top: 4px; background: var(--nt-ink); }
.strip__mark--dashed .strip__mark-label { color: var(--nt-muted); }
.strip__mark--dashed .strip__mark-line { width: 0; background: none; border-left: 2px dotted var(--nt-muted); }
.strip__now { position: absolute; top: 26px; bottom: 34px; width: 2px; background: var(--nt-coral); }
.strip__now-label { position: absolute; left: 6px; top: -2px; font-size: 0.75rem; font-weight: 600; color: var(--nt-coral); white-space: nowrap; }
.strip__tick { position: absolute; top: 66px; transform: translateX(-50%); font-size: 0.75rem; color: var(--nt-muted); white-space: nowrap; }
</style>
