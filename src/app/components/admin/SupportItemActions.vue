<script setup>
import AppButton from "@/components/ui/AppButton.vue";
import "@/app/app.css";

// Edit and delete buttons under one Support item. Shown to administrators only.
defineProps({
  editor: { type: Object, required: true },
  index: { type: Number, required: true },
  name: { type: String, required: true },
});
</script>

<template>
  <div class="sia">
    <template v-if="editor.confirming.value === index">
      <span class="sia__ask">Delete this?</span>
      <AppButton variant="outline" size="sm" :disabled="editor.busy.value" @click="editor.confirming.value = -1">Cancel</AppButton>
      <AppButton variant="outline" size="sm" :disabled="editor.busy.value" @click="editor.remove(index)">Confirm delete</AppButton>
    </template>
    <template v-else>
      <AppButton variant="outline" size="sm" :disabled="editor.busy.value" :aria-label="`Edit ${name}`" @click="editor.start(index)">Edit</AppButton>
      <AppButton variant="outline" size="sm" :disabled="editor.busy.value" :aria-label="`Delete ${name}`" @click="editor.confirming.value = index">Delete</AppButton>
    </template>
  </div>
</template>

<style scoped>
.sia { grid-column: 1 / -1; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.sia__ask { font-size: 0.875rem; color: var(--nt-muted); }
</style>
