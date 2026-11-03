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
    <Transition name="sia" mode="out-in">
      <div v-if="editor.confirming.value === index" key="ask" class="sia__row">
        <span class="sia__ask">Delete this?</span>
        <AppButton variant="outline" size="sm" :disabled="editor.busy.value" @click="editor.confirming.value = -1">Cancel</AppButton>
        <AppButton variant="outline" size="sm" class="sia__danger" :disabled="editor.busy.value" @click="editor.remove(index)">Confirm delete</AppButton>
      </div>
      <div v-else key="idle" class="sia__row">
        <AppButton variant="outline" size="sm" :disabled="editor.busy.value" :aria-label="`Edit ${name}`" @click="editor.start(index)">Edit</AppButton>
        <AppButton variant="outline" size="sm" :disabled="editor.busy.value" :aria-label="`Delete ${name}`" @click="editor.confirming.value = index">Delete</AppButton>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sia { grid-column: 1 / -1; display: flex; align-items: center; width: 100%; min-height: 38px; }
/* Edit and Delete share the row equally, so the pair is the same width on every card. */
.sia__row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; width: 100%; }
.sia__row :deep(.btn) { flex: 1 1 0; min-width: 0; }
.sia__ask { flex: 1 0 100%; }
.sia__ask { font-size: 0.9375rem; font-weight: 600; color: #1f2a52; }
.sia :deep(.btn) { min-height: 36px; padding: 4px 16px; background: #fff; border: 1.5px solid #e9d9b8; border-bottom-width: 3px; border-radius: 999px; color: #243560; font-size: 0.9375rem; font-weight: 600; transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease; }
.sia :deep(.btn:hover:not(:disabled)) { background: #fff; border-color: #243560; color: #243560; transform: translateY(-1px); }
.sia :deep(.btn:active:not(:disabled)) { transform: none; }
.sia :deep(.btn:focus-visible) { outline: 3px solid #f2a477; outline-offset: 2px; }
.sia :deep(.sia__danger) { background: #f9d9d9; border-color: #e3a1a1; color: #8f1f1f; }
.sia :deep(.sia__danger:hover:not(:disabled)) { background: #f5c6c6; border-color: #c94f4f; color: #8f1f1f; }
.sia-enter-active { transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1); }
.sia-leave-active { transition: opacity 0.12s ease; }
.sia-enter-from { opacity: 0; transform: translateY(4px); }
.sia-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .sia-enter-active, .sia-leave-active, .sia :deep(.btn) { transition: none; } }
</style>
