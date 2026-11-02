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
.cd { display: flex; flex-direction: column; gap: 12px; max-width: 560px; padding: 18px 20px; background: #fffdf8; border: 1.5px solid #f2a477; border-radius: 20px; }
.cd__title { margin: 0; font-family: var(--nt-serif); font-size: 1.25rem; font-weight: 700; color: #7a2e12; }
.cd__text { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: var(--ink, #1f2a52); }
.cd__points { margin: 0; padding-left: 20px; font-size: 0.9375rem; line-height: 1.5; color: var(--ink, #1f2a52); }
.cd__field { display: flex; flex-direction: column; gap: 6px; }
.cd__label { font-size: 0.9375rem; font-weight: 600; color: var(--ink, #1f2a52); }
.cd__input { max-width: 240px; padding: 11px 14px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 14px; }
.cd__help { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--mut, #5b6692); }
.cd__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.cd__danger, .cd__cancel { padding: 10px 20px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 3px; border-radius: 14px; font-family: inherit; font-size: 0.9375rem; font-weight: 600; cursor: pointer; transition: background-color 0.15s, color 0.15s, border-color 0.15s; }
.cd__danger { background: #c4642f; border-color: #a4541f; color: #fff; }
.cd__danger:hover:enabled { background: #a4541f; }
.cd__cancel { color: var(--navy, #243560); }
.cd__cancel:hover:enabled { border-color: var(--navy, #243560); }
.cd__danger:disabled, .cd__cancel:disabled { opacity: 0.55; cursor: not-allowed; }
.cd__danger:focus-visible, .cd__cancel:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
</style>
