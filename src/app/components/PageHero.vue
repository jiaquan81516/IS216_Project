<script setup>
// The banner at the top of a page: a small line above, the page name, one line below, then
// anything else (usually a StatusPill). An optional picture sits on the right.
defineProps({
  eyebrow: { type: String, default: "" },
  title: { type: String, required: true },
  lead: { type: String, default: "" },
});
</script>

<template>
  <header class="ph">
    <div class="ph__text">
      <p v-if="eyebrow" class="ph__eyebrow">{{ eyebrow }}</p>
      <h1 class="ph__title">{{ title }}</h1>
      <p v-if="lead || $slots.lead" class="ph__lead"><slot name="lead">{{ lead }}</slot></p>
      <slot />
    </div>
    <slot name="art" />
  </header>
</template>

<style scoped>
.ph { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 32px 40px; background: var(--navy-2, #243560); border-radius: 28px; border-bottom: 5px solid #182246; color: #fff; overflow: hidden; }
.ph__text { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.ph__eyebrow { margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #f2a477; }
.ph__title { margin: 0; font-family: var(--nt-serif); font-size: 2.25rem; line-height: 1.05; font-weight: 700; color: #fff; }
.ph__lead { margin: 0; font-size: 1.0625rem; color: #dfe5f7; }
@media (max-width: 767px) {
  .ph { padding: 24px; }
}
</style>
