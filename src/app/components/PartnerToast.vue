<script setup>
import { onBeforeUnmount, watch } from "vue";
import "@/app/app.css";

defineOptions({ name: "PartnerToast" });

// A short pop up when your partner sends something. It goes away by itself after a few
// seconds. Everything it shows is also in the chat, so nothing is lost.
const props = defineProps({
  toasts: { type: Array, default: () => [] }, // { id, kind, title, text, to? } to opens a page instead of the chat
  ms: { type: Number, default: 6000 },
});
const emit = defineEmits(["close", "open"]);

const timers = new Map();

function start(toast) {
  stop(toast.id);
  timers.set(
    toast.id,
    setTimeout(() => emit("close", toast.id), props.ms),
  );
}
function stop(id) {
  clearTimeout(timers.get(id));
  timers.delete(id);
}

watch(
  () => props.toasts.map((t) => t.id).join("|"),
  () => {
    for (const toast of props.toasts) if (!timers.has(toast.id)) start(toast);
    for (const id of [...timers.keys()]) if (!props.toasts.some((t) => t.id === id)) stop(id);
  },
  { immediate: true },
);
onBeforeUnmount(() => [...timers.keys()].forEach(stop));
</script>

<template>
  <div class="pt" role="status" aria-live="polite">
    <section
      v-for="toast in toasts"
      :key="toast.id"
      class="pt__toast"
      :class="{ 'pt__toast--care': toast.kind === 'partner-feeling', 'pt__toast--bold': toast.kind === 'partner-heavy' }"
      @pointerenter="stop(toast.id)"
      @pointerleave="start(toast)"
      @focusin="stop(toast.id)"
      @focusout="start(toast)"
    >
      <div class="pt__body">
        <p class="pt__title">{{ toast.title }}</p>
        <p class="pt__text">{{ toast.text }}</p>
      </div>
      <div class="pt__actions">
        <button type="button" class="pt__link" @click="emit('open', toast)">{{ toast.to ? "Open checklist" : "Open chat" }}</button>
        <button type="button" class="pt__link pt__link--muted" @click="emit('close', toast.id)">Close</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pt { position: fixed; right: 24px; bottom: 92px; z-index: 40; display: flex; flex-direction: column; gap: 8px; width: min(360px, calc(100vw - 32px)); pointer-events: none; }
.pt__toast { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; background: var(--nt-white, #fff); border: 1px solid var(--nt-line); border-radius: 12px; pointer-events: auto; }
.pt__toast--care { border-left: 3px solid var(--nt-coral, #c0553b); }
.pt__toast--bold { background: var(--nt-plum, #3b2f3f); border-color: var(--nt-plum, #3b2f3f); }
.pt__toast--bold .pt__title, .pt__toast--bold .pt__text, .pt__toast--bold .pt__link { color: #fff; }
.pt__title { margin: 0; font-size: 0.9375rem; font-weight: 600; line-height: 1.35; color: var(--nt-ink); }
.pt__text { margin: 2px 0 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); overflow-wrap: anywhere; }
.pt__actions { display: flex; align-items: center; gap: 8px 14px; }
.pt__link { padding: 4px 0; background: transparent; border: 0; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-plum); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.pt__link--muted { font-weight: 400; }
.pt__toast:not(.pt__toast--bold) .pt__link--muted { color: var(--nt-muted); }
.pt__link:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
.pt__toast--bold .pt__link:focus-visible { outline-color: #fff; }
@media (max-width: 575px) {
  .pt { right: 16px; bottom: 84px; }
}
</style>
