<script setup>
import { computed } from "vue";

const props = defineProps({
  name: { type: String, default: "" },
  tone: { type: String, default: "apricot" }, // apricot | powder
  size: { type: Number, default: 28 },
});

const initials = computed(() => {
  const words = props.name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0][0];
  return letters.toUpperCase();
});
</script>

<template>
  <span
    class="v3-avatar"
    :class="`v3-avatar--${tone}`"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size > 30 ? 14 : 12}px` }"
    aria-hidden="true"
    >{{ initials }}</span
  >
</template>

<style scoped>
.v3-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 50%;
  font-weight: 500;
  color: var(--nt-ink);
}
.v3-avatar--apricot { background: var(--nt-apricot); }
.v3-avatar--powder { background: var(--nt-powder); }
</style>
