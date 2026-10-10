<script setup>
import { computed } from "vue";

// A 6 PM to 6 AM bar. First half is the first parent's shift, second half the partner's.
// The coral line marks the real local time; it has no floating label.
const props = defineProps({
  meName: { type: String, default: "You" },
  partnerName: { type: String, default: "Your partner" },
  now: { type: Date, default: () => new Date() },
});

const START = 18;
const SPAN = 12;

// Hours on the strip (18 to 30), or null outside the window.
const hour = computed(() => {
  const t = props.now.getHours() + props.now.getMinutes() / 60;
  if (t >= START) return t;
  if (t < START - SPAN) return t + 24;
  return null;
});
const inWindow = computed(() => hour.value !== null);
const left = computed(() => {
  const pct = Math.min(100, Math.max(0, ((hour.value - START) / SPAN) * 100));
  return `${pct}%`;
});
const timeText = computed(() => {
  const h = props.now.getHours();
  const m = String(props.now.getMinutes()).padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
});
const label = computed(
  () =>
    `Tonight from 6 PM to 6 AM. ${props.meName} is on duty from 6 PM to 12 AM, then ${props.partnerName} from 12 AM to 6 AM. ` +
    (inWindow.value ? `It is now ${timeText.value}.` : "The current time is outside tonight's window."),
);
</script>

<template>
  <div class="tl">
    <div class="tl__figure" role="img" :aria-label="label">
      <div class="tl__bar">
        <span class="tl__seg tl__seg--first" />
        <span class="tl__seg tl__seg--second" />
        <span v-if="inWindow" class="tl__now" data-testid="now-marker" :style="{ left }" />
      </div>
      <div class="tl__ticks" aria-hidden="true">
        <span>6 PM</span>
        <span>12 AM</span>
        <span>6 AM</span>
      </div>
    </div>
    <p class="tl__legend">
      <template v-if="inWindow">
        <span class="tl__swatch" aria-hidden="true" />
        <span>Now, {{ timeText }}</span>
      </template>
      <span v-else>Outside tonight's window</span>
    </p>
  </div>
</template>

<style scoped>
.tl { display: flex; flex-direction: column; gap: 8px; }
.tl__figure { display: flex; flex-direction: column; gap: 8px; }
.tl__bar { position: relative; display: flex; height: 12px; background: var(--nt-gray); border-radius: 6px; }
.tl__seg { flex: 1; }
.tl__seg--first { background: var(--nt-apricot); border-radius: 6px 0 0 6px; }
.tl__seg--second { background: var(--nt-powder); border-radius: 0 6px 6px 0; }
.tl__now { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: var(--nt-coral); border-radius: 1px; }
.tl__ticks { display: flex; justify-content: space-between; font-size: 0.875rem; line-height: 1.2; color: var(--nt-muted); }
.tl__legend { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.tl__swatch { width: 2px; height: 14px; background: var(--nt-coral); border-radius: 1px; }
</style>
