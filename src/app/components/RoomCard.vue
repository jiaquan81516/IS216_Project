<script setup>
import Collapse from "@/app/components/Collapse.vue";
import { computed, nextTick, ref } from "vue";
import { formatDistance, verificationText, isVerified } from "@/app/utils/mapHelpers";
import { oneMapPlaceUrl } from "@/app/utils/oneMapHelpers";
import { tidyCaps } from "@/app/utils/roomHelpers";

import { addRoomFeedback, listRoomFeedback } from "@/api/rooms";
import { useAuth } from "@/composables/useAuth";
import AppButton from "@/components/ui/AppButton.vue";
import Icon from "@/app/components/Icon.vue";

const { currentUser } = useAuth();
const feedbackOpen = ref(false);
const feedbackText = ref("");
const feedbackItems = ref([]);
const feedbackLoading = ref(false);
const feedbackSaving = ref(false);
const feedbackError = ref("");
const feedbackStatus = ref("");
const feedbackInput = ref(null);
const feedbackButton = ref(null);
async function openFeedback() {
  feedbackOpen.value = true;
  feedbackError.value = "";
  feedbackLoading.value = true;
  try {
    feedbackItems.value = await listRoomFeedback(props.room.id);
  } catch {
    feedbackError.value = "We could not load feedback. Please try again.";
  } finally {
    feedbackLoading.value = false;
  }
}
function closeFeedback() {
  if (feedbackSaving.value) return;
  feedbackOpen.value = false;
  nextTick(() => feedbackButton.value?.focus());
}
async function saveFeedback() {
  if (feedbackSaving.value || !feedbackText.value.trim()) return;
  feedbackSaving.value = true;
  feedbackError.value = "";
  feedbackStatus.value = "";
  try {
    const text = feedbackText.value.trim();
    const id = await addRoomFeedback(currentUser.value?.uid, props.room.id, text);
    feedbackItems.value = [{ id, text }, ...feedbackItems.value].slice(0, 20);
    feedbackText.value = "";
    feedbackStatus.value = "Your feedback has been added. Thank you for helping other parents.";
  } catch {
    feedbackError.value = "We could not save your feedback. Check your connection and try again.";
  } finally {
    feedbackSaving.value = false;
  }
}

defineOptions({ name: "RoomCard" });
const props = defineProps({
  room: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  saved: { type: Boolean, default: false },
  showDistance: { type: Boolean, default: true },
  canManage: { type: Boolean, default: false },
  canConfirm: { type: Boolean, default: false },
});
const emit = defineEmits(["select", "toggle-save", "edit", "delete", "confirm"]);

const distance = computed(() => (props.showDistance ? formatDistance(props.room.distance) : ""));
const verification = computed(() => verificationText(props.room));
const verified = computed(() => isVerified(props.room));
const placeUrl = computed(() => oneMapPlaceUrl(props.room.lat, props.room.lng));
</script>

<template>
  <li
    :id="`room-card-${room.id}`"
    class="rc"
    :class="{ 'rc--on': selected }"
    :aria-current="selected ? 'true' : undefined"
    @click="emit('select', room)"
  >
    <h2 class="rc__name">
      <button type="button" class="rc__name-btn" @click.stop="emit('select', room)">{{ tidyCaps(room.name) }}</button>
    </h2>
    <p class="rc__text">{{ tidyCaps(room.address) }}</p>
    <p v-if="room.roomType" class="rc__muted">{{ room.roomType }}</p>
    <p v-if="room.details" class="rc__muted">{{ room.details }}</p>
    <ul v-if="room.features.length" class="rc__chips" aria-label="Features">
      <li v-for="f in room.features" :key="f" class="app-pill">{{ f }}</li>
    </ul>
    <p v-if="room.facilities?.length" class="rc__muted">{{ room.facilities.join(", ") }}</p>
    <p class="rc__verify" :class="{ 'rc__verify--ok': verified }">{{ verification }}</p>
    <p v-if="distance" class="rc__muted">{{ distance }} away</p>
    <p v-if="room.sourceUrl" class="rc__muted">
      <a class="rc__source" :href="room.sourceUrl" target="_blank" rel="noopener noreferrer" @click.stop>
        Source: {{ room.sourceLabel || "BMSG Nursing Room Directory" }}<span class="visually-hidden">, opens in a new tab</span>
      </a>
    </p>
    <div class="rc__actions rc__actions--room">
      <div class="rc__action-group">
      <button type="button" class="rc__action" @click.stop="emit('select', room)">
        <Icon name="pin" :size="16" />
        Show on map<span class="visually-hidden"> for {{ room.name }}</span>
      </button>
      <a v-if="placeUrl" class="rc__action" :href="placeUrl" target="_blank" rel="noopener noreferrer" @click.stop>
        <Icon name="external" :size="16" />
        Open in OneMap<span class="visually-hidden"> for {{ room.name }}, opens in a new tab</span>
      </a>
      <template v-if="canManage">
        <button type="button" class="rc__action" @click.stop="emit('edit', room)">Edit<span class="visually-hidden"> {{ room.name }}, including its parent feedback</span></button>
        <button type="button" class="rc__action" @click.stop="emit('delete', room)">Delete<span class="visually-hidden"> {{ room.name }}</span></button>
      </template>
      </div>
      <div v-if="!canManage" class="rc__action-group rc__action-group--end">
      <button v-if="canConfirm" type="button" class="rc__action" @click.stop="emit('confirm', room)">
        <Icon name="check" :size="16" />
        It is still there<span class="visually-hidden">: {{ room.name }}</span>
      </button>
      <button
        type="button"
        class="rc__action"
        :class="{ 'rc__action--active': saved }"
        :aria-pressed="saved ? 'true' : 'false'"
        :aria-label="`${saved ? 'Remove' : 'Save'} ${room.name}`"
        @click.stop="emit('toggle-save', room)"
      >
        <Icon :name="saved ? 'check' : 'heart'" :size="16" />
        {{ saved ? "Saved" : "Save" }}
      </button>
      <button ref="feedbackButton" type="button" class="rc__action" :class="{ 'rc__action--active': feedbackOpen }" :aria-expanded="feedbackOpen" :aria-controls="`room-feedback-${room.id}`" @click.stop="feedbackOpen ? closeFeedback() : openFeedback()">
        <Icon name="chat" :size="16" />
        {{ feedbackOpen ? "Hide feedback" : "See feedback" }}<span class="visually-hidden"> for {{ room.name }}</span>
      </button>
      </div>
    </div>
    <Collapse>
    <section v-if="feedbackOpen" :id="`room-feedback-${room.id}`" class="rc__feedback" :aria-labelledby="`room-feedback-title-${room.id}`" @click.stop @keydown.esc.stop="closeFeedback">
      <h3 :id="`room-feedback-title-${room.id}`" class="rc__feedback-title">Parent feedback</h3>
      <p v-if="feedbackLoading" class="rc__muted" role="status">Loading feedback…</p>
      <p v-if="!feedbackLoading && !room.feedback && !feedbackItems.length" class="rc__muted">No feedback yet. Be the first to share.</p>
      <ul v-if="room.feedback || feedbackItems.length" class="rc__feedback-list">
        <li v-if="room.feedback" class="rc__text">{{ room.feedback }}</li>
        <li v-for="item in feedbackItems" :key="item.id" class="rc__text">{{ item.text }}<small v-if="item.editedBy" class="rc__muted"> · Edited by an administrator</small></li>
      </ul>
      <form class="rc__feedback-form" @submit.prevent="saveFeedback">
        <label :for="`room-feedback-input-${room.id}`" class="rc__text">Share your experience</label>
        <textarea :id="`room-feedback-input-${room.id}`" ref="feedbackInput" v-model="feedbackText" class="form-control" rows="3" maxlength="400" required :disabled="feedbackSaving" placeholder="Was it clean, comfortable and easy to find?" />
        <p class="rc__muted">Your feedback is shared with other parents. {{ feedbackText.length }}/400</p>
        <p v-if="feedbackError" class="app-error-text" role="alert">{{ feedbackError }}</p>
        <p v-if="feedbackStatus" class="rc__muted" role="status">{{ feedbackStatus }}</p>
        <div class="rc__actions">
          <AppButton type="submit" size="sm" :disabled="feedbackSaving || feedbackLoading || !feedbackText.trim()">{{ feedbackSaving ? "Saving…" : "Save feedback" }}</AppButton>
          <AppButton variant="outline" size="sm" :disabled="feedbackSaving" @click="closeFeedback">Close</AppButton>
        </div>
      </form>
    </section>
    </Collapse>
  </li>
</template>

<style scoped>
.rc { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; padding: 20px 24px; border-bottom: 1px solid var(--nt-line); cursor: pointer; transition: border-color 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1); }
.rc:hover { background: #fffdf8; }
.rc--on { background: #fffdf8; box-shadow: none; }
.rc__name { margin: 0; font-family: var(--nt-serif); font-size: 1.3125rem; line-height: 1.25; font-weight: 700; }
.rc__name-btn { padding: 0; background: none; border: 0; color: #1f2a52; font: inherit; text-align: left; cursor: pointer; }
.rc__name-btn:hover { color: #c4642f; }
.rc__name-btn:focus-visible, .rc :deep(a:focus-visible), .rc :deep(button:focus-visible) { outline: 3px solid #f2a477; outline-offset: 2px; border-radius: 6px; }
.rc__text { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: #1f2a52; }
.rc__muted { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: #6b7392; }
.rc__source { color: #6b7392; text-decoration: underline; }
.rc__source:hover { color: #c4642f; }
.rc__chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 2px; padding: 0; list-style: none; }
.rc__chips :deep(.app-pill) { padding: 3px 12px; background: #f6efdc; border: 1px solid #e9d9b8; color: #243560; font-size: 0.8125rem; font-weight: 600; }
.rc__verify { margin: 0; font-size: 0.875rem; line-height: 1.5; font-weight: 600; color: #6b7392; }
.rc__verify--ok { color: #2f5d43; }
.rc__feedback { width: 100%; margin-top: 12px; padding-top: 16px; border-top: 1px dashed #e9d9b8; cursor: default; }
.rc__feedback-title { margin: 0 0 12px; font-family: var(--nt-serif); font-size: 1.125rem; font-weight: 700; color: #1f2a52; }
.rc__feedback-form { display: flex; flex-direction: column; gap: 8px; }
.rc__feedback-list { display: flex; flex-direction: column; gap: 8px; padding-left: 20px; margin: 0 0 16px; overflow-wrap: anywhere; white-space: pre-wrap; }
.rc__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
/* One tidy row of buttons, left aligned and pinned to the bottom so cards in a row line up. */
.rc__actions--room { width: 100%; margin-top: auto; padding-top: 14px; }
.rc__action-group, .rc__action-group--end { display: contents; }
.rc__action { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; padding: 6px 14px; border: 1.5px solid #e9d9b8; border-bottom-width: 3px; border-radius: 999px; background: #fff; color: #243560; font: inherit; font-size: 0.875rem; font-weight: 600; line-height: 1.4; text-decoration: none; cursor: pointer; transition: background-color 150ms, border-color 150ms, color 150ms, transform 150ms; }
.rc__action :deep(svg) { flex-shrink: 0; color: #6b7392; }
.rc__action:hover { border-color: #243560; background: #fff; color: #243560; transform: translateY(-1px); }
.rc__action:hover :deep(svg) { color: #243560; }
.rc__action:active { transform: none; }
.rc__action--active { border-color: #243560; background: #243560; color: #fff; }
.rc__action--active :deep(svg) { color: #fff; }
.rc__action--active:hover { background: #2c4175; color: #fff; }
.rc__action--active:hover :deep(svg) { color: #fff; }
.rc .rc__action:focus-visible { border-radius: 999px; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .rc, .rc__action { transition: none; } }
</style>
