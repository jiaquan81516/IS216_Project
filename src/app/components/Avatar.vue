<script setup>
import { computed, ref, watch } from "vue";
import { isSafePhotoUrl } from "@/app/utils/photoHelpers";

defineOptions({ name: "AppAvatar" });

const props = defineProps({
  name: { type: String, default: "" },
  tone: { type: String, default: "apricot" }, // apricot | powder
  size: { type: Number, default: 28 },
  // A profile photo. Initials show when there is none, or when it cannot be loaded.
  src: { type: String, default: "" },
});

const initials = computed(() => {
  const words = props.name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0][0];
  return letters.toUpperCase();
});

const failed = ref(false);
watch(() => props.src, () => {
  failed.value = false;
});
const photo = computed(() => (!failed.value && isSafePhotoUrl(props.src) ? props.src : ""));

// Small avatars keep their fixed sizes; larger ones scale the initials with the circle.
const fontSize = computed(() => (props.size > 40 ? Math.round(props.size * 0.38) : props.size > 30 ? 14 : 12));
</script>

<template>
  <span
    class="app-avatar"
    :class="`app-avatar--${tone}`"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${fontSize}px` }"
    aria-hidden="true"
  >
    <img v-if="photo" class="app-avatar__img" :src="photo" alt="" draggable="false" referrerpolicy="no-referrer" @error="failed = true" />
    <template v-else>{{ initials }}</template>
  </span>
</template>

<style scoped>
.app-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  overflow: hidden;
  border-radius: 50%;
  font-weight: 500;
  color: var(--nt-ink);
}
.app-avatar--apricot { background: var(--nt-apricot); }
.app-avatar--powder { background: var(--nt-powder); }
.app-avatar__img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
