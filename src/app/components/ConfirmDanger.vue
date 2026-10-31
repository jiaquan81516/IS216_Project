<script setup>
import "@/app/app.css";
import { computed, ref, watch } from "vue";
defineOptions({ name: "ConfirmDanger" });

// A destructive action behind a typed word. The confirm button is an outline button with
// coral text, never a solid red one, and it stays disabled until the word matches exactly.
const props = defineProps({
  id: { type: String, required: true },
  word: { type: String, required: true },
  title: { type: String, required: true },
  lead: { type: String, default: "" },
  points: { type: Array, default: () => [] },
  confirmLabel: { type: String, required: true },
  busy: { type: Boolean, default: false },
});
const emit = defineEmits(["confirm", "cancel"]);

const typed = ref("");
const matches = computed(() => typed.value.trim().toUpperCase() === props.word);

watch(
  () => props.word,
  () => {
    typed.value = "";
  },
);

function confirm() {
  if (!matches.value || props.busy) return;
  emit("confirm");
}
</script>

<template>
  <div class="cd" role="group" :aria-labelledby="`${id}-title`">
    <h3 :id="`${id}-title`" class="cd__title">{{ props.title }}</h3>
    <p v-if="props.lead" class="cd__text">{{ props.lead }}</p>
    <ul v-if="props.points.length" class="cd__points">
      <li v-for="point in props.points" :key="point">{{ point }}</li>
    </ul>
    <div class="cd__field">
      <label class="cd__label" :for="`${id}-input`">Type {{ props.word }} to confirm</label>
      <input
        :id="`${id}-input`"
        v-model="typed"
        class="app-control cd__input"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :aria-describedby="`${id}-help`"
      />
      <p :id="`${id}-help`" class="cd__help">
        This cannot be undone, so we ask you to type the word.
      </p>
    </div>
    <div class="cd__actions">
      <button type="button" class="cd__danger" :disabled="!matches || props.busy" @click="confirm">
        {{ props.confirmLabel }}
      </button>
      <button type="button" class="cd__cancel" :disabled="props.busy" @click="emit('cancel')">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.cd {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 560px;
  padding: 16px;
  border: 1px solid var(--nt-line);
  border-radius: 12px;
}
.cd__title {
  margin: 0;
  font-family: var(--nt-serif);
  font-size: 1.125rem;
  font-weight: 400;
  color: var(--nt-ink);
}
.cd__text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--nt-ink);
}
.cd__points {
  margin: 0;
  padding-left: 20px;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--nt-ink);
}
.cd__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cd__label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--nt-ink);
}
.cd__input {
  max-width: 240px;
}
.cd__help {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--nt-muted);
}
.cd__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cd__danger,
.cd__cancel {
  padding: 9px 16px;
  background: var(--nt-surface, #fff);
  border: 1px solid var(--nt-line);
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}
.cd__danger {
  border-color: var(--nt-coral, #c0553b);
  color: var(--nt-coral, #c0553b);
}
.cd__danger:hover:enabled {
  background: var(--nt-gray);
}
.cd__cancel {
  color: var(--nt-muted);
}
.cd__cancel:hover:enabled {
  background: var(--nt-gray);
  color: var(--nt-ink);
}
.cd__danger:disabled,
.cd__cancel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.cd__danger:focus-visible,
.cd__cancel:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 2px;
}
</style>
