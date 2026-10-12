<script setup>
import "@/app/app.css";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import Tabs from "@/app/components/Tabs.vue";
import AppButton from "@/components/ui/AppButton.vue";
import Icon from "@/app/components/Icon.vue";
import RoomCard from "@/app/components/RoomCard.vue";
import RoomFilterPanel from "@/app/components/RoomFilterPanel.vue";
import OneMapEmbed from "@/app/components/OneMapEmbed.vue";
import { loadBmsgRooms } from "@/app/api/bmsgRooms";
import {
  DEFAULT_CENTER,
  activeFilterCount,
  applyFilters,
  mergeRooms,
  prepareCommunityRooms,
  sortByDistance,
} from "@/app/api/mapHelpers";
import { describeSharedError } from "@/app/api/sharedHelpers";
import { SEED_COORDS } from "@/app/data/pumpingRooms";
import { useRoomsStore } from "@/app/stores/rooms";

defineOptions({ name: "PumpingRoomsPage" });

const ADD_OFF = "Adding a room needs OneMap address search, which comes with the deployed version. For now rooms are added by the team.";
const SAVED_ROOMS_KEY = "nurturetrack:saved-pumping-rooms";
const located = ref(false);

const roomsStore = useRoomsStore();
const listed = ref([]);

// Search, filters and view
const query = ref("");
const filters = ref({ features: [], verifiedOnly: false });
const filterOpen = ref(false);
const view = ref("all");
const selectedId = ref("");
const message = ref("");
const locationMessage = ref("");

// Where distances are measured from.
const origin = ref({ ...DEFAULT_CENTER });
const originLabel = ref("in Singapore");

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_ROOMS_KEY) || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}
const savedIds = ref(readSaved());
function toggleSaved(room) {
  savedIds.value = savedIds.value.includes(room.id)
    ? savedIds.value.filter((id) => id !== room.id)
    : [...savedIds.value, room.id];
  try {
    localStorage.setItem(SAVED_ROOMS_KEY, JSON.stringify(savedIds.value));
  } catch {
    // Saving is a convenience; the list still works for this visit.
  }
}

// Rooms: database rooms first, then the BMSG directory rooms, de-duplicated.
const allRooms = computed(() => mergeRooms(prepareCommunityRooms(roomsStore.rooms, SEED_COORDS), listed.value));
const visible = computed(() => {
  const base = view.value === "saved" ? allRooms.value.filter((r) => savedIds.value.includes(r.id)) : allRooms.value;
  const filtered = applyFilters(base, { text: query.value, ...filters.value });
  // Distance only matters once the person has shared their location.
  return located.value ? sortByDistance(filtered, origin.value) : filtered;
});
const savedCount = computed(() => allRooms.value.filter((r) => savedIds.value.includes(r.id)).length);
const countText = computed(() => {
  const n = visible.value.length;
  return `${n} ${n === 1 ? "room" : "rooms"} ${originLabel.value}`;
});
const roomsError = computed(() => (roomsStore.error ? describeSharedError(roomsStore.error.code, "pumping rooms").text : ""));
const filterCount = computed(() => activeFilterCount(filters.value));

// The OneMap embed: the chosen room, else the person's location, else the whole island.
const embed = computed(() => {
  const room = visible.value.find((r) => r.id === selectedId.value);
  if (room && Number.isFinite(room.lat) && Number.isFinite(room.lng)) return { lat: room.lat, lng: room.lng, label: room.name };
  if (located.value) return { lat: origin.value.lat, lng: origin.value.lng, label: "your area" };
  return { lat: null, lng: null, label: "" };
});

function selectFromList(room) {
  selectedId.value = room.id;
}

function onInput(event) {
  query.value = event.target.value;
}
onMounted(async () => {
  roomsStore.bind();
  listed.value = await loadBmsgRooms();
});
onBeforeUnmount(() => roomsStore.unbind());

// Geolocation
function locate() {
  locationMessage.value = "";
  if (!globalThis.navigator?.geolocation) {
    locationMessage.value = "Location is not available in this browser. Search for a place instead.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      located.value = true;
      query.value = "";
      origin.value = { lat: coords.latitude, lng: coords.longitude };
      originLabel.value = "near you";
    },
    () => {
      locationMessage.value = "We could not access your location. Search for a place instead.";
    },
  );
}

function viewAll() {
  filters.value = { features: [], verifiedOnly: false };
  query.value = "";
  view.value = "all";
  selectedId.value = "";
  origin.value = { ...DEFAULT_CENTER };
  originLabel.value = "in Singapore";
  located.value = false;
}

// Add a room: explained, not offered, until OneMap address search is available.
const formOpen = ref(false);
const addButton = ref(null);
const panel = ref(null);
function openForm() {
  message.value = "";
  formOpen.value = true;
  nextTick(() => panel.value?.focus?.());
}
function closeForm() {
  formOpen.value = false;
  nextTick(() => addButton.value?.$el?.focus?.());
}
function onKeydown(event) {
  if (event.key === "Escape" && formOpen.value) closeForm();
}
watch(formOpen, (open) => {
  if (open) window.addEventListener("keydown", onKeydown);
  else window.removeEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

const router = useRouter();
const SUPPORT_TABS = [
  { id: "guides", label: "Guides" },
  { id: "rooms", label: "Pumping rooms" },
  { id: "resources", label: "Trusted resources" },
];
const supportTab = ref("rooms");
watch(supportTab, (id) => {
  if (id === "guides") router.push("/support");
  else if (id === "resources") router.push("/support?tab=resources");
});
</script>

<template>
  <div class="pr pr--list">
    <section class="pr__side" aria-label="Pumping room list">
      <div class="pr__scroll">
        <Tabs
          v-model="supportTab"
          :tabs="SUPPORT_TABS"
          label="Support sections"
          id-base="support"
        />
        <header class="pr__head">
          <h1 class="nt-title pr__title">Find a pumping room</h1>
          <AppButton ref="addButton" variant="outline" size="sm" @click="openForm">Add a room</AppButton>
        </header>

        <div class="pr__field pr__field--plain">
          <label class="pr__flabel" for="pr-location">Search rooms</label>
          <div class="pr__plainwrap">
            <input
              id="pr-location"
              class="pr__input pr__input--plain"
              type="text"
              placeholder="Mall or street name"
              autocomplete="off"
              :value="query"
              @input="onInput"
            />
            <span class="pr__icon"><Icon name="search" :size="18" /></span>
          </div>
        </div>
        <p v-if="locationMessage" class="pr__notice" role="status">{{ locationMessage }}</p>

        <div class="pr__bar">
          <p class="pr__count" aria-live="polite">{{ countText }}</p>
          <AppButton variant="outline" size="sm" @click="locate()">
            <Icon name="locate" :size="16" />
            Use my location
          </AppButton>
          <AppButton
            variant="outline"
            size="sm"
            :aria-expanded="filterOpen ? 'true' : 'false'"
            aria-controls="pr-filters"
            @click="filterOpen = !filterOpen"
          >
            <Icon name="sliders" :size="16" />
            Filter<template v-if="filterCount"> ({{ filterCount }})</template>
          </AppButton>
        </div>
        <RoomFilterPanel v-if="filterOpen" id="pr-filters" v-model="filters" />

        <section class="pr__mapslot" aria-label="Map">
          <OneMapEmbed :lat="embed.lat" :lng="embed.lng" :label="embed.label" />
        </section>

        <div class="pr__views" role="group" aria-label="Show">
          <button type="button" class="app-chip" :aria-pressed="view === 'all' ? 'true' : 'false'" @click="view = 'all'">All rooms</button>
          <button type="button" class="app-chip" :aria-pressed="view === 'saved' ? 'true' : 'false'" @click="view = 'saved'">
            Saved places ({{ savedCount }})
          </button>
        </div>

        <div role="status" class="pr__status">
          <p v-if="message" class="pr__muted">{{ message }}</p>
        </div>
        <p v-if="roomsStore.writeError" class="app-error-text pr__pad" role="alert">{{ roomsStore.writeError }}</p>
        <p v-if="roomsError" class="app-error-text pr__pad" role="alert">{{ roomsError }}</p>

        <ul v-if="visible.length" class="pr__list" aria-label="Pumping rooms">
          <RoomCard
            v-for="room in visible"
            :key="room.id"
            :room="room"
            :selected="room.id === selectedId"
            :saved="savedIds.includes(room.id)"
            :show-distance="located"
            @select="selectFromList"
            @toggle-save="toggleSaved"
          />
        </ul>
        <div v-else class="pr__empty">
          <h2 class="nt-heading nt-heading--sm">{{ view === "saved" ? "No saved places yet" : "No rooms match" }}</h2>
          <p class="pr__muted">
            {{ view === "saved" ? "Save a room from the list and it shows here." : "Try a different search or remove a filter." }}
          </p>
        </div>

        <div class="pr__foot">
          <button type="button" class="app-link pr__all" @click="viewAll">View all rooms</button>
          <p class="pr__muted pr__note">
            Verified rooms are from the Breastfeeding Mothers' Support Group directory. Know another room?
            <button type="button" class="app-textbtn pr__add" @click="openForm">Add it<span class="visually-hidden"> (add a room)</span></button>.
          </p>
        </div>
      </div>

      <section v-if="formOpen" ref="panel" class="pr__panel" tabindex="-1" aria-labelledby="pr-add-title">
        <div class="pr__panel-head">
          <h2 id="pr-add-title" class="nt-heading nt-heading--sm">Add a pumping room</h2>
          <button type="button" class="pr__x" aria-label="Close add a room" @click="closeForm"><Icon name="close" :size="18" /></button>
        </div>
        <p class="pr__muted">Community additions need verification before others rely on them.</p>
        <div class="pr__off">
          <p class="pr__muted">{{ ADD_OFF }}</p>
          <div class="pr__actions">
            <AppButton size="sm" disabled>Save room</AppButton>
            <AppButton variant="outline" size="sm" @click="closeForm">Cancel</AppButton>
          </div>
        </div>
      </section>
    </section>

  </div>
</template>

<style scoped>
.pr { display: grid; grid-template-columns: 440px minmax(0, 1fr); height: 100vh; background: var(--nt-bg-care); }
.pr__side { position: relative; min-width: 0; border-right: 1px solid var(--nt-line); overflow: hidden; }
.pr__scroll { height: 100%; overflow-y: auto; padding: 32px 0 24px; }
.pr__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 0 24px; }
.pr__title { margin: 0; font-size: 1.75rem; line-height: 1.25; }
.pr__field { position: relative; margin: 20px 24px 8px; }
.pr__input { width: 100%; padding: 24px 44px 8px 16px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 8px; font: inherit; font-size: 0.875rem; color: var(--nt-ink); }
.pr__input:focus { outline: 2px solid var(--nt-plum); outline-offset: 1px; border-color: var(--nt-plum); }
.pr__label { position: absolute; left: 16px; top: 16px; font-size: 0.875rem; color: var(--nt-muted); pointer-events: none; }
.pr__input:focus + .pr__label, .pr__input:not(:placeholder-shown) + .pr__label { top: 6px; font-size: 0.875rem; line-height: 1.1; }
.pr__icon { position: absolute; right: 14px; top: 50%; display: inline-flex; transform: translateY(-50%); color: var(--nt-muted); pointer-events: none; }
.pr__notice { margin: 8px 24px; padding: 10px 12px; background: var(--nt-gray); border: 1px solid var(--nt-line); border-radius: 8px; font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); }
.pr__bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 24px; }
.pr__count { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.pr__views { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 24px 16px; }
.pr__status:empty { display: none; }
.pr__status { padding: 0 24px 12px; }
.pr__pad { padding: 0 24px; }
.pr__muted { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.pr__list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.pr__empty { display: flex; flex-direction: column; gap: 8px; padding: 32px 24px; border-top: 1px solid var(--nt-line); }
.pr__foot { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 20px 24px 8px; }
.pr__all { padding: 0; background: none; border: 0; font: inherit; font-size: 0.875rem; font-weight: 600; text-decoration: underline; cursor: pointer; }
.pr__note { font-size: 0.875rem; }
.pr__add { font-size: 0.875rem; }
.pr__add:focus-visible, .pr__all:focus-visible, .pr__x:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.pr__panel { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; gap: 12px; padding: 32px 24px; overflow-y: auto; background: var(--nt-white); }
.pr__panel:focus { outline: none; }
.pr__panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pr__panel-head h2 { margin: 0; }
.pr__x { display: inline-flex; padding: 6px; background: transparent; border: 0; border-radius: 8px; color: var(--nt-muted); cursor: pointer; }
.pr__x:hover { background: var(--nt-gray); color: var(--nt-ink); }
.pr__form { display: flex; flex-direction: column; gap: 16px; }
.pr__f { display: flex; flex-direction: column; gap: 6px; }
.pr__flabel { font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.pr__picked { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: var(--nt-gray); border-radius: 8px; font-size: 0.875rem; }
.pr__picked span { color: var(--nt-muted); }
.pr__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.pr__actions { display: flex; gap: 8px; }

.pr__mapslot { padding: 0 24px; margin: 0 0 16px; }
.pr__field--plain { display: flex; flex-direction: column; gap: 6px; }
.pr__plainwrap { position: relative; }
.pr__input--plain { padding: 12px 44px 12px 16px; }
.pr__off { display: flex; flex-direction: column; gap: 16px; }
.pr--list { display: block; height: auto; min-height: 100vh; }
.pr--list .pr__side { border-right: 0; overflow: visible; }
.pr--list .pr__scroll { height: auto; overflow: visible; max-width: 1120px; margin: 0 auto; }
.pr--list .pr__list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 0 24px; border-top: 0; }
.pr--list .pr__list :deep(.rc) { background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 12px; }
.pr--list .pr__list :deep(.rc--on) { border-left: 3px solid var(--nt-plum); }
.pr--list .pr__panel { position: fixed; inset: auto; top: 10vh; left: 50%; transform: translateX(-50%); width: min(480px, calc(100vw - 32px)); max-height: 80vh; border: 1px solid var(--nt-line); border-radius: 12px; }

@media (max-width: 991px) {
  .pr--list .pr__list { grid-template-columns: minmax(0, 1fr); }
  .pr { display: flex; flex-direction: column; height: auto; }
  .pr__side { border-right: 0; border-bottom: 1px solid var(--nt-line); overflow: visible; }
  .pr__scroll { height: auto; overflow: visible; }
}
</style>

<style>
/* Make the page span the whole content area of the app shell (full width, no padding). */
.appshell__main:has(.pr) { padding: 0; }
.appshell__main:has(.pr) .appshell__content { max-width: none; }
@media (max-width: 991px) {
  .appshell__main:has(.pr) { padding: 0 0 48px; }
}
</style>
