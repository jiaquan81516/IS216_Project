<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
// One calm loading look for the whole app: the logo breathes slowly above a thin plum line.
//   page     fills the screen, for the first load of the app
//   overlay  sits over the current page, for sign in, sign up and slow navigation
//   inline   a small status row inside a card or a list
// Motion stops when the person asks their device to reduce it.
// `messages` replaces the label with a short sequence ("Setting things up", "Almost there")
// that moves on every `interval` ms and stays on the last one.
const props = defineProps({
  variant: { type: String, default: "page", validator: (value) => ["page", "overlay", "inline"].includes(value) },
  label: { type: String, default: "Loading" },
  subtext: { type: String, default: "" },
  messages: { type: Array, default: () => [] },
  interval: { type: Number, default: 1300 },
});

const step = ref(0);
let timer = null;
watch(
  () => props.messages.join("|"),
  () => {
    clearInterval(timer);
    step.value = 0;
    if (props.messages.length > 1) {
      timer = setInterval(() => {
        if (step.value < props.messages.length - 1) step.value += 1;
        else clearInterval(timer);
      }, props.interval);
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => clearInterval(timer));
const text = computed(() => (props.messages.length ? props.messages[Math.min(step.value, props.messages.length - 1)] : props.label));
</script>

<template>
  <div class="ls" :class="`ls--${variant}`" role="status" aria-live="polite">
    <img v-if="variant !== 'inline'" class="ls__logo" src="/logo.svg" width="56" height="56" alt="" />
    <span v-else class="ls__dot" aria-hidden="true" />
    <div class="ls__text">
      <p :key="text" class="ls__label">{{ text }}</p>
      <p v-if="subtext && variant !== 'inline'" class="ls__sub">{{ subtext }}</p>
    </div>
    <span v-if="variant !== 'inline'" class="ls__line" aria-hidden="true"><span /></span>
  </div>
</template>

<style scoped>
.ls { display: flex; align-items: center; color: var(--nt-ink); }
.ls__text { display: flex; flex-direction: column; align-items: inherit; gap: 4px; }
.ls__label { margin: 0; font-family: var(--nt-serif); font-size: 1.25rem; line-height: 1.3; }
.ls__label { animation: ls-fade 300ms ease-out both; }
.ls__sub { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: var(--nt-muted); }

.ls--page,
.ls--overlay { flex-direction: column; justify-content: center; gap: 20px; text-align: center; padding: 24px; box-sizing: border-box; }
.ls--page { min-height: 100vh; min-height: 100dvh; background: var(--nt-bg); }
.ls--overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: color-mix(in srgb, var(--nt-bg) 94%, transparent);
  animation: ls-fade 200ms ease-out both;
}

.ls__logo { animation: ls-breathe 2.4s ease-in-out infinite; }
.ls__line { position: relative; display: block; width: 120px; height: 3px; overflow: hidden; border-radius: 2px; background: var(--nt-line); }
.ls__line > span { position: absolute; inset: 0 auto 0 0; width: 40%; border-radius: 2px; background: var(--nt-plum); animation: ls-slide 1.6s ease-in-out infinite; }

.ls--inline { gap: 10px; padding: 16px 0; }
.ls--inline .ls__label { font-family: inherit; font-size: 0.875rem; color: var(--nt-muted); }
.ls__dot { width: 10px; height: 10px; border-radius: 50%; background: var(--nt-plum); animation: ls-breathe 2.4s ease-in-out infinite; }

@keyframes ls-breathe {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.06); opacity: 1; }
}
@keyframes ls-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}
@keyframes ls-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .ls--overlay,
  .ls__label { animation: none; }
  .ls__logo,
  .ls__dot { animation: none; }
  .ls__line > span { width: 100%; opacity: 0.5; animation: none; }
}
</style>
