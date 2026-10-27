<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import PumpingRooms from "@/app/pages/pumping-rooms/index.vue";
import SupportPage from "@/app/pages/support/index.vue";
import AdminPending from "@/app/components/admin/AdminPending.vue";
import AdminReviewed from "@/app/components/admin/AdminReviewed.vue";
import { useAdminRooms } from "@/app/composables/useAdminRooms";
import { ADMIN_SECTIONS } from "@/app/data/nav";
import { roomView } from "@/app/utils/roomHelpers";
import "@/app/app.css";

defineOptions({ name: "AdminRoomsPage" });

// The administrator's page. The sidebar picks the section. Pending: rooms parents suggested.
// Live rooms: the directory everyone sees. Reviewed: the record of past decisions.
// Support: the Support page with edit controls.
const route = useRoute();
const section = computed(() => (ADMIN_SECTIONS.some((s) => s.id === route.query.tab) ? route.query.tab : ADMIN_SECTIONS[0].id));
const { pending, reviewed } = useAdminRooms();

// Keep the review fields next to the display fields roomView builds.
const view = (docs) =>
  docs.map((doc) => ({
    ...roomView(doc.id, doc),
    createdAt: doc.createdAt,
    approval: doc.approval,
    reviewedAt: doc.reviewedAt,
    reviewedBy: doc.reviewedBy,
    reviewNote: doc.reviewNote,
  }));
const pendingRooms = computed(() => view(pending.list.value));
const reviewedRooms = computed(() => view(reviewed.list.value));
</script>

<template>
  <div class="adm">
    <section v-if="section === 'pending'" class="adm__section" aria-labelledby="adm-pending-title">
      <h1 id="adm-pending-title" class="nt-title">Pending rooms<span v-if="pendingRooms.length"> ({{ pendingRooms.length }})</span></h1>
      <AdminPending :rooms="pendingRooms" :loading="pending.loading.value" :error="pending.error.value" />
    </section>
    <PumpingRooms v-else-if="section === 'live'" />
    <section v-else-if="section === 'reviewed'" class="adm__section" aria-labelledby="adm-reviewed-title">
      <h1 id="adm-reviewed-title" class="nt-title">Reviewed rooms</h1>
      <AdminReviewed :rooms="reviewedRooms" :loading="reviewed.loading.value" :error="reviewed.error.value" />
    </section>
    <SupportPage v-else />
  </div>
</template>

<style scoped>
.adm :deep(.pr--list) { min-height: 0; }
.adm__section { display: flex; flex-direction: column; gap: 24px; }
</style>
