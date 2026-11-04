<script setup>
import "@/app/app.css";
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { clampCrop, renderCrop, ZOOM_MAX, ZOOM_MIN } from "@/app/utils/photoHelpers";

defineOptions({ name: "PhotoCropDialog" });

const props = defineProps({
  // True while the parent is saving the cropped photo.
  busy: { type: Boolean, default: false },
  // A message from the parent, such as a failed save.
  error: { type: String, default: "" },
});
const emit = defineEmits(["save", "cancel"]);

const MIN_SIDE = 64;

const dialog = ref(null);
const stage = ref(null);
const objectUrl = ref("");
const natural = ref({ w: 0, h: 0 });
const zoom = ref(ZOOM_MIN);
const u = ref(0);
const v = ref(0);
const stagePx = ref(280);
const localError = ref("");
const closing = ref(false);
let source = null;
let observer = null;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("unreadable"));
    image.src = url;
  });
}

function release() {
  observer?.disconnect();
  observer = null;
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
  objectUrl.value = "";
  source = null;
}

function measure() {
  if (stage.value?.clientWidth) stagePx.value = stage.value.clientWidth;
}

// Moves or zooms the photo, always keeping it covering the whole box.
function setCrop(next) {
  const crop = clampCrop({
    natW: natural.value.w,
    natH: natural.value.h,
    zoom: next.zoom ?? zoom.value,
    u: next.u ?? u.value,
    v: next.v ?? v.value,
  });
  zoom.value = crop.zoom;
  u.value = crop.u;
  v.value = crop.v;
}

// Opens the editor for a chosen file. Resolves to "" when it opened, or a message to show the
// person when the file could not be read.
async function open(file) {
  const url = URL.createObjectURL(file);
  let image;
  try {
    image = await loadImage(url);
  } catch {
    URL.revokeObjectURL(url);
    return "That image could not be read. Try a JPG or PNG.";
  }
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  if (Math.min(w, h) < MIN_SIDE) {
    URL.revokeObjectURL(url);
    return `That photo is too small. Choose one at least ${MIN_SIDE} pixels wide and tall.`;
  }
  release();
  source = image;
  objectUrl.value = url;
  natural.value = { w, h };
  zoom.value = ZOOM_MIN;
  u.value = 0;
  v.value = 0;
  localError.value = "";
  closing.value = false;
  dialog.value.showModal();
  await nextTick();
  measure();
  if (typeof ResizeObserver !== "undefined" && stage.value) {
    observer = new ResizeObserver(measure);
    observer.observe(stage.value);
  }
  return "";
}

// Closing eases out the way it eased in, then really closes.
function close() {
  const el = dialog.value;
  if (!el?.open || closing.value) return;
  const finish = () => el.close();
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return finish();
  closing.value = true;
  window.setTimeout(() => {
    closing.value = false;
    finish();
  }, 180);
}
defineExpose({ open, close });

// Esc, a click on the backdrop and Cancel all do the same thing, unless a save is running.
function requestClose() {
  if (props.busy) return;
  emit("cancel");
  close();
}

// A click that both starts and ends on the dialog element itself is a click on the backdrop,
// because the visible card is made of the padded wrapper inside it. A drag that starts on the
// photo and is released over the backdrop must not close it, so the start is checked too.
let downOnBackdrop = false;
function onDialogPointerDown(event) {
  downOnBackdrop = event.target === dialog.value;
}
function onDialogClick(event) {
  if (downOnBackdrop && event.target === dialog.value) requestClose();
  downOnBackdrop = false;
}

const imageStyle = computed(() => {
  const { w, h } = natural.value;
  if (!w) return {};
  const scale = (stagePx.value / Math.min(w, h)) * zoom.value;
  return {
    width: `${w * scale}px`,
    height: `${h * scale}px`,
    transform: `translate(calc(-50% + ${u.value * stagePx.value}px), calc(-50% + ${v.value * stagePx.value}px))`,
  };
});

// One finger or the mouse drags the photo; two fingers pinch to zoom.
const pointers = new Map();
let pinch = null;
function pinchDistance() {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y) || 1;
}
function onPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  try {
    stage.value.setPointerCapture(event.pointerId);
  } catch {
    // Capture is only a convenience; dragging still works while the pointer stays over the photo.
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  pinch = pointers.size === 2 ? { distance: pinchDistance(), zoom: zoom.value } : null;
}
function onPointerMove(event) {
  const point = pointers.get(event.pointerId);
  if (!point) return;
  const dx = event.clientX - point.x;
  const dy = event.clientY - point.y;
  point.x = event.clientX;
  point.y = event.clientY;
  if (pointers.size === 1) setCrop({ u: u.value + dx / stagePx.value, v: v.value + dy / stagePx.value });
  else if (pointers.size === 2 && pinch) setCrop({ zoom: (pinch.zoom * pinchDistance()) / pinch.distance });
}
function onPointerEnd(event) {
  pointers.delete(event.pointerId);
  pinch = pointers.size === 2 ? { distance: pinchDistance(), zoom: zoom.value } : null;
}
function onWheel(event) {
  setCrop({ zoom: zoom.value * Math.exp(-event.deltaY * 0.0015) });
}
function onKeydown(event) {
  const step = event.shiftKey ? 0.1 : 0.03;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[event.key]) {
    event.preventDefault();
    setCrop({ u: u.value + moves[event.key][0], v: v.value + moves[event.key][1] });
  } else if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    setCrop({ zoom: zoom.value + 0.15 });
  } else if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    setCrop({ zoom: zoom.value - 0.15 });
  }
}

function save() {
  if (props.busy || !source) return;
  localError.value = "";
  try {
    emit("save", renderCrop(source, { zoom: zoom.value, u: u.value, v: v.value }));
  } catch (cause) {
    localError.value = cause?.message || "The photo could not be prepared. Try a different one.";
  }
}

onBeforeUnmount(release);
</script>

<template>
  <dialog
    ref="dialog"
    class="pc"
    :class="{ 'pc--closing': closing }"
    aria-labelledby="pc-title"
    @cancel.prevent="requestClose"
    @pointerdown="onDialogPointerDown"
    @click="onDialogClick"
    @close="release"
  >
    <div class="pc__body">
      <h2 id="pc-title" class="pc__title">Adjust your photo</h2>

      <div
        ref="stage"
        class="pc__stage"
        tabindex="0"
        role="group"
        aria-label="Photo crop area. Arrow keys move the photo. Plus and minus zoom."
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerEnd"
        @pointercancel="onPointerEnd"
        @wheel.prevent="onWheel"
        @keydown="onKeydown"
      >
        <img v-if="objectUrl" class="pc__img" :src="objectUrl" :style="imageStyle" alt="" draggable="false" />
        <span class="pc__shade" aria-hidden="true"></span>
        <span class="pc__ring" aria-hidden="true"></span>
      </div>

      <div class="pc__side">
        <p class="pc__hint">Drag the photo to move it. Pinch, scroll or use the slider to zoom.</p>
        <div class="pc__zoom">
          <label class="pc__label" for="pc-zoom">Zoom</label>
          <input
            id="pc-zoom"
            class="pc__range"
            type="range"
            :min="ZOOM_MIN"
            :max="ZOOM_MAX"
            step="0.01"
            :value="zoom"
            :aria-valuetext="`${Math.round(zoom * 100)}%`"
            :disabled="busy"
            @input="setCrop({ zoom: Number($event.target.value) })"
          />
        </div>
        <p v-if="localError || error" class="pc__err" role="alert">{{ localError || error }}</p>
        <div class="pc__actions">
          <button type="button" class="pc__btn" :disabled="busy" @click="save">{{ busy ? "Saving..." : "Save photo" }}</button>
          <button type="button" class="pc__btn pc__btn--ghost" :disabled="busy" @click="requestClose">Cancel</button>
        </div>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.pc { width: min(440px, calc(100vw - 32px)); max-width: none; max-height: calc(100dvh - 32px); padding: 0; overflow: auto; border: 1px solid #e9d9b8; border-bottom-width: 4px; border-radius: 24px; color: var(--ink, #1f2a52); background: var(--cream, #fdf9f0); overscroll-behavior: contain; }
.pc::backdrop { background: rgb(24 34 70 / 45%); }
.pc[open] { animation: pc-fade 220ms ease-out both; }
.pc[open]::backdrop { animation: pc-fade 220ms ease-out both; }
.pc--closing[open] { animation: pc-fade-out 180ms ease-in both; }
.pc--closing[open]::backdrop { animation: pc-fade-out 180ms ease-in both; }
@keyframes pc-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pc-fade-out { from { opacity: 1; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .pc[open], .pc[open]::backdrop, .pc--closing[open], .pc--closing[open]::backdrop { animation: none; } }

.pc__body { display: grid; gap: 16px; padding: 22px 24px 24px; }
.pc__title { margin: 0; font-family: var(--nt-serif); font-size: 1.375rem; font-weight: 700; line-height: 1.25; }
.pc__side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.pc__hint { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--mut, #5b6692); }

/* The square the photo is cut from. The dimmed corners and the ring show the round avatar it becomes. */
.pc__stage { position: relative; width: min(100%, 320px); aspect-ratio: 1; margin-inline: auto; overflow: hidden; background: #e9d9b8; border-radius: 18px; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.pc__stage:active { cursor: grabbing; }
.pc__stage:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 3px; }
.pc__img { position: absolute; top: 50%; left: 50%; max-width: none; pointer-events: none; -webkit-user-drag: none; }
.pc__shade { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle closest-side, transparent calc(100% - 1px), rgb(24 34 70 / 55%) 100%); }
.pc__ring { position: absolute; inset: 0; pointer-events: none; border: 2px solid rgb(255 255 255 / 90%); border-radius: 50%; }

.pc__zoom { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 12px; }
.pc__label { font-size: 0.9375rem; font-weight: 600; }
.pc__range { width: 100%; min-height: 44px; margin: 0; accent-color: var(--navy, #243560); cursor: pointer; }
.pc__range:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; border-radius: 8px; }
.pc__err { margin: 0; font-size: 0.875rem; font-weight: 600; color: #a4541f; }
.pc__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.pc__btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 11px 22px; background: var(--navy, #243560); border: 0; border-bottom: 3px solid #182246; border-radius: 14px; color: #fff; font: inherit; font-size: 0.9375rem; font-weight: 600; cursor: pointer; }
.pc__btn:hover:not(:disabled) { background: #1b2a4f; }
.pc__btn:disabled { opacity: 0.6; cursor: not-allowed; }
.pc__btn:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.pc__btn--ghost { background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 3px; color: var(--navy, #243560); }
.pc__btn--ghost:hover:not(:disabled) { background: #fffdf8; border-color: var(--navy, #243560); }

@media (max-width: 575px) {
  .pc { width: calc(100vw - 24px); border-radius: 20px; }
  .pc__body { gap: 14px; padding: 18px 16px 20px; }
  .pc__actions .pc__btn { flex: 1 1 0; }
}
/* A phone on its side is short, so the photo and the controls sit side by side. */
@media (max-height: 520px) and (orientation: landscape) {
  .pc { width: min(720px, calc(100vw - 32px)); }
  .pc__body { grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 12px 24px; padding: 16px 20px 18px; }
  .pc__title { grid-column: 1 / -1; font-size: 1.25rem; }
  .pc__stage { width: min(60dvh, 260px); margin: 0; }
  .pc__side { gap: 10px; }
}
</style>
