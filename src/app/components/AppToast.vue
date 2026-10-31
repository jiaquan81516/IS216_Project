<script setup>
import { onBeforeUnmount, watch } from "vue";
import "@/app/app.css";

defineOptions({ name: "AppToast" });

// Confirmation pop ups from useToast. Each goes away by itself, stays while the pointer or
// keyboard focus is on it, and can be closed.
const props = defineProps({ toasts: { type: Array, default: () => [] } });
const emit = defineEmits(["close"]);

const timers = new Map();
function start(toast) {
  stop(toast.id);
  timers.set(toast.id, setTimeout(() => emit("close", toast.id), toast.ms ?? 5000));
}
function stop(id) {
  clearTimeout(timers.get(id));
  timers.delete(id);
}
watch(
  () => props.toasts.map((toast) => toast.id).join("|"),
  () => {
    for (const toast of props.toasts) if (!timers.has(toast.id)) start(toast);
    for (const id of [...timers.keys()]) if (!props.toasts.some((toast) => toast.id === id)) stop(id);
  },
  { immediate: true },
);
onBeforeUnmount(() => [...timers.keys()].forEach(stop));
</script>

<template>
  <div class="at" role="status" aria-live="polite">
    <section
      v-for="toast in toasts"
      :key="toast.id"
      class="at__toast"
      :class="`at__toast--${toast.kind}`"
      @pointerenter="stop(toast.id)"
      @pointerleave="start(toast)"
      @focusin="stop(toast.id)"
      @focusout="start(toast)"
    >
      <span class="at__mark" aria-hidden="true" />
      <div class="at__body">
        <p class="at__title">{{ toast.title }}</p>
        <p v-if="toast.text" class="at__text">{{ toast.text }}</p>
      </div>
      <button type="button" class="at__close" @click="emit('close', toast.id)">Close</button>
    </section>
  </div>
</template>

<style scoped>
.at { position: fixed; top: 24px; right: 24px; z-index: 1500; display: flex; flex-direction: column; gap: 10px; width: min(380px, calc(100vw - 32px)); pointer-events: none; }
.at__toast { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; background: var(--nt-white, #fff); border: 1px solid var(--nt-line); border-left: 3px solid var(--nt-plum); border-radius: 12px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08); pointer-events: auto; animation: at-in 240ms ease-out both; }
.at__toast--error { border-left-color: var(--nt-red-t, #991b1b); }
.at__toast--error .at__mark { background: var(--nt-red-t, #991b1b); }
.at__mark { flex: none; width: 10px; height: 10px; margin-top: 6px; border-radius: 50%; background: var(--nt-plum); }
.at__body { flex: 1; min-width: 0; }
.at__title { margin: 0; font-size: 0.9375rem; font-weight: 600; line-height: 1.4; color: var(--nt-ink); }
.at__text { margin: 2px 0 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.at__close { flex: none; min-height: 44px; padding: 0 8px; border: 0; background: none; font-size: 0.875rem; color: var(--nt-muted); }
.at__close:hover { color: var(--nt-plum); }
.at__close:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 6px; }
@keyframes at-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .at__toast { animation: none; } }
@media (max-width: 575px) { .at { top: 16px; right: 16px; } }
</style>
