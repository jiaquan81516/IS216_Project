<script setup>
defineProps({
  color: { type: String, default: "gray" }, // blue | teal | green | gray | red | yellow
  outlined: { type: Boolean, default: false },
});
</script>

<template>
  <span class="nt-badge" :class="[`nt-badge--${color}`, { 'nt-badge--outlined': outlined }]"><slot /></span>
</template>

<style scoped>
.nt-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
}
.nt-badge--blue { background: var(--nt-blue); color: var(--nt-blue-t); }
.nt-badge--teal, .nt-badge--green { background: var(--nt-teal); color: var(--nt-teal-t); }
.nt-badge--gray { background: var(--nt-gray); color: var(--nt-ink); }
.nt-badge--red { background: var(--nt-red); color: var(--nt-red-t); }
.nt-badge--yellow { background: var(--nt-yellow); color: var(--nt-yellow-t); }
.nt-badge--outlined { background: transparent; border: 1px solid var(--nt-line); color: var(--nt-ink); }
</style>
