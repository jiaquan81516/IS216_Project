<script setup>
defineProps({
  who: { type: String, default: "D" }, // D = Daniel (apricot), M = Mei (powder)
  size: { type: Number, default: 28 },
});
</script>

<template>
  <span
    class="avatar-dot nt-who"
    :class="`nt-who--${who}`"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size > 30 ? 14 : 12}px` }"
    :title="who === 'D' ? 'Daniel' : 'Mei'"
  >{{ who }}</span>
</template>

<style scoped>
.avatar-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 50%;
  font-weight: 500;
  color: var(--nt-ink);
}
</style>
