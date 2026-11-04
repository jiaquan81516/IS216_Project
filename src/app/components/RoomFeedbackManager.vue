<script setup>
import { computed, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppPager from "@/app/components/AppPager.vue";
import { useAuth } from "@/composables/useAuth";
import { editRoomFeedback, subscribeAdminRoomFeedback } from "@/api/roomFeedbackAdmin";

const props = defineProps({
  roomId: { type: String, default: "" },
  rooms: { type: Array, default: () => [] },
});
const emit = defineEmits(["edit-room"]);
const { currentUser } = useAuth();
const items = ref([]);
const loading = ref(true);
const loadError = ref("");
const saveError = ref("");
const message = ref("");
const editing = ref(null);
const saving = ref(false);
const retry = ref(0);
const PAGE_SIZE = 25;
const page = ref(1);
const roomNames = computed(() => new Map(props.rooms.map((room) => [room.id, room.name])));
const legacyRooms = computed(() => props.rooms.filter((room) => room.feedback && (!props.roomId || room.id === props.roomId)));
// Rooms saved with feedback come first, then parent feedback, 25 to a page.
const everyItem = computed(() => [...legacyRooms.value.map((room) => ({ legacy: true, room })), ...items.value.map((item) => ({ legacy: false, item }))]);
const onPage = computed(() => everyItem.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));
const pagedParent = computed(() => onPage.value.filter((e) => !e.legacy).map((e) => e.item));
const pagedLegacy = computed(() => onPage.value.filter((e) => e.legacy).map((e) => e.room));
watch([() => props.roomId, retry], () => { page.value = 1; });
watch(() => everyItem.value.length, (n) => { while (page.value > 1 && (page.value - 1) * PAGE_SIZE >= n) page.value -= 1; });

watch([() => props.roomId, retry], ([roomId], _previous, onCleanup) => {
  let active = true;
  loading.value = true;
  loadError.value = "";
  items.value = [];
  editing.value = null;
  const stop = subscribeAdminRoomFeedback(roomId, (data) => {
    if (!active) return;
    items.value = data;
    loading.value = false;
  }, () => {
    if (!active) return;
    loading.value = false;
    loadError.value = "Could not load feedback. Check your admin access and connection, then try again.";
  });
  onCleanup(() => { active = false; stop(); });
}, { immediate: true });

function isEditing(item) {
  return editing.value?.id === item.id && editing.value?.roomId === item.roomId;
}
function edit(item) {
  editing.value = { ...item };
  saveError.value = "";
  message.value = "";
}
async function save() {
  if (saving.value || !editing.value) return;
  saving.value = true;
  saveError.value = "";
  try {
    const { roomId, id, text } = editing.value;
    const uid = currentUser.value?.uid;
    await editRoomFeedback(uid, roomId, id, text);
    // Update immediately; the listener also keeps other admin views in sync.
    const item = items.value.find(isEditing);
    if (item) Object.assign(item, { text: text.trim(), editedBy: uid });
    editing.value = null;
    message.value = "Feedback updated.";
  } catch {
    saveError.value = "Could not save feedback. Check your admin access and connection, then try again.";
  } finally {
    saving.value = false;
  }
}
function dateLabel(at) {
  return at?.toDate?.().toLocaleString() || "";
}
</script>

<template>
  <section class="rf" aria-label="Manage parent feedback">
    <h3>{{ roomId ? "Parent feedback" : "All parent feedback" }}</h3>
    <p v-if="loading" role="status">Loading feedback…</p>
    <div v-if="loadError" role="alert">
      <p>{{ loadError }}</p>
      <AppButton size="sm" variant="outline" @click="retry++">Try again</AppButton>
    </div>
    <p v-if="!loading && !loadError && !items.length && !legacyRooms.length">No parent feedback yet.</p>
    <p v-if="message" role="status">{{ message }}</p>
    <ul class="rf__list">
      <li v-for="item in pagedParent" :key="`${item.roomId}/${item.id}`" class="rf__item">
        <h4 v-if="!roomId">{{ roomNames.get(item.roomId) || `Room ${item.roomId}` }}</h4>
        <p class="rf__meta">{{ dateLabel(item.at) }}<span v-if="item.editedBy"> · Edited by an administrator</span></p>
        <form v-if="isEditing(item)" @submit.prevent="save">
          <label :for="`feedback-edit-${item.roomId}-${item.id}`">Edit parent feedback</label>
          <textarea :id="`feedback-edit-${item.roomId}-${item.id}`" v-model="editing.text" class="form-control" rows="3" required maxlength="400" :disabled="saving" />
          <p class="rf__meta">{{ editing.text.length }}/400. The original author and date are preserved.</p>
          <p v-if="saveError" class="app-error-text" role="alert">{{ saveError }}</p>
          <div class="rf__actions">
            <AppButton size="sm" type="submit" :disabled="saving || !editing.text.trim()">{{ saving ? "Saving…" : "Save feedback" }}</AppButton>
            <AppButton size="sm" variant="outline" :disabled="saving" @click="editing = null">Cancel</AppButton>
          </div>
        </form>
        <template v-else>
          <p class="rf__text">{{ item.text }}</p>
          <AppButton size="sm" variant="outline" :disabled="saving" @click="edit(item)">Edit feedback</AppButton>
        </template>
      </li>
      <li v-for="room in pagedLegacy" :key="`legacy-${room.id}`" class="rf__item">
        <h4 v-if="!roomId">{{ room.name }}</h4>
        <p class="rf__meta">Feedback saved with room details</p>
        <p class="rf__text">{{ room.feedback }}</p>
        <AppButton size="sm" variant="outline" :disabled="saving" @click="emit('edit-room', room)">Edit room feedback</AppButton>
      </li>
    </ul>
    <AppPager v-model="page" :total="everyItem.length" :page-size="PAGE_SIZE" label="Feedback pages" />
  </section>
</template>

<style scoped>
/* The app's look: cream cards with a sand edge, serif headings, navy pill buttons. */
.rf { display: flex; flex-direction: column; gap: 12px; padding: 16px 0; width: 100%; color: #1f2a52; cursor: default; }
.rf > * { margin: 0; }
.rf h3 { font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 700; color: #1f2a52; }
.rf h4 { margin: 0; font-family: var(--nt-serif); font-size: 1.1875rem; font-weight: 700; color: #1f2a52; }
.rf p { margin: 0; font-size: 0.9375rem; line-height: 1.5; }
.rf__list { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px; }
.rf__item { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 18px 22px 20px; background: #fdf9f0; border: 1px solid #e9d9b8; border-bottom-width: 4px; border-radius: 22px; }
.rf__meta { font-size: 0.875rem; color: #6b7392; }
.rf__text { white-space: pre-wrap; overflow-wrap: anywhere; color: #1f2a52; }
.rf form { display: grid; gap: 10px; width: 100%; }
.rf label { font-size: 0.9375rem; font-weight: 600; color: #1f2a52; }
.rf :deep(.form-control) { background: #fff; border: 1.5px solid #e9d9b8; border-radius: 14px; color: #1f2a52; }
.rf :deep(.form-control:focus) { border-color: #243560; box-shadow: 0 0 0 3px rgb(242 164 119 / 45%); }
.rf__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.rf :deep(.btn) { min-height: 44px; padding: 6px 20px; border-radius: 999px; font-size: 0.9375rem; font-weight: 700; transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease; }
.rf :deep(.btn-primary) { background: #243560; border: 0; border-bottom: 3px solid #182246; color: #fff; }
.rf :deep(.btn-primary:hover:not(:disabled)) { background: #2c4175; transform: translateY(-1px); }
.rf :deep(.btn-outline) { background: #fff; border: 1.5px solid #e9d9b8; border-bottom-width: 3px; color: #243560; }
.rf :deep(.btn-outline:hover:not(:disabled)) { background: #fff; border-color: #243560; color: #243560; transform: translateY(-1px); }
.rf :deep(.btn:active:not(:disabled)) { transform: none; }
.rf :deep(.btn:focus-visible) { outline: 3px solid #f2a477; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .rf :deep(.btn) { transition: none; } }
</style>
