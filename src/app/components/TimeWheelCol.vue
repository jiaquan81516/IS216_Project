<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

// One rolling wheel of a time picker. It scrolls and snaps; the row in the middle is the value.
// `loop` repeats the rows so the wheel rolls round (59 min goes on to 00) like a real dial.
defineOptions({ name: "TimeWheelCol" });
const props = defineProps({
  modelValue: { type: Number, required: true }, // index into items
  items: { type: Array, required: true }, // strings to show
  label: { type: String, required: true },
  loop: { type: Boolean, default: false },
  step: { type: Number, default: 1 }, // rows moved by PageUp / PageDown
});
const emit = defineEmits(["update:modelValue"]);

const ITEM = 40; // px, matches --tw-row in the style
const n = props.items.length;
const copies = props.loop ? 3 : 1;
const total = n * copies;

const col = ref(null);
let rows = [];
let settleTimer = null;
let frame = 0;

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const behavior = () => (reduced() ? "auto" : "smooth");
const mod = (a) => ((a % n) + n) % n;
const nowGlobal = () => Math.round((col.value?.scrollTop ?? 0) / ITEM);

// Rows near the middle are bigger and darker; the ones further out fade and tilt away.
function paint(from = 0, to = total - 1) {
  const pos = (col.value?.scrollTop ?? 0) / ITEM;
  for (let g = Math.max(0, from); g <= Math.min(total - 1, to); g += 1) {
    const el = rows[g];
    if (!el) continue;
    const s = Math.max(-3, Math.min(3, g - pos));
    el.style.setProperty("--s", s.toFixed(3));
    el.style.setProperty("--d", Math.abs(s).toFixed(3));
  }
}
function onScroll() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const pos = (col.value?.scrollTop ?? 0) / ITEM;
    paint(Math.floor(pos) - 4, Math.ceil(pos) + 4);
  });
  clearTimeout(settleTimer);
  settleTimer = setTimeout(settle, 120);
}
function settle() {
  if (!col.value) return;
  let g = nowGlobal();
  const v = mod(g);
  // Jump back to the middle copy without anyone seeing it, so the wheel never runs out.
  if (props.loop && (g < n || g >= 2 * n)) {
    g = n + v;
    const el = col.value;
    el.style.scrollSnapType = "none";
    el.scrollTop = g * ITEM;
    requestAnimationFrame(() => (el.style.scrollSnapType = ""));
  }
  paint();
  if (v !== props.modelValue) emit("update:modelValue", v);
}
function goTo(g, smooth = true) {
  col.value?.scrollTo({ top: Math.max(0, Math.min(total - 1, g)) * ITEM, behavior: smooth ? behavior() : "auto" });
}
// The nearest row (in any copy) that holds the value, so rolling to it is the short way round.
function nearest(v) {
  const base = nowGlobal();
  if (!props.loop) return v;
  let diff = mod(v - base);
  if (diff > n / 2) diff -= n;
  return base + diff;
}
function onKey(event) {
  const g = nowGlobal();
  const move = { ArrowUp: -1, ArrowDown: 1, PageUp: -props.step, PageDown: props.step }[event.key];
  if (move !== undefined) {
    event.preventDefault();
    goTo(g + move);
  } else if (event.key === "Home") {
    event.preventDefault();
    goTo(nearest(0));
  } else if (event.key === "End") {
    event.preventDefault();
    goTo(nearest(n - 1));
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (v !== mod(nowGlobal())) goTo(nearest(v));
  },
);
onMounted(async () => {
  await nextTick();
  rows = [...col.value.querySelectorAll(".tw__item")];
  goTo((props.loop ? n : 0) + props.modelValue, false);
  paint();
});
onBeforeUnmount(() => {
  clearTimeout(settleTimer);
  cancelAnimationFrame(frame);
});
</script>

<template>
  <div
    ref="col"
    class="tw__col"
    role="spinbutton"
    tabindex="0"
    :aria-label="label"
    :aria-valuenow="modelValue"
    :aria-valuetext="items[modelValue]"
    @scroll.passive="onScroll"
    @keydown="onKey"
  >
    <div class="tw__pad" aria-hidden="true"></div>
    <div v-for="g in total" :key="g" class="tw__item" aria-hidden="true" @click="goTo(g - 1)">{{ items[(g - 1) % n] }}</div>
    <div class="tw__pad" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.tw__col {
  --tw-row: 40px;
  position: relative;
  z-index: 1;
  flex: 1 1 0;
  min-width: 0;
  height: calc(var(--tw-row) * 5);
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent);
  mask-image: linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent);
  border-radius: 12px;
  cursor: grab;
}
.tw__col::-webkit-scrollbar {
  display: none;
}
.tw__col:focus-visible {
  outline: 3px solid var(--navy, #243560);
  outline-offset: 2px;
}
.tw__pad {
  height: calc(var(--tw-row) * 2);
}
.tw__item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--tw-row);
  scroll-snap-align: center;
  font-family: var(--nt-serif, inherit);
  font-size: clamp(1.125rem, 5vw, 1.375rem);
  font-weight: 600;
  white-space: nowrap;
  font-variant-numeric: lining-nums tabular-nums;
  font-feature-settings: "lnum" 1, "tnum" 1;
  color: var(--navy, #243560);
  --s: 3;
  --d: 3;
  opacity: calc(1 - var(--d) * 0.38);
  transform: perspective(240px) rotateX(calc(var(--s) * -16deg)) scale(calc(1 - var(--d) * 0.07));
  user-select: none;
}
@media (prefers-reduced-motion: reduce) {
  .tw__item {
    transform: none;
  }
}
</style>
