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
.abf { padding: 20px 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.abf__title { margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.4; color: var(--nt-ink); }
@media (max-width: 575px) { .abf { padding: 16px; } }
.abf__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
</style>
