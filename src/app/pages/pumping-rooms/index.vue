<script setup>
import "@/app/app.css";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import Icon from "@/app/components/Icon.vue";
import RoomCard from "@/app/components/RoomCard.vue";
import RoomFilterPanel from "@/app/components/RoomFilterPanel.vue";
import RoomMap from "@/app/components/RoomMap.vue";
import GooglePlaceAutocomplete from "@/app/components/GooglePlaceAutocomplete.vue";
import { loadGoogleMaps } from "@/app/api/googleMaps";
import { loadMalls, SEED_COORDS } from "@/app/api/malls";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  activeFilterCount,
  applyFilters,
  mergeRooms,
  prepareCommunityRooms,
  sortByDistance,
} from "@/app/api/mapHelpers";
import { describeSharedError } from "@/app/api/sharedHelpers";
import { FORM_FEATURES } from "@/app/data/pumpingRooms";
import { useRoomsStore } from "@/app/stores/rooms";

defineOptions({ name: "PumpingRoomsPage" });

const KEY_NOTICE = "The map needs a Google Maps key. Add VITE_GOOGLE_MAPS_API_KEY to your .env and restart.";
const SAVED_ROOMS_KEY = "nurturetrack:saved-pumping-rooms";
const hasKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

const roomsStore = useRoomsStore();
const malls = ref([]);
const mapFailed = ref("");
const mapEnabled = computed(() => hasKey && !mapFailed.value);

// Search, filters and view
const query = ref("");
const placeChosen = ref(false);
const filters = ref({ features: [], verifiedOnly: false });
const filterOpen = ref(false);
const view = ref("all");
const selectedId = ref("");
const message = ref("");
const locationMessage = ref("");

// Where distances are measured from, and what the map shows.
const origin = ref({ ...DEFAULT_CENTER });
const originLabel = ref("in Singapore");
const mapCenter = ref({ ...DEFAULT_CENTER });
const mapZoom = ref(DEFAULT_ZOOM);

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

// Rooms: database rooms first, then malls, de-duplicated.
const allRooms = computed(() => mergeRooms(prepareCommunityRooms(roomsStore.rooms, SEED_COORDS), malls.value));
const textFilter = computed(() => (placeChosen.value ? "" : query.value));
const visible = computed(() => {
  const base = view.value === "saved" ? allRooms.value.filter((r) => savedIds.value.includes(r.id)) : allRooms.value;
  const filtered = applyFilters(base, { text: textFilter.value, ...filters.value });
  return sortByDistance(filtered, origin.value);
});
const savedCount = computed(() => allRooms.value.filter((r) => savedIds.value.includes(r.id)).length);
const countText = computed(() => {
  const n = visible.value.length;
  return `${n} ${n === 1 ? "room" : "rooms"} ${originLabel.value}`;
});
const roomsError = computed(() => (roomsStore.error ? describeSharedError(roomsStore.error.code, "pumping rooms").text : ""));
const filterCount = computed(() => activeFilterCount(filters.value));

// Selecting
function scrollToCard(id) {
  nextTick(() => document.getElementById(`room-card-${id}`)?.scrollIntoView?.({ block: "nearest" }));
}
function selectFromMap(id) {
  selectedId.value = id;
  if (id) scrollToCard(id);
}
function selectFromList(room) {
  selectedId.value = room.id;
  if (Number.isFinite(room.lat) && Number.isFinite(room.lng)) {
    mapCenter.value = { lat: room.lat, lng: room.lng };
    mapZoom.value = Math.max(mapZoom.value, 15);
  }
}

// Search
function onInput(event) {
  query.value = event.target.value;
  placeChosen.value = false;
}
const searchInput = ref(null);
let autocomplete = null;
let placeListener = null;
onMounted(async () => {
  roomsStore.bind();
  malls.value = await loadMalls();
  // Start at the user's location when they allow it; stay quiet when they do not.
  locate({ silent: true });
  if (!hasKey) return;
  try {
    const maps = await loadGoogleMaps();
    const { Autocomplete } = await maps.importLibrary("places");
    if (!Autocomplete || !searchInput.value) return;
    autocomplete = new Autocomplete(searchInput.value, {
      componentRestrictions: { country: "sg" },
      fields: ["geometry", "name", "formatted_address"],
    });
    placeListener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const loc = place?.geometry?.location;
      if (!loc) return;
      const point = { lat: typeof loc.lat === "function" ? loc.lat() : loc.lat, lng: typeof loc.lng === "function" ? loc.lng() : loc.lng };
      placeChosen.value = true;
      query.value = place.name || query.value;
      origin.value = point;
      originLabel.value = `near ${place.name || "your search"}`;
      mapCenter.value = { ...point };
      mapZoom.value = 14;
      locationMessage.value = "";
    });
  } catch (cause) {
    mapFailed.value = cause?.message || "Google Maps could not be loaded.";
  }
});
onBeforeUnmount(() => {
  placeListener?.remove?.();
  placeListener = null;
  autocomplete = null;
  roomsStore.unbind();
});

// Geolocation
function locate({ silent = false } = {}) {
  if (!silent) locationMessage.value = "";
  if (!globalThis.navigator?.geolocation) {
    if (!silent) locationMessage.value = "Location is not available in this browser. Search for a place instead.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const point = { lat: coords.latitude, lng: coords.longitude };
      placeChosen.value = false;
      query.value = "";
      origin.value = point;
      originLabel.value = "near you";
      mapCenter.value = { ...point };
      mapZoom.value = 14;
    },
    () => {
      if (!silent) locationMessage.value = "We could not access your location. Search for a place instead.";
    },
  );
}

function onCenterChanged(point) {
  origin.value = point;
  originLabel.value = "near the map centre";
}
function onMapUnavailable(text) {
  mapFailed.value = text;
}
function viewAll() {
  filters.value = { features: [], verifiedOnly: false };
  query.value = "";
  placeChosen.value = false;
  view.value = "all";
  selectedId.value = "";
  origin.value = { ...DEFAULT_CENTER };
  originLabel.value = "in Singapore";
  mapCenter.value = { ...DEFAULT_CENTER };
  mapZoom.value = DEFAULT_ZOOM;
}

// Add a room: the same flow as the Support page, in a panel over the list.
const formOpen = ref(false);
const emptyForm = () => ({ name: "", address: "", details: "", placeId: "", lat: null, lng: null, features: [] });
const form = ref(emptyForm());
const errors = ref({ place: "", details: "" });
const addButton = ref(null);
const panel = ref(null);
function openForm() {
  message.value = "";
  formOpen.value = true;
  nextTick(() => panel.value?.focus?.());
}
function closeForm() {
  formOpen.value = false;
  form.value = emptyForm();
  errors.value = { place: "", details: "" };
  nextTick(() => addButton.value?.$el?.focus?.());
}
function selectGooglePlace(place) {
  form.value = { ...form.value, ...place };
  errors.value.place = "";
}
function toggleIn(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
async function saveRoom() {
  errors.value = {
    place: form.value.placeId && form.value.name && form.value.address ? "" : "Choose a building or address from Google suggestions.",
    details: form.value.details.trim() ? "" : "Add the floor and exact room location.",
  };
  if (errors.value.place || errors.value.details) return;
  const point = Number.isFinite(form.value.lat) ? { lat: form.value.lat, lng: form.value.lng } : null;
  const room = await roomsStore.addRoom(form.value);
  if (!room) return;
  filters.value = { features: [], verifiedOnly: false };
  query.value = "";
  placeChosen.value = false;
  view.value = "all";
  selectedId.value = room.id;
  if (point) {
    mapCenter.value = point;
    mapZoom.value = Math.max(mapZoom.value, 15);
  }
  message.value = `${room.name} added. It needs verification.`;
  closeForm();
}
function onKeydown(event) {
  if (event.key === "Escape" && formOpen.value) closeForm();
}
watch(formOpen, (open) => {
  if (open) window.addEventListener("keydown", onKeydown);
  else window.removeEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="pr">
    <section class="pr__side" aria-label="Pumping room list">
      <div class="pr__scroll">
        <header class="pr__head">
          <h1 class="nt-title pr__title">Find a pumping room</h1>
          <AppButton ref="addButton" variant="outline" size="sm" @click="openForm">Add a room</AppButton>
        </header>

        <div class="pr__field">
          <input
            id="pr-location"
            ref="searchInput"
            class="pr__input"
            type="text"
            placeholder=" "
            autocomplete="off"
            :value="query"
            @input="onInput"
          />
          <label class="pr__label" for="pr-location">Location</label>
          <span class="pr__icon"><Icon name="search" :size="18" /></span>
        </div>
        <p v-if="!hasKey" class="pr__notice" role="status">{{ KEY_NOTICE }}</p>
        <p v-else-if="mapFailed" class="pr__notice" role="status">{{ mapFailed }}</p>
        <p v-if="locationMessage" class="pr__notice" role="status">{{ locationMessage }}</p>

        <div class="pr__bar">
          <p class="pr__count" aria-live="polite">{{ countText }}</p>
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
          <p class="pr__muted">
            Malls are listed from a hand picked list. A mall is not proof that it has a nursing room, so check before you go.
          </p>
        </div>
      </div>

      <section v-if="formOpen" ref="panel" class="pr__panel" tabindex="-1" aria-labelledby="pr-add-title">
        <div class="pr__panel-head">
          <h2 id="pr-add-title" class="nt-heading nt-heading--sm">Add a pumping room</h2>
          <button type="button" class="pr__x" aria-label="Close add a room" @click="closeForm"><Icon name="close" :size="18" /></button>
        </div>
        <p class="pr__muted">Community additions need verification before others rely on them.</p>
        <form class="pr__form" novalidate aria-label="Add a room" @submit.prevent="saveRoom">
          <div class="pr__f">
            <span class="pr__flabel">Building or main address</span>
            <GooglePlaceAutocomplete @selected="selectGooglePlace" />
            <div v-if="form.placeId" class="pr__picked">
              <strong>{{ form.name }}</strong><span>{{ form.address }}</span>
            </div>
            <span v-if="errors.place" class="app-error-text">{{ errors.place }}</span>
          </div>
          <label class="pr__f">
            <span class="pr__flabel">Exact room location</span>
            <input
              v-model="form.details"
              class="app-control"
              :class="{ 'app-control--invalid': errors.details }"
              type="text"
              maxlength="200"
              required
              placeholder="e.g. Level 3, beside the accessible toilet"
              :aria-invalid="errors.details ? 'true' : 'false'"
            />
            <span v-if="errors.details" class="app-error-text">{{ errors.details }}</span>
          </label>
          <div class="pr__f" role="group" aria-label="Features">
            <span class="pr__flabel">Features</span>
            <div class="pr__chips">
              <button
                v-for="f in FORM_FEATURES"
                :key="f"
                type="button"
                class="app-chip"
                :aria-pressed="form.features.includes(f) ? 'true' : 'false'"
                @click="form.features = toggleIn(form.features, f)"
              >
                {{ f }}
              </button>
            </div>
          </div>
          <div class="pr__actions">
            <AppButton size="sm" @click="saveRoom">Save room</AppButton>
            <AppButton variant="outline" size="sm" @click="closeForm">Cancel</AppButton>
          </div>
        </form>
      </section>
    </section>

    <section class="pr__map" aria-label="Map">
      <RoomMap
        v-if="mapEnabled"
        :rooms="visible"
        :selected-id="selectedId"
        :center="mapCenter"
        :zoom="mapZoom"
        @select="selectFromMap"
        @center-changed="onCenterChanged"
        @zoom-changed="mapZoom = $event"
        @unavailable="onMapUnavailable"
      />
      <div v-else class="pr__mapoff"><p class="pr__muted">The map is not available. The list still works.</p></div>
      <button type="button" class="pr__locate" aria-label="Use my location" @click="locate()">
        <Icon name="locate" :size="20" />
      </button>
    </section>
  </div>
</template>

<style scoped>
.pr { display: grid; grid-template-columns: 440px minmax(0, 1fr); height: 100vh; background: #fdfcfb; }
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
.pr__all:focus-visible, .pr__x:focus-visible, .pr__locate:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

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

.pr__map { position: relative; min-width: 0; background: var(--nt-gray); }
.pr__mapoff { display: flex; align-items: center; justify-content: center; height: 100%; padding: 24px; text-align: center; }
.pr__locate { position: absolute; top: 16px; right: 16px; z-index: 3; display: inline-flex; padding: 10px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 8px; color: var(--nt-ink); cursor: pointer; }
.pr__locate:hover { background: var(--nt-gray); }

@media (max-width: 991px) {
  .pr { display: flex; flex-direction: column; height: auto; }
  .pr__side { border-right: 0; border-bottom: 1px solid var(--nt-line); overflow: visible; }
  .pr__scroll { height: auto; overflow: visible; }
  .pr__map { height: 420px; }
}
</style>

<style>
/* Make the page span the whole content area of the app shell (full width, no padding). */
.appshell__main:has(.pr) { padding: 0; }
.appshell__main:has(.pr) .appshell__content { max-width: none; }
@media (max-width: 991px) {
  .appshell__main:has(.pr) { padding: 0 0 48px; }
}
/* Google's suggestion list, kept flat to match the rest of the app. */
.pac-container { border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: none; font-family: Inter, sans-serif; }
.pac-container::after { display: none; }
</style>
