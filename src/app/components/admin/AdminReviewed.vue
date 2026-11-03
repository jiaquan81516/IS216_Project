<script setup>
import { computed, ref, watch } from "vue";
import AppPager from "@/app/components/AppPager.vue";
import SkeletonList from "@/app/components/SkeletonList.vue";
import AdminRoomCard from "@/app/components/admin/AdminRoomCard.vue";
import { useAuth } from "@/composables/useAuth";
import { formatDate } from "@/app/utils/adminHelpers";
import "@/app/app.css";

// The record of accepted and rejected rooms, so a rejection can always be explained.
const props = defineProps({
  rooms: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
});

const PAGE_SIZE = 25;
const page = ref(1);
const shown = computed(() => props.rooms.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));
watch(() => props.rooms.length, () => { if ((page.value - 1) * PAGE_SIZE >= props.rooms.length) page.value = 1; });

const { currentUser } = useAuth();
const who = (room) => (room.reviewedBy && room.reviewedBy === currentUser.value?.uid ? "you" : "another administrator");
</script>

<template>
  <div class="rv">
    <SkeletonList v-if="loading" :rows="3" :height="96" label="Loading" />
    <p v-else-if="error" class="app-error-text" role="alert">{{ error }}</p>
    <p v-else-if="!rooms.length" class="rv__muted">No rooms have been reviewed yet.</p>

    <ul v-if="rooms.length" class="rv__list" aria-label="Reviewed rooms">
      <AdminRoomCard v-for="room in shown" :key="room.id" :room="room" :pill="room.approval === 'approved' ? 'Accepted' : 'Rejected'">
        <p class="rv__muted">{{ room.approval === "approved" ? "Accepted" : "Rejected" }} {{ formatDate(room.reviewedAt) }} by {{ who(room) }}</p>
        <p v-if="room.reviewNote" class="rv__text">Reason: {{ room.reviewNote }}</p>
      </AdminRoomCard>
    </ul>
    <AppPager v-model="page" :total="rooms.length" :page-size="PAGE_SIZE" label="Reviewed room pages" />
  </div>
</template>

<style scoped>
.rv { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.rv__list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
@media (max-width: 991px) { .rv__list { grid-template-columns: minmax(0, 1fr); } }
.rv__muted { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.rv__text { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
</style>
