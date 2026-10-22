<script setup>
import { nextTick, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import { useAuth } from "@/composables/useAuth";
import { saveManagedRoom } from "@/api/roomManagement";
import { ROOM_FEATURES } from "@/app/utils/roomHelpers";

const { currentUser } = useAuth();
const dialog = ref(null);
const draft = ref({});
const deleting = ref(false);
const busy = ref(false);
const error = ref("");
const message = ref("");

function open(room, remove = false) {
  if (busy.value) return;
  deleting.value = remove;
  error.value = "";
  message.value = "";
  draft.value = room ? { ...room, features: [...room.features], status: room.status === "verified" ? "verified" : "unverified" } : {
    name: "", address: "", details: "", lat: null, lng: null, features: [], status: "unverified",
  };
  nextTick(() => dialog.value.showModal());
}
defineExpose({ edit: (room) => open(room), remove: (room) => open(room, true) });

async function save() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await saveManagedRoom(currentUser.value?.uid, draft.value, deleting.value);
    message.value = deleting.value ? "Room deleted." : "Room saved.";
    dialog.value.close();
  } catch (cause) {
    error.value = cause.code === "permission-denied"
      ? "You do not have permission to manage rooms. Sign in again or contact your administrator."
      : "Could not save the room. Check the details and your connection, then try again.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <p v-if="message" class="manager-message" role="status">{{ message }}</p>
  <dialog ref="dialog" class="manager" aria-labelledby="room-manager-title" @cancel="busy && $event.preventDefault()">
    <h2 id="room-manager-title" class="nt-heading nt-heading--sm">{{ deleting ? 'Delete pumping room' : draft.id ? 'Edit pumping room' : 'Add pumping room' }}</h2>
    <form @submit.prevent="save">
      <fieldset :disabled="busy" class="manager-fields">
        <p v-if="deleting">Delete {{ draft.name }} from the directory?</p>
        <template v-else>
          <label>Name<input v-model="draft.name" required maxlength="80" /></label>
          <label>Address<input v-model="draft.address" required maxlength="200" /></label>
          <label>Location details<textarea v-model="draft.details" required maxlength="200" placeholder="Level and directions to the room" /></label>
          <label>Latitude<input v-model.number="draft.lat" type="number" step="any" min="-90" max="90" required /></label>
          <label>Longitude<input v-model.number="draft.lng" type="number" step="any" min="-180" max="180" required /></label>
          <p>Use the room's confirmed coordinates from OneMap.</p>
          <fieldset><legend>Features</legend>
            <label v-for="[key, label] in ROOM_FEATURES" :key="key" class="manager-feature"><input v-model="draft.features" type="checkbox" :value="label" /> {{ label }}</label>
          </fieldset>
          <label>Verification<select v-model="draft.status"><option value="unverified">Needs verification</option><option value="verified">Verified</option></select></label>
        </template>
        <p v-if="error" class="app-error-text" role="alert">{{ error }}</p>
        <div class="manager-actions">
          <AppButton type="submit">{{ busy ? 'Saving…' : deleting ? 'Delete room' : 'Save room' }}</AppButton>
          <AppButton type="button" variant="outline" @click="dialog.close()">Cancel</AppButton>
        </div>
      </fieldset>
    </form>
  </dialog>
</template>

<style scoped>
.manager { width: min(480px, calc(100vw - 32px)); max-height: 85vh; padding: 24px; border: 1px solid var(--nt-line); border-radius: 12px; color: var(--nt-ink); background: var(--nt-white); }
.manager::backdrop { background: rgb(0 0 0 / 35%); }
.manager-fields { display: grid; gap: 14px; padding: 0; border: 0; }
label { display: grid; gap: 6px; }
input:not([type=checkbox]), textarea, select { width: 100%; padding: 10px; border: 1px solid var(--nt-line); border-radius: 6px; font: inherit; }
.manager-feature { display: flex; align-items: center; gap: 8px; }
.manager-actions { display: flex; gap: 8px; }
.manager-message { margin: 16px 24px; }
</style>
