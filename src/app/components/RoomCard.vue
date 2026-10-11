<script setup>
import { computed } from "vue";
import { formatDistance, verificationText, isVerified } from "@/app/api/mapHelpers";
import { mapsDirectionsLink, mapsSearchLink } from "@/app/api/roomHelpers";

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
    <p v-if="room.details" class="rc__muted">{{ room.details }}</p>
    <ul v-if="room.features.length" class="rc__chips" aria-label="Features">
      <li v-for="f in room.features" :key="f" class="app-pill">{{ f }}</li>
    </ul>
    <p class="rc__verify" :class="{ 'rc__verify--ok': verified }">{{ verification }}</p>
    <p v-if="distance" class="rc__muted">{{ distance }} away</p>
    <div class="rc__actions">
      <button
        type="button"
        class="app-textbtn"
        :aria-pressed="saved ? 'true' : 'false'"
        :aria-label="`${saved ? 'Remove' : 'Save'} ${room.name}`"
        @click.stop="emit('toggle-save', room)"
      >
        {{ saved ? "Saved" : "Save" }}
      </button>
      <button type="button" class="app-textbtn" @click.stop="emit('select', room)">
        Show on map<span class="visually-hidden"> for {{ room.name }}</span>
      </button>
      <a class="app-link" :href="mapsSearchLink(room)" target="_blank" rel="noopener noreferrer" @click.stop>
        Open in Google Maps<span class="visually-hidden"> for {{ room.name }}, opens in a new tab</span>
      </a>
      <a class="app-link" :href="mapsDirectionsLink(room)" target="_blank" rel="noopener noreferrer" @click.stop>
        Directions<span class="visually-hidden"> to {{ room.name }}, opens in a new tab</span>
      </a>
    </div>
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
.rc__chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; padding: 0; list-style: none; }
.rc__verify { margin: 0; font-size: 0.875rem; line-height: 1.5; font-weight: 600; color: var(--nt-muted); }
.rc__verify--ok { color: var(--nt-plum); }
.rc__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 20px; margin-top: 4px; }
</style>
