<script setup>
import "@/app/app.css";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import ChipGroup from "@/app/components/ChipGroup.vue";
import Icon from "@/app/components/Icon.vue";
import Tabs from "@/app/components/Tabs.vue";
import GooglePlaceAutocomplete from "@/app/components/GooglePlaceAutocomplete.vue";
import { FILTER_FEATURES, FORM_FEATURES } from "@/app/data/pumpingRooms";
import { SUPPORT_GUIDES, TRUSTED_RESOURCES } from "@/app/data/support";
import { filterRooms, mapEmbedUrl, mapOpenUrl, statusText } from "@/app/api/roomHelpers";
import { describeSharedError } from "@/app/api/sharedHelpers";
import { useRoomsStore } from "@/app/stores/rooms";
import { ROUTES } from "@/app/routes";
import { useRouter } from "vue-router";

defineOptions({ name: "SupportPage" });

const TABS = [
  { id: "guides", label: "Guides" },
  { id: "rooms", label: "Pumping rooms" },
  { id: "resources", label: "Trusted resources" },
];
const tab = ref("guides");

// Guides accordion
const openGuides = ref(new Set());
function toggleGuide(slug) {
  const next = new Set(openGuides.value);
  if (next.has(slug)) next.delete(slug);
  else next.add(slug);
  openGuides.value = next;
}

// Pumping rooms
// The directory is the Firestore collection `pumpingRooms`. While it is empty the store
// falls back to the seed rooms in src/app/data/pumpingRooms.js, which cannot be reported.
const roomsStore = useRoomsStore();
const router = useRouter();
function openMap() {
  if (router) router.push(ROUTES.ROOMS);
  else window.location.assign(ROUTES.ROOMS);
}
onMounted(() => roomsStore.bind());
onBeforeUnmount(() => roomsStore.unbind());
const allRooms = computed(() => roomsStore.rooms);
const roomsError = computed(() => (roomsStore.error ? describeSharedError(roomsStore.error.code, "pumping rooms").text : ""));
const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "needs verification", label: "Needs verification" },
];
const status = ref("all");
const features = ref([]);
const search = ref("");
const roomView = ref("directory");
const SAVED_ROOMS_KEY = "nurturetrack:saved-pumping-rooms";
function readSavedRooms() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_ROOMS_KEY) || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}
const savedRoomIds = ref(readSavedRooms());
const savedRooms = computed(() => allRooms.value.filter((room) => savedRoomIds.value.includes(room.id)));
const locationMessage = ref("");
const filtered = computed(() =>
  filterRooms(allRooms.value, { status: status.value, features: features.value, search: search.value }),
);
const visibleRooms = computed(() =>
  roomView.value === "saved" ? filtered.value.filter((room) => savedRoomIds.value.includes(room.id)) : filtered.value,
);
const selectedId = ref("");
const selected = computed(() => visibleRooms.value.find((r) => r.id === selectedId.value) ?? visibleRooms.value[0] ?? null);

function isSaved(room) {
  return savedRoomIds.value.includes(room.id);
}
function toggleSaved(room) {
  savedRoomIds.value = isSaved(room)
    ? savedRoomIds.value.filter((id) => id !== room.id)
    : [...savedRoomIds.value, room.id];
  localStorage.setItem(SAVED_ROOMS_KEY, JSON.stringify(savedRoomIds.value));
}
function findNearMe() {
  locationMessage.value = "";
  if (!navigator.geolocation) {
    locationMessage.value = "Location search is not available in this browser.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const query = encodeURIComponent(`pumping room near ${coords.latitude},${coords.longitude}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank", "noopener,noreferrer");
    },
    () => {
      locationMessage.value = "We could not access your location. Search by building or address instead.";
    },
  );
}

// Confirming or flagging a room
const reported = ref("");
async function report(room, kind) {
  reported.value = "";
  const ok = await roomsStore.reportRoom(room.id, kind);
  if (ok) {
    reported.value =
      kind === "confirm"
        ? `Thank you. ${room.name} is marked as verified.`
        : `Thank you. ${room.name} is flagged and needs verification again.`;
  }
}

function toggleIn(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Add form
const formOpen = ref(false);
const form = ref({ name: "", address: "", details: "", placeId: "", lat: null, lng: null, features: [] });
const errors = ref({ place: "", details: "" });
const added = ref("");
const addButton = ref(null);

function openForm() {
  added.value = "";
  formOpen.value = true;
}
function closeForm() {
  formOpen.value = false;
  form.value = { name: "", address: "", details: "", placeId: "", lat: null, lng: null, features: [] };
  errors.value = { place: "", details: "" };
  requestAnimationFrame(() => addButton.value?.$el?.focus?.());
}
function selectGooglePlace(place) {
  form.value = { ...form.value, ...place };
  errors.value.place = "";
}
async function saveRoom() {
  errors.value = {
    place: form.value.placeId && form.value.name && form.value.address ? "" : "Choose a building or address from Google suggestions.",
    details: form.value.details.trim() ? "" : "Add the floor and exact room location.",
  };
  if (errors.value.place || errors.value.details) return;
  const room = await roomsStore.addRoom(form.value);
  if (!room) return;
  status.value = "all";
  features.value = [];
  search.value = "";
  selectedId.value = room.id;
  added.value = `${room.name} added. It needs verification.`;
  closeForm();
}
</script>

<template>
  <div class="sp">
    <header class="sp__head">
      <h1 class="nt-title sp__title">Support</h1>
      <p class="sp__sub">Guides, trusted contacts and places to pump.</p>
    </header>

    <Tabs v-model="tab" :tabs="TABS" label="Support sections" id-base="support" />

    <!-- Guides -->
    <div v-if="tab === 'guides'" id="support-panel-guides" class="sp__narrow" role="tabpanel" aria-labelledby="support-tab-guides">
      <ul class="sp__acc">
        <li v-for="g in SUPPORT_GUIDES" :key="g.slug" class="sp__acc-item">
          <h2 class="sp__acc-h">
            <button
              :id="`guide-btn-${g.slug}`"
              type="button"
              class="sp__acc-btn"
              :aria-expanded="openGuides.has(g.slug) ? 'true' : 'false'"
              :aria-controls="`guide-panel-${g.slug}`"
              @click="toggleGuide(g.slug)"
            >
              <span>
                <span class="sp__acc-title">{{ g.title }}</span>
                <span class="sp__muted sp__acc-blurb">{{ g.blurb }}</span>
              </span>
              <span class="sp__chev" :class="{ 'sp__chev--open': openGuides.has(g.slug) }"><Icon name="chevron-down" :size="20" /></span>
            </button>
          </h2>
          <div
            v-if="openGuides.has(g.slug)"
            :id="`guide-panel-${g.slug}`"
            class="sp__acc-panel"
            role="region"
            :aria-labelledby="`guide-btn-${g.slug}`"
          >
            <p class="sp__text">{{ g.intro }}</p>
            <ol class="sp__steps">
              <li v-for="s in g.steps" :key="s.title">
                <strong>{{ s.title }}.</strong> {{ s.body }}
              </li>
            </ol>
            <p class="sp__text sp__strong">Call your doctor if:</p>
            <ul class="sp__bullets">
              <li v-for="c in g.callIf" :key="c">{{ c }}</li>
            </ul>
          </div>
        </li>
      </ul>
      <p class="sp__muted">General guidance only, not medical advice.</p>
    </div>

    <!-- Pumping rooms -->
    <div v-else-if="tab === 'rooms'" id="support-panel-rooms" class="sp__rooms" role="tabpanel" aria-labelledby="support-tab-rooms">
      <div><a class="btn btn-outline btn-sm" :href="ROUTES.ROOMS" @click.prevent="openMap">Open the map</a></div>

      <header class="sp__directory-head">
        <h2 id="pumping-directory-title" class="nt-heading sp__directory-title">Pumping Room Directory</h2>
        <p class="sp__sub">Find pumping rooms near work, school or your regular routes.</p>
      </header>

      <div class="sp__action-row">
        <label class="sp__search">
          <span class="visually-hidden">Search by building, workplace or address</span>
          <span class="sp__search-icon"><Icon name="search" :size="18" /></span>
          <input v-model="search" class="app-control sp__search-input" type="search" placeholder="Search by building, workplace or address" />
        </label>
        <AppButton variant="outline" size="sm" @click="findNearMe">Near me</AppButton>
        <AppButton v-if="!formOpen" ref="addButton" size="sm" @click="openForm">Add a place</AppButton>
        <AppButton variant="outline" size="sm" @click="roomView = roomView === 'saved' ? 'directory' : 'saved'">Saved places · {{ savedRooms.length }}</AppButton>
      </div>
      <p v-if="locationMessage" class="sp__muted" role="status">{{ locationMessage }}</p>

      <form v-if="formOpen" id="sp-add-form" class="sp__form" novalidate aria-label="Add a place" @submit.prevent="saveRoom">
        <div><h2 class="nt-heading nt-heading--sm mb-1">Add a pumping place</h2><p class="sp__muted">Community additions need verification before others rely on them.</p></div>
        <div class="sp__field">
          <span class="sp__label">Building or main address</span>
          <GooglePlaceAutocomplete @selected="selectGooglePlace" />
          <div v-if="form.placeId" class="sp__selected-place">
            <strong>{{ form.name }}</strong><span>{{ form.address }}</span>
          </div>
          <span v-if="errors.place" id="sp-err-place" class="app-error-text">{{ errors.place }}</span>
          <span class="sp__muted">Start typing and select a Google suggestion. The main address is filled automatically.</span>
        </div>
        <label class="sp__field">
          <span class="sp__label">Exact room location</span>
          <input v-model="form.details" class="app-control" :class="{ 'app-control--invalid': errors.details }" type="text" maxlength="200" required placeholder="e.g. Level 3, beside the accessible toilet" :aria-invalid="errors.details ? 'true' : 'false'" :aria-describedby="errors.details ? 'sp-err-details' : undefined" />
          <span v-if="errors.details" id="sp-err-details" class="app-error-text">{{ errors.details }}</span>
        </label>
        <div class="sp__field" role="group" aria-label="Features">
          <span class="sp__label">Features</span>
          <div class="sp__chips">
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
        <div class="sp__form-actions">
          <AppButton size="sm" @click="saveRoom">Save room</AppButton>
          <AppButton variant="outline" size="sm" @click="closeForm">Cancel</AppButton>
        </div>
      </form>

      <div role="status" class="sp__status">
        <p v-if="added" class="sp__muted">{{ added }}</p>
        <p v-if="reported" class="sp__muted">{{ reported }}</p>
      </div>
      <p v-if="roomsStore.writeError" class="app-error-text" role="alert">{{ roomsStore.writeError }}</p>
      <p v-if="roomsError" class="app-error-text" role="alert">{{ roomsError }}</p>

      <p class="sp__notice">Community listings may be unverified. Check details before visiting.</p>

      <div class="sp__results-toolbar" aria-label="Filter pumping rooms">
        <strong class="sp__result-count">{{ visibleRooms.length }} {{ visibleRooms.length === 1 ? 'place' : 'places' }}</strong>
        <div class="d-flex flex-wrap align-items-center gap-2"><span class="sp__filter-label">Verification</span><ChipGroup v-model="status" :options="STATUS_OPTIONS" label="Status" /></div>
        <div class="sp__chips align-items-center" role="group" aria-label="Features"><span class="sp__filter-label">Features</span>
          <button
            v-for="f in FILTER_FEATURES"
            :key="f"
            type="button"
            class="app-chip"
            :aria-pressed="features.includes(f) ? 'true' : 'false'"
            @click="features = toggleIn(features, f)"
          >
            {{ f }}
          </button>
        </div>
        <label class="sp__sort"><span>Sort by</span><select class="app-control" disabled aria-describedby="sp-sort-note"><option>Directory order</option></select></label>
        <span id="sp-sort-note" class="visually-hidden">Distance sorting requires room coordinates, which are not available yet.</span>
      </div>

      <div v-if="!visibleRooms.length" class="sp__empty">
        <h2 class="nt-heading nt-heading--sm">{{ roomView === 'saved' ? 'No saved places yet' : 'No rooms match' }}</h2>
        <p class="sp__muted">{{ roomView === 'saved' ? 'Save a place after checking its access, privacy and facilities.' : 'No rooms match. Try removing a filter.' }}</p>
        <button v-if="roomView === 'saved'" type="button" class="btn btn-outline btn-sm" @click="roomView = 'directory'">Browse the directory</button>
      </div>

      <div v-else class="row g-4 align-items-start">
        <div class="col-lg-6">
        <ul class="sp__list" aria-label="Pumping rooms">
          <li v-for="r in visibleRooms" :key="r.id" class="sp__room" :class="{ 'sp__room--on': selected && selected.id === r.id }">
            <div class="d-flex align-items-start justify-content-between gap-3 w-100"><h2 class="sp__room-name">{{ r.name }}</h2><button type="button" class="sp__save" :aria-pressed="isSaved(r)" :aria-label="`${isSaved(r) ? 'Remove' : 'Save'} ${r.name}`" @click="toggleSaved(r)">{{ isSaved(r) ? 'Saved' : 'Save' }} <span aria-hidden="true">♡</span></button></div>
            <p class="sp__text">{{ r.address }}</p>
            <p v-if="r.details" class="sp__text sp__strong">{{ r.details }}</p>
            <ul class="sp__pills" aria-label="Features">
              <li v-for="f in r.features" :key="f" class="app-pill">{{ f }}</li>
            </ul>
            <div class="d-flex flex-wrap align-items-center gap-2"><span class="sp__verification" :class="{ 'sp__verification--verified': r.status === 'verified' }">{{ r.status === 'verified' ? 'Verified' : 'Needs verification' }}</span><span v-if="r.seed" class="sp__muted">Community submitted</span></div>
            <p v-if="r.status === 'verified'" class="sp__text sp__strong">{{ statusText(r) }}</p>
            <div class="sp__room-actions">
              <button type="button" class="app-textbtn" @click="selectedId = r.id">View details</button>
              <AppButton variant="outline" size="sm" @click="selectedId = r.id">Show on map</AppButton>
              <a class="app-link" :href="mapOpenUrl(r)" target="_blank" rel="noopener noreferrer">Get directions</a>
            </div>
            <div v-if="!r.seed" class="sp__room-actions">
              <AppButton variant="outline" size="sm" @click="report(r, 'confirm')">Confirm this room</AppButton>
              <AppButton variant="outline" size="sm" @click="report(r, 'gone')">Flag as gone</AppButton>
            </div>
          </li>
        </ul>
        </div>

        <div class="col-lg-6"><section v-if="selected" class="sp__map" aria-label="Map and selected place details">
          <iframe
            class="sp__frame"
            :src="mapEmbedUrl(selected)"
            :title="`Map of ${selected.name}`"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          ></iframe>
          <div class="sp__selected-details">
            <div><h2 class="nt-heading nt-heading--sm">{{ selected.name }}</h2><p class="sp__text mt-1">{{ selected.address }}</p><p v-if="selected.details" class="sp__text sp__strong mt-2">{{ selected.details }}</p></div>
            <ul class="sp__pills" aria-label="Available facilities"><li v-for="facility in selected.features" :key="facility" class="app-pill">{{ facility }}</li></ul>
            <p class="sp__text sp__strong">{{ statusText(selected) }}</p>
            <div class="sp__room-actions">
              <a class="btn btn-primary btn-sm" :href="mapOpenUrl(selected)" target="_blank" rel="noopener noreferrer">Get directions</a>
              <button type="button" class="btn btn-outline btn-sm" @click="toggleSaved(selected)">{{ isSaved(selected) ? 'Remove saved place' : 'Save place' }}</button>
              <button v-if="!selected.seed" type="button" class="app-textbtn" @click="report(selected, 'gone')">Report issue</button>
            </div>
          </div>
        </section></div>
      </div>
    </div>

    <!-- Trusted resources -->
    <div v-else id="support-panel-resources" class="sp__narrow" role="tabpanel" aria-labelledby="support-tab-resources">
      <p class="sp__muted">Check numbers and hours before you rely on them.</p>
      <ul class="sp__res">
        <li v-for="r in TRUSTED_RESOURCES" :key="r.id" class="sp__res-item">
          <div>
            <h2 class="sp__res-name">{{ r.name }}</h2>
            <p class="sp__text">{{ r.purpose }}</p>
          </div>
          <a v-if="r.tel" class="app-link" :href="r.tel">{{ r.telLabel }}</a>
        </li>
      </ul>
      <p class="sp__muted">General guidance only, not medical advice.</p>
    </div>
  </div>
</template>

<style scoped>
.sp { display: flex; flex-direction: column; gap: 24px; max-width: 1120px; margin: 0 auto; font-size: 1rem; }
.sp__head { display: flex; flex-direction: column; gap: 8px; }
.sp__title { font-size: 2.5rem; line-height: 1.2; }
.sp__sub { margin: 0; color: var(--nt-muted); }
.sp__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.sp__text { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.sp__strong { font-weight: 600; }
.sp__narrow { display: flex; flex-direction: column; gap: 16px; max-width: 720px; }

.sp__acc { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.sp__acc-item { border-bottom: 1px solid var(--nt-line); }
.sp__acc-h { margin: 0; font-size: 1rem; }
.sp__acc-btn { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 16px 0; background: none; border: 0; font-family: inherit; text-align: left; color: var(--nt-ink); cursor: pointer; }
.sp__acc-btn:hover .sp__acc-title { color: var(--nt-plum); }
.sp__acc-btn:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
.sp__acc-title { display: block; font-size: 1rem; font-weight: 600; }
.sp__acc-blurb { display: block; margin-top: 2px; font-weight: 400; }
.sp__chev { display: inline-flex; flex: none; color: var(--nt-muted); }
.sp__chev--open { transform: rotate(180deg); }
.sp__acc-panel { display: flex; flex-direction: column; gap: 12px; padding: 0 0 20px; }
.sp__steps { margin: 0; padding-left: 20px; font-size: 0.875rem; line-height: 1.5; }
.sp__steps li { margin-bottom: 8px; }
.sp__bullets { margin: 0; padding-left: 20px; font-size: 0.875rem; line-height: 1.5; }

.sp__res { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.sp__res-item { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 16px 0; border-bottom: 1px solid var(--nt-line); }
.sp__res-name { margin: 0 0 2px; font-size: 1rem; font-weight: 600; }

.sp__rooms { display: flex; flex-direction: column; gap: 16px; }
.sp__rooms-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
.sp__directory-head { display: flex; flex-direction: column; gap: 5px; padding-top: 2px; }
.sp__directory-title { font-size: 1.75rem; }
.sp__action-row { display: grid; grid-template-columns: minmax(260px, 1fr) auto auto auto; gap: 10px; align-items: center; }
.sp__notice { margin: 0; padding: 9px 12px; background: rgb(255 255 255 / 45%); border-left: 3px solid #8bbdaf; color: var(--nt-muted); font-size: 0.8125rem; }
.sp__status:empty { display: none; }
.sp__form { display: flex; flex-direction: column; gap: 16px; max-width: 680px; padding: 24px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 12px; }
.sp__field { display: flex; flex-direction: column; gap: 6px; }
.sp__label { font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.sp__selected-place { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: #edf4ef; border-left: 3px solid #8bbdaf; font-size: 0.875rem; }.sp__selected-place span { color: var(--nt-muted); }
.sp__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.sp__form-actions { display: flex; gap: 8px; }
.sp__results-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 20px; padding: 12px 0; border-top: 1px solid var(--nt-line); border-bottom: 1px solid var(--nt-line); }
.sp__result-count { margin-right: auto; white-space: nowrap; }
.sp__filter-label { min-width: 84px; color: var(--nt-muted); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.sp__search { position: relative; display: block; min-width: 0; }
.sp__search-icon { position: absolute; top: 50%; left: 12px; display: inline-flex; transform: translateY(-50%); color: var(--nt-muted); pointer-events: none; }
.sp__search-input { padding-left: 38px; }
.sp__sort { display: flex; align-items: center; gap: 8px; margin-left: auto; color: var(--nt-muted); font-size: 0.8125rem; }.sp__sort .app-control { width: auto; padding: 7px 32px 7px 10px; }

.sp__empty { display: flex; min-height: 170px; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; background: rgb(255 255 255 / 45%); border: 1px dashed #b8c4bf; border-radius: 8px; text-align: center; }
.sp__list { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.sp__room { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; padding: 16px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 8px; }
.sp__room--on { border-color: var(--nt-plum); box-shadow: inset 3px 0 0 var(--nt-plum); }
.sp__room--on .sp__room-name { color: var(--nt-plum); }
.sp__room-name { margin: 0; font-family: var(--nt-serif); font-size: 1.25rem; font-weight: 400; }
.sp__save { flex: none; padding: 4px 0; background: transparent; border: 0; color: var(--nt-plum); font-size: 0.875rem; font-weight: 600; }
.sp__save:hover { color: var(--nt-coral); }.sp__save:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.sp__verification { display: inline-flex; padding: 2px 8px; background: #f8eadf; border-radius: 6px; color: #8a563b; font-size: 0.75rem; font-weight: 600; }.sp__verification--verified { background: #dfeee8; color: #356858; }
.sp__pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.sp__room-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }

.sp__map { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 20px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 8px; }
.sp__frame { width: 100%; height: 360px; border: 1px solid var(--nt-line); border-radius: 12px; background: var(--nt-gray); }
.sp__open { align-self: flex-start; }
.sp__selected-details { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; }

@media (max-width: 991px) {
  .sp__title { font-size: 2rem; }
  .sp__map { position: static; }
  .sp__action-row { grid-template-columns: minmax(220px, 1fr) auto auto; }.sp__action-row .sp__search { grid-column: 1 / -1; }
  .sp__sort { margin-left: 0; }
}
@media (max-width: 575px) {
  .sp__action-row { display: flex; flex-wrap: wrap; }.sp__action-row .sp__search { flex: 1 0 100%; }.sp__action-row :deep(.app-btn) { flex: 1 1 auto; }
  .sp__results-toolbar { align-items: flex-start; }.sp__result-count { flex-basis: 100%; }.sp__filter-label { flex-basis: 100%; }.sp__sort { flex-basis: 100%; }
}
</style>
