<script setup>
import { nextTick, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import Icon from "@/app/components/Icon.vue";
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
    name: "", address: "", details: "", roomType: "", feedback: "", lat: null, lng: null, features: [], status: "unverified",
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
    error.value = cause.code?.startsWith("rooms/") ? cause.message : cause.code === "permission-denied"
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
    <div class="manager-head">
      <h2 id="room-manager-title" class="nt-heading nt-heading--sm">{{ deleting ? 'Delete pumping room' : draft.id ? 'Edit pumping room' : 'Add a pumping room' }}</h2>
      <button type="button" class="manager-close" aria-label="Close room manager" :disabled="busy" @click="dialog.close()"><Icon name="close" :size="18" /></button>
    </div>
    <form @submit.prevent="save">
      <fieldset :disabled="busy" class="manager-fields">
        <p v-if="deleting">Delete {{ draft.name }} from the directory?</p>
        <template v-else>
          <label>Name of location<input class="form-control" v-model="draft.name" required maxlength="80" /></label>
          <label>Address (including postal code)<input class="form-control" v-model="draft.address" required maxlength="200" placeholder="e.g. 1 Example Road, Singapore 012345" /></label>
          <label>Location details<textarea class="form-control" v-model="draft.details" required maxlength="200" placeholder="Level and directions to the room" /></label>
          <label>Room type<select class="form-select" v-model="draft.roomType" required>
            <option disabled value="">Choose a room type</option>
            <option>Pumping room</option>
            <option>Nursing room</option>
            <option>Baby care room</option>
            <option>Shared nursing and pumping room</option>
          </select></label>
          <fieldset><legend>Features</legend>
            <p id="pr-features-hint" class="pr__muted">Select all the features available.</p>

            <div class="manager-chips">
              <label v-for="[key, label] in ROOM_FEATURES" :key="key" class="manager-feature">
                <input v-model="draft.features" class="manager-feature-input" type="checkbox" :value="label" />
                <span class="manager-feature-pill">
                  <span class="manager-feature-mark" aria-hidden="true"><Icon :name="draft.features?.includes(label) ? 'check' : 'plus'" :size="14" /></span>
                  {{ label }}
                </span>
              </label>
            </div>
          </fieldset>
          <label>Parent feedback (optional)<textarea class="form-control" v-model.trim="draft.feedback" maxlength="400" rows="3" /></label>
          <label>Verification<select class="form-select" v-model="draft.status"><option value="unverified">Needs verification</option><option value="verified">Verified</option></select></label>
        </template>
        <p v-if="error" class="app-error-text" role="alert">{{ error }}</p>
        <div class="manager-actions">
          <AppButton type="submit" size="sm">{{ busy ? 'Saving…' : deleting ? 'Delete room' : 'Save room' }}</AppButton>
          <AppButton type="button" size="sm" variant="outline" @click="dialog.close()">Cancel</AppButton>
        </div>
      </fieldset>
    </form>
  </dialog>
</template>

<style scoped>
.manager { width: min(480px, calc(100vw - 32px)); max-height: 85vh; padding: 24px; border: 1px solid var(--nt-line); border-radius: 12px; color: var(--nt-ink); background: var(--nt-white); }
.manager::backdrop { background: rgb(0 0 0 / 35%); }
.manager[open] { display: flex; flex-direction: column; gap: 16px; }
.manager-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.manager-head h2, .manager > form { margin: 0; }
.manager-close { display: inline-flex; padding: 6px; background: transparent; border: 0; border-radius: 8px; color: var(--nt-muted); cursor: pointer; }
.manager-close:hover { background: var(--nt-gray); color: var(--nt-ink); }
.manager-close:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.manager-close:disabled { cursor: default; opacity: 0.6; }
.manager-fields { display: grid; gap: 16px; margin: 0; padding: 0; border: 0; min-width: 0; }
.manager-fields p { margin: 0; font-size: 0.875rem; font-weight: 400; line-height: 1.5; color: var(--nt-muted); }
.manager-fields > fieldset { display: grid; gap: 8px; min-width: 0; margin: 0; padding: 0; border: 0; }
.manager-fields legend { float: none; width: auto; margin: 0 0 8px; font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
label { display: grid; gap: 8px; margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
input:not([type=checkbox]), textarea, select { box-sizing: border-box; width: 100%; margin: 0; padding: 10px 12px; font-family: inherit; font-size: 1rem; font-weight: 400; line-height: 1.5; }
.manager-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; }
.manager-feature { position: relative; cursor: pointer; }
.manager-feature-input { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.manager-feature-pill { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 14px; border: 1px solid var(--nt-line); border-radius: 999px; background: var(--nt-white); color: var(--nt-muted); font-size: 0.875rem; font-weight: 500; line-height: 1.4; transition: background-color 150ms, border-color 150ms, color 150ms; }
.manager-feature-mark { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; background: var(--nt-gray); }
.manager-feature:hover .manager-feature-input:not(:disabled) + .manager-feature-pill { border-color: var(--nt-plum); color: var(--nt-plum); }
.manager-feature-input:checked + .manager-feature-pill { background: #f3eef4; border-color: var(--nt-plum); color: var(--nt-plum); }
.manager-feature-input:checked + .manager-feature-pill .manager-feature-mark { background: var(--nt-plum); color: var(--nt-white); }
.manager-feature-input:focus-visible + .manager-feature-pill { outline: 2px solid var(--nt-plum); outline-offset: 3px; }
.manager-feature:has(:disabled) { cursor: default; opacity: 0.6; }
@media (prefers-reduced-motion: reduce) { .manager-feature-pill { transition: none; } }
.manager-actions { display: flex; gap: 8px; }
.manager-message { margin: 16px 24px; }
</style>
