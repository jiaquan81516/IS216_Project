<script setup>
import { nextTick, ref } from "vue";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/api/db";
import { useAuth } from "@/composables/useAuth";
import { hasAdminClaim } from "@/api/adminAccess";
import AppButton from "@/components/ui/AppButton.vue";
import Icon from "@/app/components/Icon.vue";

const { currentUser } = useAuth();
const emit = defineEmits(["saved"]);
const dialog = ref(null);
const busy = ref(false);
const error = ref("");
const deleting = ref(false);
const targetId = ref(null);
const empty = () => ({ title: "", blurb: "", intro: "", steps: [{ title: "", body: "" }], callIf: "" });
const draft = ref(empty());
async function open(guide = null, remove = false) {
  if (busy.value) return;
  if (!await hasAdminClaim(currentUser.value)) return;
  deleting.value = remove;
  targetId.value = guide ? (guide.id || `seed-${guide.slug}`) : null;
  draft.value = guide ? { ...guide, steps: guide.steps.map((step) => ({ ...step })), callIf: guide.callIf.join("\n") } : empty();
  error.value = "";
  await nextTick();
  dialog.value.showModal();
}
function close() { if (!busy.value) dialog.value.close(); }
defineExpose({ open, edit: (guide) => open(guide), remove: (guide) => open(guide, true) });
async function save() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    if (!await hasAdminClaim(currentUser.value)) throw new Error("Admin access is required.");
    const target = targetId.value ? doc(db, "supportGuides", targetId.value) : doc(collection(db, "supportGuides"));
    if (deleting.value) {
      await setDoc(target, { deleted: true, createdBy: currentUser.value.uid, createdAt: serverTimestamp() });
      dialog.value.close();
      emit("saved", "Guide deleted.");
      return;
    }
    const guide = {
      title: draft.value.title.trim(), blurb: draft.value.blurb.trim(), intro: draft.value.intro.trim(),
      steps: draft.value.steps.map((step) => ({ title: step.title.trim(), body: step.body.trim() })),
      callIf: draft.value.callIf.split("\n").map((line) => line.trim()).filter(Boolean),
    };
    if (!guide.title || !guide.blurb || !guide.intro || guide.steps.some((s) => !s.title || !s.body) || !guide.callIf.length || guide.callIf.length > 10 || guide.callIf.some((s) => s.length > 400)) {
      throw new Error("Complete each field. Enter up to 10 doctor-call reasons, with at most 400 characters per line.");
    }
    await setDoc(target, { ...guide, createdBy: currentUser.value.uid, createdAt: serverTimestamp() });
    dialog.value.close();
    emit("saved", targetId.value ? "Guide updated." : "Guide added.");
  } catch (cause) {
    error.value = cause.code ? "Could not save the guide. Check your admin access and connection, then try again." : cause.message;
  } finally { busy.value = false; }
}
</script>

<template>
  <dialog ref="dialog" class="guide-manager" aria-labelledby="guide-manager-title" @cancel.prevent="close">
    <header class="guide-manager__head">
      <h2 id="guide-manager-title" class="nt-heading nt-heading--sm">{{ deleting ? 'Delete guide' : targetId ? 'Edit guide' : 'Add a guide' }}</h2>
      <button type="button" class="guide-manager__close" aria-label="Close guide manager" :disabled="busy" @click="close"><Icon name="close" :size="18" /></button>
    </header>
    <form @submit.prevent="save">
      <fieldset class="guide-manager__fields" :disabled="busy">
        <p v-if="deleting">Delete “{{ draft.title }}” from the guides?</p>
        <template v-else>
        <label>Title<input v-model="draft.title" class="form-control" required maxlength="120" placeholder="Guide title" /></label>
        <label>Short summary<input v-model="draft.blurb" class="form-control" required maxlength="300" placeholder="Brief description shown on the card" /></label>
        <label>Introduction<textarea v-model="draft.intro" class="form-control" required maxlength="2000" rows="3" /></label>
        <fieldset v-for="(step, index) in draft.steps" :key="index" class="guide-manager__step">
          <legend>Step {{ index + 1 }}</legend>
          <label>Step title<input v-model="step.title" class="form-control" required maxlength="120" /></label>
          <label>Instructions<textarea v-model="step.body" class="form-control" required maxlength="2000" rows="3" /></label>
          <button v-if="draft.steps.length > 1" type="button" class="app-textbtn" @click="draft.steps.splice(index, 1)">Remove step {{ index + 1 }}</button>
        </fieldset>
        <AppButton v-if="draft.steps.length < 6" size="sm" variant="outline" @click="draft.steps.push({ title: '', body: '' })">Add a step</AppButton>
        <label>Call your doctor if<textarea v-model="draft.callIf" class="form-control" required maxlength="4009" rows="4" placeholder="Enter one reason per line" /></label>
        </template>
        <p v-if="error" class="app-error-text" role="alert">{{ error }}</p>
        <div class="guide-manager__actions">
          <AppButton type="submit" size="sm">{{ busy ? 'Saving…' : deleting ? 'Delete guide' : 'Save guide' }}</AppButton>
          <AppButton size="sm" variant="outline" @click="close">Cancel</AppButton>
        </div>
      </fieldset>
    </form>
  </dialog>
</template>

<style scoped>
.guide-manager { width: min(480px, calc(100vw - 32px)); max-height: 85vh; padding: 24px; border: 1px solid var(--nt-line); border-radius: 12px; color: var(--nt-ink); background: var(--nt-white); }
.guide-manager::backdrop { background: rgb(0 0 0 / 35%); }
.guide-manager__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.guide-manager__head h2, form, p { margin: 0; }
.guide-manager__close { display: inline-flex; padding: 6px; background: transparent; border: 0; border-radius: 8px; color: var(--nt-muted); cursor: pointer; }
.guide-manager__close:hover { background: var(--nt-gray); color: var(--nt-ink); }
.guide-manager__close:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.guide-manager__fields, .guide-manager__step { display: grid; gap: 16px; min-width: 0; margin: 0; padding: 0; border: 0; }
label { display: grid; gap: 8px; font-size: 0.875rem; font-weight: 600; }
legend { float: none; width: auto; margin: 0 0 8px; font-size: 0.875rem; font-weight: 600; }
.form-control { margin: 0; padding: 10px 12px; }
.guide-manager__actions { display: flex; gap: 8px; }
</style>
