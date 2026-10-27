<script setup>
import { computed, nextTick, ref } from "vue";
import { formatDistance, verificationText, isVerified } from "@/app/utils/mapHelpers";
import { oneMapPlaceUrl } from "@/app/utils/oneMapHelpers";

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
  await nextTick();
  feedbackInput.value?.focus();
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
});
const emit = defineEmits(["select", "toggle-save"]);

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
      <button type="button" class="rc__name-btn" @click.stop="emit('select', room)">{{ room.name }}</button>
    </h2>
    <p class="rc__text">{{ room.address }}</p>
    <p v-if="room.roomType" class="rc__muted">{{ room.roomType }}</p>
    <p v-if="room.details" class="rc__muted">{{ room.details }}</p>
    <ul v-if="room.features.length" class="rc__chips" aria-label="Features">
      <li v-for="f in room.features" :key="f" class="app-pill">{{ f }}</li>
    </ul>
    <p v-if="room.facilities?.length" class="rc__muted">{{ room.facilities.join(", ") }}</p>
    <p v-if="room.feedback" class="rc__muted">Parent feedback: {{ room.feedback }}</p>
    <p class="rc__verify" :class="{ 'rc__verify--ok': verified }">{{ verification }}</p>
    <p v-if="distance" class="rc__muted">{{ distance }} away</p>
    <p v-if="room.sourceUrl" class="rc__muted">
      <a class="rc__source" :href="room.sourceUrl" target="_blank" rel="noopener noreferrer" @click.stop>
        Source: {{ room.sourceLabel || "BMSG Nursing Room Directory" }}<span class="visually-hidden">, opens in a new tab</span>
      </a>
    </p>
    <div class="rc__actions rc__actions--room">
      <div v-if="placeUrl" class="rc__action-group">
      <button v-if="placeUrl" type="button" class="rc__action" @click.stop="emit('select', room)">
        <Icon name="pin" :size="16" />
        Show on map<span class="visually-hidden"> for {{ room.name }}</span>
      </button>
      <a v-if="placeUrl" class="rc__action" :href="placeUrl" target="_blank" rel="noopener noreferrer" @click.stop>
        <Icon name="external" :size="16" />
        Open in OneMap<span class="visually-hidden"> for {{ room.name }}, opens in a new tab</span>
      </a>
      </div>
      <div class="rc__action-group rc__action-group--end">
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
        Add feedback<span class="visually-hidden"> for {{ room.name }}</span>
      </button>
      </div>
    </div>
    <section v-if="feedbackOpen" :id="`room-feedback-${room.id}`" class="rc__feedback" :aria-labelledby="`room-feedback-title-${room.id}`" @click.stop @keydown.esc.stop="closeFeedback">
      <h3 :id="`room-feedback-title-${room.id}`" class="rc__feedback-title">Parent feedback</h3>
      <p v-if="feedbackLoading" class="rc__muted" role="status">Loading feedback…</p>
      <ul v-if="feedbackItems.length" class="rc__feedback-list">
        <li v-for="item in feedbackItems" :key="item.id" class="rc__text">{{ item.text }}</li>
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
  </li>
</template>

<style scoped>
.rc { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 20px 24px; border-bottom: 1px solid var(--nt-line); cursor: pointer; }
.rc:hover { background: var(--nt-gray); }
.rc--on { background: var(--nt-gray); box-shadow: none; border-left: 3px solid var(--nt-plum); padding-left: 21px; }
.rc__name { margin: 0; font-size: 1rem; line-height: 1.4; font-weight: 600; font-family: inherit; }
.rc__name-btn { padding: 0; background: none; border: 0; color: var(--nt-ink); font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
.rc__name-btn:hover { color: var(--nt-plum); }
.rc__name-btn:focus-visible, .rc :deep(a:focus-visible), .rc :deep(button:focus-visible) { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
.rc__text { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.rc__muted { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.rc__source { color: var(--nt-muted); text-decoration: underline; }
.rc__source:hover { color: var(--nt-plum); }
.rc__chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; padding: 0; list-style: none; }
.rc__verify { margin: 0; font-size: 0.875rem; line-height: 1.5; font-weight: 600; color: var(--nt-muted); }
.rc__verify--ok { color: var(--nt-plum); }
.rc__feedback { width: 100%; margin-top: 12px; padding-top: 16px; border-top: 1px solid var(--nt-line); cursor: default; }
.rc__feedback-title { margin: 0 0 12px; font-size: 1rem; font-family: inherit; font-weight: 600; }
.rc__feedback-form { display: flex; flex-direction: column; gap: 8px; }
.rc__feedback-list { display: flex; flex-direction: column; gap: 8px; padding-left: 20px; margin: 0 0 16px; overflow-wrap: anywhere; white-space: pre-wrap; }
.rc__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
.rc__actions--room { width: 100%; }
.rc__action-group { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.rc__action-group--end { margin-left: auto; justify-content: flex-end; }
.rc__action { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 8px 12px; border: 1px solid var(--nt-line); border-radius: 999px; background: var(--nt-white); color: var(--nt-ink); font: inherit; font-size: 0.875rem; font-weight: 500; line-height: 1.4; text-decoration: none; cursor: pointer; transition: background-color 150ms, border-color 150ms, color 150ms; }
.rc__action :deep(svg) { flex-shrink: 0; color: var(--nt-muted); }
.rc__action:hover { border-color: var(--nt-plum); background: #f3eef4; color: var(--nt-plum); }
.rc__action:hover :deep(svg), .rc__action--active :deep(svg) { color: var(--nt-plum); }
.rc__action--active { border-color: var(--nt-plum); background: #f3eef4; color: var(--nt-plum); }
.rc .rc__action:focus-visible { border-radius: 999px; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .rc__action { transition: none; } }
</style>
