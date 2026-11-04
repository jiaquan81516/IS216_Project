<script setup>
import BrandLogo from "@/components/ui/BrandLogo.vue";
import { ROUTES } from "@/app/routes";
import "@/app/app.css";

// The frame around the sign in and sign up pages: the app's dotted blue backdrop, a small top bar,
// and one cream card for the page. `split` adds a navy side panel (the `side` slot) beside the
// card content. `wide` is for pages with two columns.
defineProps({
  split: { type: Boolean, default: false },
  wide: { type: Boolean, default: false },
});
</script>

<template>
  <div class="as">
    <main class="as__main">
      <div class="as__card" :class="{ 'as__card--split': split, 'as__card--wide': wide }">
        <aside v-if="split" class="as__side">
          <BrandLogo :to="ROUTES.LANDING" class="as__logo as__logo--light" />
          <slot name="side" />
        </aside>
        <div class="as__body">
          <div v-if="!split || $slots.nav" class="as__head">
            <BrandLogo v-if="!split" :to="ROUTES.LANDING" class="as__logo" />
            <nav v-if="$slots.nav" class="as__nav" aria-label="Main"><slot name="nav" /></nav>
          </div>
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.as { min-height: 100vh; background: #f1eee7; }
.as__head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.as__logo { transform: scale(0.85); transform-origin: left center; }
.as__side .as__logo--light { position: absolute; top: 28px; left: 32px; z-index: 1; padding: 4px 16px 4px 12px; background: var(--cream, #fdf9f0); border-radius: 999px; transform: none; }
.as__nav { display: inline-flex; align-items: center; gap: 16px; font-size: 0.9375rem; font-weight: 600; margin-left: auto; }
.as__nav :deep(a) { color: var(--navy, #243560); text-decoration: none; }
.as__nav :deep(a:hover) { text-decoration: underline; text-underline-offset: 4px; }
.as__main { display: flex; justify-content: center; padding: clamp(24px, 7vh, 72px) 16px 64px; }
.as__card { width: 100%; max-width: 720px; background: var(--cream, #fdf9f0); border: 1px solid var(--sand, #e9d9b8); border-bottom-width: 5px; box-shadow: 0 18px 40px rgb(36 53 96 / 8%); border-radius: 32px; overflow: hidden; animation: as-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) backwards; }
.as__card--wide { max-width: 1000px; }
.as__card--split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); max-width: 960px; }
.as__body { display: flex; flex-direction: column; gap: 20px; min-width: 0; padding: 34px 38px 38px; color: var(--ink, #1f2a52); }
.as__side { position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 24px; padding: 88px 40px 56px; text-align: center; overflow: hidden; background: var(--navy, #243560); color: #fff; }
.as__side::before { content: ""; position: absolute; top: -44px; right: -44px; width: 150px; height: 150px; border-radius: 50%; background: #f2a477; }
.as__side > :deep(*) { position: relative; }
@keyframes as-rise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .as__card { animation: none; } }
@media (max-width: 767px) {
  .as__card--split { grid-template-columns: minmax(0, 1fr); }
  .as__side { display: none; }
  .as__body { padding: 24px 20px 28px; }
}

/* Shared form pieces, in the app's look while they sit in this card. */
.as__body :deep(.app-field__label) { font-size: 0.9375rem; font-weight: 600; color: var(--ink, #1f2a52); }
.as__body :deep(.app-input), .as__body :deep(.app-control) { padding: 13px 16px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 14px; font-size: 1rem; color: var(--ink, #1f2a52); box-shadow: none; }
.as__body :deep(.app-input:focus), .as__body :deep(.app-control:focus) { outline: 3px solid var(--navy, #243560); outline-offset: 1px; border-color: var(--navy, #243560); box-shadow: none; }
.as__body :deep(.app-field__hint) { color: var(--mut, #5b6692); }
.as__body :deep(.app-btn) { padding: 15px 24px; border-radius: 16px; font-size: 1rem; font-weight: 700; }
.as__body :deep(.app-btn--primary) { background: var(--navy, #243560); border: 0; border-bottom: 4px solid #182246; color: #fff; }
.as__body :deep(.app-btn--primary:hover:not(:disabled)) { background: #1b2a4f; }
.as__body :deep(.app-btn--outline) { background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 4px; color: var(--navy, #243560); }
.as__body :deep(.app-btn--outline:hover:not(:disabled)) { background: #fffdf8; border-color: var(--navy, #243560); }
.as__body :deep(.app-btn:focus-visible) { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.as__body :deep(.app-alert) { border-radius: 14px; }
.as__body :deep(.app-note) { padding: 12px 16px; background: #fdf0e3; border: 1.5px solid #f2c9a6; border-radius: 14px; color: var(--ink, #1f2a52); }
.as__body :deep(.app-text-link) { display: inline-flex; align-items: center; align-self: flex-start; padding: 8px 18px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 999px; color: var(--navy, #243560); font-size: 0.9375rem; font-weight: 600; text-decoration: none; }
.as__body :deep(.app-text-link:hover) { border-color: var(--navy, #243560); }
.as__body :deep(.app-text-link--sm) { font-weight: 700; color: var(--navy, #243560); }
</style>
