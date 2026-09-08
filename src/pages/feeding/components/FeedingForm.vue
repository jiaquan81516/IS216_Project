<script setup>
import FeedingTypeSelector from "@/pages/feeding/components/FeedingTypeSelector.vue";
import FeedingTimer from "@/pages/feeding/components/FeedingTimer.vue";
import BottleShortcutSelector from "@/pages/feeding/components/BottleShortcutSelector.vue";
</script>

<template>
  <form class="app-card" @submit.prevent>
    <FeedingTypeSelector /><FeedingTimer /><BottleShortcutSelector />
  </form>
</template>
