<script setup>
import { babySummary } from "@/api/profile";
import { deleteBaby, updateBaby } from "@/api/profile";
import { ref, watch } from "vue";
import BabyFields from "@/app/components/BabyFields.vue";
import Icon from "@/app/components/Icon.vue";
import "@/app/app.css";

// One baby in the household, shown as its own card. `number` is the baby's place in the
// list, used when the baby has no name yet.
const props = defineProps({
  baby: { type: Object, required: true },
  number: { type: Number, required: true },
  editable: { type: Boolean, default: false },
  householdId: { type: String, default: "" },
  canDelete: { type: Boolean, default: false },
});
const emit = defineEmits(["changed", "deleted"]);
const line = () => babySummary(props.baby).line;
const initial = () => (props.baby.babyName || "").trim().charAt(0).toUpperCase() || String(props.number);

const editing = ref(false);
const confirmingDelete = ref(false);
const busy = ref(false);
const error = ref("");
const fields = ref({ name: "", status: "born", date: "" });

function resetFields() {
  fields.value = {
    name: props.baby.babyName ?? "",
    status: props.baby.babyStatus === "expected" ? "expected" : "born",
    date: props.baby.babyDate ?? "",
  };
}
watch(() => props.baby, resetFields, { immediate: true, deep: true });

function startEdit() {
  resetFields();
  error.value = "";
  confirmingDelete.value = false;
  editing.value = true;
}
function cancelEdit() {
  editing.value = false;
  error.value = "";
  resetFields();
}
async function save() {
  if (busy.value || !props.householdId) return;
  busy.value = true;
  error.value = "";
  try {
    await updateBaby(props.householdId, props.baby.id, {
      babyName: fields.value.name,
      babyStatus: fields.value.status,
      babyDate: fields.value.date,
    });
    editing.value = false;
    emit("changed", fields.value.name.trim() || `Baby ${props.number}`);
  } catch (cause) {
    console.error("[app baby edit]", cause?.code, cause);
    error.value = cause?.code === "permission-denied" ? "You do not have permission to edit this baby." : "We could not save these changes. Try again.";
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (busy.value || !props.canDelete || !props.householdId) return;
  busy.value = true;
  error.value = "";
  try {
    const name = props.baby.babyName || `Baby ${props.number}`;
    await deleteBaby(props.householdId, props.baby.id);
    emit("deleted", name);
  } catch (cause) {
    console.error("[app baby delete]", cause?.code, cause);
    error.value = cause?.code === "permission-denied"
        ? "You do not have permission to delete this baby."
        : "We could not delete this baby. Try again.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="bc" :class="{ 'bc--editing': editing }">
    <span class="bc__ava" aria-hidden="true">{{ initial() }}</span>
    <div v-if="!editing && !confirmingDelete" class="bc__body">
      <p class="bc__name">{{ baby.babyName || `Baby ${number}` }}</p>
      <p v-if="line()" class="bc__line">{{ line() }}</p>
    </div>
    <div v-if="!editing && !confirmingDelete" class="bc__side">
      <span class="bc__tag">{{ `Baby ${number}` }}</span>
      <div v-if="editable" class="bc__actions">
        <button type="button" class="bc__action" :disabled="busy" @click="startEdit"><Icon name="edit" :size="15" /> Edit</button>
        <span
          class="bc__delete-wrap"
          :title="canDelete ? 'Remove this baby from active care' : 'This baby cannot be removed'"
        >
          <button
            type="button"
            class="bc__action bc__action--delete"
            :disabled="busy || !canDelete"
            :aria-label="canDelete ? `Remove ${baby.babyName || `Baby ${number}`} from active care` : 'This baby cannot be removed'"
            @click="confirmingDelete = true"
          >
            <Icon :name="canDelete ? 'trash' : 'lock'" :size="15" /> Delete
          </button>
        </span>
      </div>
    </div>

    <form v-else class="bc__form" :aria-busy="busy" @submit.prevent="save">
      <BabyFields v-model="fields" :id-prefix="`baby-${baby.id}`" :disabled="busy" />
      <p v-if="error" class="bc__error" role="alert">{{ error }}</p>
      <div class="bc__form-actions">
        <button type="submit" class="bc__save" :disabled="busy">{{ busy ? "Saving…" : "Save changes" }}</button>
        <button type="button" class="bc__cancel" :disabled="busy" @click="cancelEdit">Cancel</button>
      </div>
    </form>

    <div v-if="confirmingDelete && !editing" class="bc__confirm" role="alertdialog" aria-label="Delete baby">
      <p>Remove {{ baby.babyName || `Baby ${number}` }}?</p>
      <span>They will no longer appear in active care. Existing care-log history is kept.</span>
      <div class="bc__form-actions">
        <button type="button" class="bc__delete" :disabled="busy" @click="remove">{{ busy ? "Removing…" : "Yes, remove" }}</button>
        <button type="button" class="bc__cancel" :disabled="busy" @click="confirmingDelete = false">Cancel</button>
      </div>
      <p v-if="error" class="bc__error" role="alert">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.bc { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 16px; width: 100%; padding: 18px 20px; background: linear-gradient(135deg, #fffdf8 0%, #fffaf2 100%); border: 1.5px solid #e7d3ad; border-bottom-width: 4px; border-radius: 22px; box-shadow: 0 5px 0 rgb(210 184 132 / 22%); }
.bc__ava { display: grid; place-items: center; flex: none; width: 54px; height: 54px; border: 1px solid rgb(47 93 67 / 8%); border-radius: 18px; background: #d7e9dc; color: #2f5d43; font-family: var(--nt-serif); font-size: 1.4rem; font-weight: 700; }
.bc__body { flex: 1; min-width: 0; }
.bc__name { margin: 0; font-family: var(--nt-serif); font-size: 1.25rem; font-weight: 700; line-height: 1.25; color: var(--ink, #1f2a52); }
.bc__line { margin: 4px 0 0; font-size: 0.9rem; line-height: 1.4; color: var(--mut, #5b6692); }
.bc__side { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-left: auto; }
.bc__tag { padding: 5px 11px; background: #fbe3d3; border: 1px solid rgb(138 63 20 / 8%); border-radius: 999px; color: #8a3f14; font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
.bc__actions, .bc__form-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.bc__action, .bc__save, .bc__cancel, .bc__delete { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 8px 13px; border: 1.5px solid #d8c8aa; border-radius: 11px; background: #fff; color: #243560; font: inherit; font-size: 0.8125rem; font-weight: 700; cursor: pointer; transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease; }
.bc__action:not(.bc__action--delete) { background: #243560; border-color: #243560; color: #fff; }
.bc__action:not(.bc__action--delete):hover { background: #1b2a4f; border-color: #1b2a4f; transform: translateY(-1px); }
.bc__cancel:hover { background: #f6ead8; }
.bc__action--delete, .bc__delete { border-color: #d88b70; color: #8a351d; }
.bc__action--delete:hover:not(:disabled) { background: #fff1eb; border-color: #bd6345; transform: translateY(-1px); }
.bc__delete-wrap { display: inline-flex; }
.bc__action--delete:disabled { background: #f3efe8; border-color: #ddd3c4; color: #8b857b; opacity: 1; }
.bc__delete { background: #8a351d; color: #fff; }
.bc__save { background: #243560; border-color: #243560; color: #fff; }
.bc__action:focus-visible, .bc__save:focus-visible, .bc__cancel:focus-visible, .bc__delete:focus-visible { outline: 3px solid #243560; outline-offset: 2px; }
.bc button:disabled { opacity: 0.6; cursor: not-allowed; }
.bc--editing { align-items: flex-start; }
.bc__form { grid-column: 2 / -1; min-width: 0; }
.bc__form :deep(.app-stack) { gap: 14px; }
.bc__form-actions { margin-top: 14px; }
.bc__confirm { grid-column: 2 / -1; min-width: 0; padding: 14px 16px; background: #fff4ef; border: 1px solid #e6a38a; border-radius: 14px; color: #6f2b18; }
.bc__confirm p { margin: 0; font-weight: 700; }
.bc__confirm span { display: block; margin: 2px 0 10px; font-size: 0.8125rem; }
.bc__error { margin: 10px 0 0; color: #8a351d; font-size: 0.8125rem; font-weight: 600; }
@media (max-width: 575px) {
  .bc { grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 12px; padding: 14px; }
  .bc__ava { width: 48px; height: 48px; border-radius: 15px; }
  .bc__side { grid-column: 1 / -1; width: 100%; margin: 2px 0 0; padding-top: 12px; border-top: 1px solid #eadcc3; }
  .bc__tag { margin-right: auto; }
  .bc__actions { justify-content: flex-end; }
  .bc__action { min-height: 44px; }
  .bc--editing .bc__form, .bc__confirm { grid-column: 1 / -1; }
}
</style>
