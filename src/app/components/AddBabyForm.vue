<script setup>
import { ref } from "vue";
import BabyFields from "@/app/components/BabyFields.vue";
import { addBaby } from "@/api/profile";
import "@/app/app.css";

// Adds one more baby to the household. Parents of twins or more, or of a second child, use
// this on the household and profile pages. It reports the saved name through `added`.
const props = defineProps({
  householdId: { type: String, required: true },
  idPrefix: { type: String, default: "app-add-baby" },
  number: { type: Number, required: true }, // this baby's place in the list, shown as "Baby 2"
  solid: { type: Boolean, default: true }, // false when another solid button is already on the page
});
const emit = defineEmits(["added", "cancel"]);

const fields = ref({ name: "", status: "born", date: "" });
const busy = ref(false);
const error = ref("");

async function submit() {
  if (busy.value) return;
  error.value = "";
  busy.value = true;
  try {
    await addBaby(props.householdId, {
      babyName: fields.value.name,
      babyStatus: fields.value.status,
      babyDate: fields.value.date,
    });
    emit("added", fields.value.name.trim() || "Your baby");
    fields.value = { name: "", status: "born", date: "" };
  } catch (cause) {
    console.error("[app add baby]", cause?.code, cause);
    error.value =
      cause?.code === "permission-denied"
        ? "Your database rules do not allow adding a baby yet. Publish the latest firestore.rules, then try again."
        : "We could not add the baby. Check your connection and try again.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="abf app-stack app-stack--24 w-100" novalidate :aria-busy="busy" @submit.prevent="submit">
    <h3 class="abf__title">Baby {{ number }}</h3>
    <BabyFields v-model="fields" :id-prefix="idPrefix" :disabled="busy" />
    <div v-if="error" class="alert alert-danger app-alert" role="alert">{{ error }}</div>
    <div class="abf__actions">
      <button type="submit" class="app-btn" :class="solid ? 'app-btn--primary' : 'app-btn--outline'" :disabled="busy">{{ busy ? "Saving..." : "Save baby" }}</button>
      <button type="button" class="app-btn app-btn--outline" :disabled="busy" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.abf { padding: 18px; background: #fffdf8; border: 1.5px dashed #f2a477; border-radius: 20px; }
.abf__title { margin: 0; font-family: var(--nt-serif); font-size: 1.1875rem; font-weight: 700; line-height: 1.3; color: var(--ink, #1f2a52); }
.abf__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.abf :deep(.app-field__label) { font-size: 0.9375rem; font-weight: 600; color: var(--ink, #1f2a52); }
.abf :deep(.app-input) { width: 100%; padding: 12px 16px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 14px; font: inherit; color: var(--ink, #1f2a52); box-shadow: none; }
.abf :deep(.app-input:focus) { outline: 3px solid var(--navy, #243560); outline-offset: 1px; border-color: var(--navy, #243560); }
.abf :deep(.bf__status) { display: inline-flex; width: auto; align-self: flex-start; gap: 0; padding: 4px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 999px; }
.abf :deep(.bf__seg) { padding: 9px 18px; background: transparent; border: 0; border-radius: 999px; color: var(--navy, #243560); font-weight: 600; box-shadow: none; }
.abf :deep(.bf__seg--on), .abf :deep(.bf__seg--on:hover) { background: var(--navy, #243560); color: #fff; box-shadow: none; }
.abf :deep(.bf__seg:focus-visible) { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.abf .app-btn { padding: 11px 22px; border-radius: 14px; font-weight: 600; }
.abf .app-btn--primary { background: var(--navy, #243560); border: 0; border-bottom: 3px solid #182246; color: #fff; }
.abf .app-btn--outline { background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 3px; color: var(--navy, #243560); }
@media (max-width: 575px) { .abf { padding: 14px; } }
</style>
