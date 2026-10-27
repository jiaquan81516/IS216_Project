<script setup>
import { ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AdminRoomCard from "@/app/components/admin/AdminRoomCard.vue";
import { useAuth } from "@/composables/useAuth";
import { REVIEW_NOTE_MAX, reviewRoom } from "@/api/roomApproval";
import { formatDate } from "@/app/utils/adminHelpers";
import "@/app/app.css";

// Rooms parents suggested. Accept puts one on the public list. Reject keeps it, with an
// optional reason, and it never goes live.
defineProps({
  rooms: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
});

const { currentUser } = useAuth();
const rejecting = ref("");
const note = ref("");
const busyId = ref("");
const actionError = ref("");

async function decide(room, decision) {
  if (busyId.value) return;
  busyId.value = room.id;
  actionError.value = "";
  try {
    await reviewRoom(currentUser.value?.uid, room.id, decision, note.value);
    rejecting.value = "";
    note.value = "";
  } catch (cause) {
    console.error("[app room review]", cause?.code, cause);
    actionError.value =
      cause?.code === "permission-denied"
        ? "The database refused that. Publish the latest firestore.rules and check this account has the admin claim."
        : "We could not save that decision. Try again.";
  } finally {
    busyId.value = "";
  }
}

function startReject(room) {
  rejecting.value = room.id;
  note.value = "";
  actionError.value = "";
}
</script>

<template>
  <div class="ap">
    <p v-if="loading" class="ap__muted" role="status">Loading...</p>
    <p v-else-if="error" class="app-error-text" role="alert">{{ error }}</p>
    <p v-else-if="!rooms.length" class="ap__muted">No rooms waiting for review.</p>
    <p v-if="actionError" class="app-error-text" role="alert">{{ actionError }}</p>

    <ul v-if="rooms.length" class="ap__list" aria-label="Rooms waiting for review">
      <AdminRoomCard v-for="room in rooms" :key="room.id" :room="room">
        <p v-if="formatDate(room.createdAt)" class="ap__muted">Submitted {{ formatDate(room.createdAt) }}</p>
        <div v-if="rejecting === room.id" class="ap__reject">
          <label :for="`ap-note-${room.id}`" class="ap__label">Reason (optional)</label>
          <textarea :id="`ap-note-${room.id}`" v-model="note" class="form-control" rows="2" :maxlength="REVIEW_NOTE_MAX" :disabled="busyId === room.id"></textarea>
          <div class="arc__actions">
            <AppButton variant="outline" size="sm" :disabled="busyId === room.id" @click="decide(room, 'rejected')">Confirm reject</AppButton>
            <AppButton variant="outline" size="sm" :disabled="busyId === room.id" @click="rejecting = ''">Cancel</AppButton>
          </div>
        </div>
        <div v-else class="arc__actions">
          <AppButton variant="outline" size="sm" :disabled="!!busyId" @click="startReject(room)">Reject</AppButton>
          <AppButton size="sm" :disabled="!!busyId" @click="decide(room, 'approved')">{{ busyId === room.id ? "Saving..." : "Accept" }}</AppButton>
        </div>
      </AdminRoomCard>
    </ul>
  </div>
</template>

<style scoped>
.ap { display: flex; flex-direction: column; gap: 16px; max-width: 720px; }
.ap__list { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.ap__muted { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.ap__reject { display: flex; flex-direction: column; gap: 6px; width: 100%; margin-top: 12px; }
.ap__label { font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
</style>
