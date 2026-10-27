<script setup>
import AdminRoomCard from "@/app/components/admin/AdminRoomCard.vue";
import { useAuth } from "@/composables/useAuth";
import { formatDate } from "@/app/utils/adminHelpers";
import "@/app/app.css";

// The record of accepted and rejected rooms, so a rejection can always be explained.
defineProps({
  rooms: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
});

const { currentUser } = useAuth();
const who = (room) => (room.reviewedBy && room.reviewedBy === currentUser.value?.uid ? "you" : "another administrator");
</script>

<template>
  <div class="rv">
    <p v-if="loading" class="rv__muted" role="status">Loading...</p>
    <p v-else-if="error" class="app-error-text" role="alert">{{ error }}</p>
    <p v-else-if="!rooms.length" class="rv__muted">No rooms have been reviewed yet.</p>

    <ul v-if="rooms.length" class="rv__list" aria-label="Reviewed rooms">
      <AdminRoomCard v-for="room in rooms" :key="room.id" :room="room" :pill="room.approval === 'approved' ? 'Accepted' : 'Rejected'">
        <p class="rv__muted">{{ room.approval === "approved" ? "Accepted" : "Rejected" }} {{ formatDate(room.reviewedAt) }} by {{ who(room) }}</p>
        <p v-if="room.reviewNote" class="rv__text">Reason: {{ room.reviewNote }}</p>
      </AdminRoomCard>
    </ul>
  </div>
</template>

<style scoped>
.rv { display: flex; flex-direction: column; gap: 16px; max-width: 720px; }
.rv__list { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.rv__muted { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.rv__text { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
</style>
