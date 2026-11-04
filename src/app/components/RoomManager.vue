<script setup>
import { nextTick, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AddressPicker from "@/app/components/AddressPicker.vue";
import { useAuth } from "@/composables/useAuth";
import { saveManagedRoom } from "@/api/roomManagement";
import { editRoomFeedback, subscribeAdminRoomFeedback } from "@/api/roomFeedbackAdmin";
import { ROOM_FEATURES } from "@/app/utils/roomHelpers";

const { currentUser } = useAuth();
const dialog = ref(null);
const draft = ref({});
const deleting = ref(false);
const busy = ref(false);
const error = ref("");
const message = ref("");

// Parent-submitted feedback for the room being edited, shown here as its own editable block
// so there is one edit entry point for a room instead of a separate "edit feedback" action.
let stopFeedback = null;
const feedbackItems = ref([]);
const feedbackLoading = ref(false);
const feedbackLoadError = ref("");
const feedbackEditingId = ref(null);
const feedbackDraft = ref("");
const feedbackSaving = ref(false);
const feedbackSaveError = ref("");

function loadFeedback(roomId) {
  stopFeedback?.();
  stopFeedback = null;
  feedbackItems.value = [];
  feedbackLoadError.value = "";
  feedbackEditingId.value = null;
  if (!roomId) return;
  feedbackLoading.value = true;
  stopFeedback = subscribeAdminRoomFeedback(
    roomId,
    (data) => {
      feedbackItems.value = data;
      feedbackLoading.value = false;
    },
    () => {
      feedbackLoading.value = false;
      feedbackLoadError.value = "Could not load parent feedback. Check your admin access and connection, then try again.";
    },
  );
}
function editFeedbackItem(item) {
  feedbackEditingId.value = item.id;
  feedbackDraft.value = item.text;
  feedbackSaveError.value = "";
}
function cancelFeedbackEdit() {
  feedbackEditingId.value = null;
}
async function saveFeedbackItem(item) {
  if (feedbackSaving.value) return;
  feedbackSaving.value = true;
  feedbackSaveError.value = "";
  try {
    const uid = currentUser.value?.uid;
    const text = feedbackDraft.value;
    await editRoomFeedback(uid, item.roomId, item.id, text);
    Object.assign(item, { text: text.trim(), editedBy: uid });
    feedbackEditingId.value = null;
  } catch {
    feedbackSaveError.value = "Could not save feedback. Check your admin access and connection, then try again.";
  } finally {
    feedbackSaving.value = false;
  }
}

function open(room, remove = false) {
  if (busy.value) return;
  deleting.value = remove;
  error.value = "";
  message.value = "";
  draft.value = room ? { ...room, features: [...room.features], status: room.status === "verified" ? "verified" : "unverified" } : {
    name: "", address: "", details: "", lat: null, lng: null, features: [], status: "unverified",
  };
  if (!remove) loadFeedback(draft.value.id);
  else { stopFeedback?.(); stopFeedback = null; feedbackItems.value = []; }
  nextTick(() => dialog.value.showModal());
}
// Closing eases out (the same way it eased in) before the dialog is really closed.
const closing = ref(false);
function closeDialog() {
  const el = dialog.value;
  if (!el?.open || closing.value) return;
  const finish = () => {
    el.close();
    stopFeedback?.();
    stopFeedback = null;
  };
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return finish();
  closing.value = true;
  window.setTimeout(() => {
    closing.value = false;
    finish();
  }, 180);
}
// A click that lands on the dialog element itself (never a descendant) is a click on the
// backdrop, since the visible card is sized to its content. Closing there, like Esc, eases out
// instead of relying on the Cancel button.
function onBackdropClick(event) {
  if (event.target === dialog.value && !busy.value) closeDialog();
}
defineExpose({ edit: (room) => open(room), remove: (room) => open(room, true) });

async function save() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await saveManagedRoom(currentUser.value?.uid, draft.value, deleting.value);
    message.value = deleting.value ? "Room deleted." : "Room saved.";
    closeDialog();
  } catch (cause) {
    // The real reason goes to the console and, for an unknown failure, onto the screen.
    console.error("[app room manager]", cause?.code, cause?.message, cause);
    const code = String(cause?.code ?? "");
    error.value = code.startsWith("rooms/") ? cause.message
      : code === "permission-denied"
        ? "You do not have permission to manage rooms. Sign in again, or publish the latest firestore.rules."
        : code === "unavailable" || code === "server/unreachable"
          ? "Could not reach the server. Check your connection and try again."
          : `Could not save the room (${code || cause?.name || "unknown error"}: ${String(cause?.message ?? "").slice(0, 160)}).`;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <p v-if="message" class="manager-message" role="status">{{ message }}</p>
  <dialog ref="dialog" class="manager" :class="{ 'manager--closing': closing }" aria-labelledby="room-manager-title" @cancel.prevent="!busy && closeDialog()" @click="onBackdropClick">
    <div class="manager-body">
    <h2 id="room-manager-title" class="nt-heading nt-heading--sm">{{ deleting ? 'Delete pumping room' : draft.id ? 'Edit pumping room' : 'Add pumping room' }}</h2>
    <form @submit.prevent="save">
      <fieldset :disabled="busy" class="manager-fields">
        <p v-if="deleting">Delete {{ draft.name }} from the directory?</p>
        <template v-else>
          <AddressPicker id="rm-place" />
          <label>Name<input v-model="draft.name" required maxlength="80" /></label>
          <label>Address (including postal code)<input v-model="draft.address" required maxlength="200" placeholder="e.g. 1 Example Road, Singapore 012345" /></label>
          <label>Location details<textarea v-model="draft.details" required maxlength="200" placeholder="Level and directions to the room" /></label>
          <label>Feedback saved with room details<textarea v-model="draft.feedback" maxlength="400" rows="3" /></label>
          <fieldset><legend>Features</legend>
            <label v-for="[key, label] in ROOM_FEATURES" :key="key" class="manager-feature"><input v-model="draft.features" type="checkbox" :value="label" /> {{ label }}</label>
          </fieldset>
          <label>Verification<select v-model="draft.status"><option value="unverified">Needs verification</option><option value="verified">Verified</option></select></label>
        </template>
        <p v-if="error" class="app-error-text" role="alert">{{ error }}</p>
        <div class="manager-actions">
          <AppButton type="submit">{{ busy ? 'Saving…' : deleting ? 'Delete room' : 'Save room' }}</AppButton>
          <AppButton type="button" variant="outline" @click="closeDialog">Cancel</AppButton>
        </div>
      </fieldset>
    </form>

    <fieldset v-if="!deleting && draft.id" class="manager-feedback" :disabled="busy">
      <legend class="nt-heading nt-heading--sm">Parent feedback</legend>
      <p v-if="feedbackLoading" role="status">Loading feedback…</p>
      <div v-if="feedbackLoadError" role="alert">
        <p>{{ feedbackLoadError }}</p>
        <AppButton size="sm" variant="outline" type="button" @click="loadFeedback(draft.id)">Try again</AppButton>
      </div>
      <p v-if="!feedbackLoading && !feedbackLoadError && !feedbackItems.length">No parent feedback for this room yet.</p>
      <ul v-if="feedbackItems.length" class="manager-feedback-list">
        <li v-for="item in feedbackItems" :key="item.id" class="manager-feedback-item">
          <p class="manager-feedback-meta">{{ item.at?.toDate?.().toLocaleString() || "" }}<span v-if="item.editedBy"> · Edited by an administrator</span></p>
          <template v-if="feedbackEditingId === item.id">
            <label :for="`manager-feedback-${item.id}`" class="visually-hidden">Edit parent feedback</label>
            <textarea :id="`manager-feedback-${item.id}`" v-model="feedbackDraft" rows="3" maxlength="400" :disabled="feedbackSaving" />
            <p v-if="feedbackSaveError" class="app-error-text" role="alert">{{ feedbackSaveError }}</p>
            <div class="manager-actions">
              <AppButton size="sm" type="button" :disabled="feedbackSaving || !feedbackDraft.trim()" @click="saveFeedbackItem(item)">{{ feedbackSaving ? "Saving…" : "Save feedback" }}</AppButton>
              <AppButton size="sm" variant="outline" type="button" :disabled="feedbackSaving" @click="cancelFeedbackEdit">Cancel</AppButton>
            </div>
          </template>
          <template v-else>
            <p class="manager-feedback-text">{{ item.text }}</p>
            <AppButton size="sm" variant="outline" type="button" @click="editFeedbackItem(item)">Edit feedback</AppButton>
          </template>
        </li>
      </ul>
    </fieldset>
    </div>
  </dialog>
</template>

<style scoped>
.manager { width: min(480px, calc(100vw - 32px)); max-height: 85vh; padding: 0; border: 1px solid #e9d9b8; border-bottom-width: 4px; border-radius: 24px; color: #1f2a52; background: #fdf9f0; }
.manager-body { padding: 24px 26px 26px; }
.manager::backdrop { background: rgb(24 34 70 / 45%); }
.manager[open] { animation: manager-fade 220ms ease-out both; }
.manager[open]::backdrop { animation: manager-fade 220ms ease-out both; }
.manager--closing[open] { animation: manager-fade-out 180ms ease-in both; }
.manager--closing[open]::backdrop { animation: manager-fade-out 180ms ease-in both; }
@keyframes manager-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes manager-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .manager[open], .manager[open]::backdrop, .manager--closing[open], .manager--closing[open]::backdrop { animation: none; } }
.manager-fields { display: grid; gap: 14px; padding: 0; border: 0; }
label { display: grid; gap: 6px; }
input:not([type=checkbox]), textarea, select { width: 100%; padding: 10px; border: 1px solid var(--nt-line); border-radius: 6px; font: inherit; }
.manager-feature { display: flex; align-items: center; gap: 8px; }
.manager-actions { display: flex; gap: 8px; }
.manager-message { margin: 16px 24px; }
.manager-feedback { display: flex; flex-direction: column; gap: 10px; margin: 18px 0 0; padding: 16px 0 0; border: 0; border-top: 1px dashed #e9d9b8; }
.manager-feedback > legend { padding: 0; }
.manager-feedback-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.manager-feedback-item { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 14px 16px; background: #fff; border: 1px solid #e9d9b8; border-radius: 14px; }
.manager-feedback-meta { margin: 0; font-size: 0.8125rem; color: #6b7392; }
.manager-feedback-text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
