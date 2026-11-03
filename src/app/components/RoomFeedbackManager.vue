<script setup>
import { computed, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
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
const roomNames = computed(() => new Map(props.rooms.map((room) => [room.id, room.name])));
const legacyRooms = computed(() => props.rooms.filter((room) => room.feedback && (!props.roomId || room.id === props.roomId)));

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
      <li v-for="item in items" :key="`${item.roomId}/${item.id}`" class="rf__item">
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
      <li v-for="room in legacyRooms" :key="`legacy-${room.id}`" class="rf__item">
        <h4 v-if="!roomId">{{ room.name }}</h4>
        <p class="rf__meta">Feedback saved with room details</p>
        <p class="rf__text">{{ room.feedback }}</p>
        <AppButton size="sm" variant="outline" :disabled="saving" @click="emit('edit-room', room)">Edit room feedback</AppButton>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.rf { padding: 16px 0; width: 100%; cursor: default; }
.rf h3, .rf h4 { margin: 0 0 12px; font-size: 1rem; }
.rf__list { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.rf__item { padding: 16px; border: 1px solid var(--nt-line); border-radius: 12px; }
.rf__meta { font-size: 0.875rem; color: var(--nt-muted); }
.rf__text { white-space: pre-wrap; overflow-wrap: anywhere; }
.rf form { display: grid; gap: 10px; }
.rf__actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
