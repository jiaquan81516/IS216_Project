<script setup>
import Icon from "@/app/components/Icon.vue";

// The cream pill under a page title: a round icon whose colour says how things stand, then a line
// of text, then an optional time on the right.
defineProps({
  icon: { type: String, required: true },
  tone: { type: String, default: "none" }, // none, ok, soon or due
});
</script>

<template>
  <p class="spill" :class="`spill--${tone}`">
    <span class="spill__ico" aria-hidden="true"><Icon :name="icon" :size="18" /></span>
    <span class="spill__main"><slot /></span>
    <span v-if="$slots.time" class="spill__time"><slot name="time" /></span>
  </p>
</template>

<style scoped>
.spill { --tone: #cfd6ea; display: inline-flex; align-items: center; align-self: flex-start; gap: 10px; margin: 8px 0 0; padding: 6px 18px 6px 6px; background: var(--cream, #fdf9f0); border-radius: 999px; box-shadow: 0 3px 0 rgb(0 0 0 / 18%); font-size: 1rem; color: var(--navy, #243560); }
.spill--ok { --tone: #b9e4c4; }
.spill--soon { --tone: #f6d88e; }
.spill--due { --tone: #f4a98c; }
.spill__ico { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; background: var(--tone); border-radius: 50%; color: var(--navy, #243560); transition: background-color 400ms ease; }
.spill__main :deep(strong) { font-weight: 700; }
.spill__time { padding-left: 10px; border-left: 1.5px solid var(--sand, #e9d9b8); color: #5b6692; font-size: 0.9375rem; }
</style>
