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
import { loadBmsgRooms } from "@/api/bmsgRooms";
import {
  DEFAULT_CENTER,
  activeFilterCount,
  applyFilters,
  mergeRooms,
  prepareCommunityRooms,
  sortByDistance,
} from "@/app/utils/mapHelpers";
import { describeSharedError } from "@/app/utils/sharedHelpers";
import { SEED_COORDS } from "@/app/data/pumpingRooms";
import { BASEMENT_FLOORS, ROOM_FEATURES, UPPER_FLOORS, roomDetails } from "@/app/utils/roomHelpers";
import { useRoomsStore } from "@/app/stores/rooms";
import { useSavedPlaces } from "@/app/composables/useSavedPlaces";
import { useLocate } from "@/app/composables/useLocate";
import { useAuth } from "@/composables/useAuth";
import RoomManager from "@/app/components/RoomManager.vue";
import { useAdmin } from "@/composables/useAdmin";
import { subscribeRoomOverrides } from "@/api/roomManagement";
import AddressPicker from "@/app/components/AddressPicker.vue";
import { resolveRoomLocation, searchPlaces } from "@/api/roomLocation";
import { applyRoomOverrides } from "@/app/utils/roomManagement";

defineOptions({ name: "PumpingRoomsPage" });


const SAVED_ROOMS_KEY = "nurturetrack:saved-pumping-rooms";
const located = ref(false);

const roomsStore = useRoomsStore();
const listed = ref([]);
const overrides = ref([]);
const { isAdmin } = useAdmin();
const manager = ref(null);
let stopOverrides;

// Search, filters and view
const query = ref("");
const filters = ref({ features: [], verifiedOnly: false });
const filterOpen = ref(false);
const view = ref("all");
const selectedId = ref("");
const message = ref("");

// Where distances are measured from.
const origin = ref({ ...DEFAULT_CENTER });
const originLabel = ref("in Singapore");

const { savedIds, toggleSaved } = useSavedPlaces(SAVED_ROOMS_KEY);

// Rooms: database rooms first, then the BMSG directory rooms, de-duplicated.
const allRooms = computed(() => mergeRooms(applyRoomOverrides(
  [...prepareCommunityRooms(roomsStore.rooms, SEED_COORDS), ...listed.value], overrides.value,
), []));
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
// A room saved without a map position is looked up from its address (or its name) the first
// time it is chosen, so every room the directory lists can be shown on the map.
const found = ref({}); // room id -> { lat, lng }, or null when nothing was found
const mapNote = ref("");
const hasPoint = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng);
watch(selectedId, async (id) => {
  mapNote.value = "";
  const room = visible.value.find((r) => r.id === id);
  if (!room || hasPoint(room) || id in found.value) return;
  found.value = { ...found.value, [id]: null };
  let point = null;
  try {
    point = await resolveRoomLocation(room.address);
  } catch {
    try {
      const [first] = await searchPlaces(`${room.name} ${room.address}`.trim().slice(0, 100));
      point = first ?? null;
    } catch {
      point = null;
    }
  }
  if (hasPoint(point)) found.value = { ...found.value, [id]: { lat: point.lat, lng: point.lng } };
  else if (selectedId.value === id) mapNote.value = `We could not find ${room.name} on the map. Use Open in OneMap to search for it.`;
});

const embed = computed(() => {
  const room = visible.value.find((r) => r.id === selectedId.value);
  if (room && hasPoint(room)) return { lat: room.lat, lng: room.lng, label: room.name };
  if (room && hasPoint(found.value[room.id])) return { ...found.value[room.id], label: room.name };
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
  stopOverrides = subscribeRoomOverrides((rooms) => { overrides.value = rooms; }, () => {
    message.value = "Room updates could not be loaded. Please refresh and try again.";
  });
  listed.value = await loadBmsgRooms();
});
onBeforeUnmount(() => { roomsStore.unbind(); stopOverrides?.(); });

// Geolocation
const { locating, message: locationMessage, locate: findMe } = useLocate();
function locate() {
  findMe(({ lat, lng }) => {
    located.value = true;
    query.value = "";
    origin.value = { lat, lng };
    originLabel.value = "near you";
  });
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

// A parent can confirm a community room they did not add, once it is approved and still unverified.
const { currentUser } = useAuth();
const canConfirm = (room) =>
  !isAdmin.value && !!room.createdBy && room.createdBy !== currentUser.value?.uid && room.approval === "approved" && room.status !== "verified";
async function confirmRoom(room) {
  message.value = "";
  if (await roomsStore.reportRoom(room.id, "confirm")) message.value = `Thanks. ${room.name} is now marked as verified.`;
}

const emptyRoom = () => ({ name: "", address: "", lat: null, lng: null, roomType: "", features: [], floor: "", near: "", feedback: "" });
const draft = ref(emptyRoom());
const saving = ref(false);

// Picking a suggestion in the address picker fills in the name, address and map position.
const manual = ref(false);
function pickPlace(place) {
  manual.value = false;
  draft.value.name = place.name.slice(0, 80);
  draft.value.address = place.address;
  draft.value.lat = place.lat;
  draft.value.lng = place.lng;
}
async function submitRoom() {
  if (saving.value) return;
  if (!draft.value.name || !draft.value.address) {
    roomsStore.writeError = "Search for the place and pick it from the list, or enter the address yourself.";
    return;
  }
  roomsStore.writeError = "";
  saving.value = true;
  try {
    const room = await roomsStore.addRoom({ ...draft.value, details: roomDetails(draft.value.floor, draft.value.near) });
    if (!room) return;
    viewAll();
    selectedId.value = room.id;
    message.value = `${room.name} has been added. An administrator reviews it first; until then only you can see it.`;
    draft.value = emptyRoom();
    saving.value = false;
    closeForm();
  } finally {
    saving.value = false;
  }
}
const formOpen = ref(false);
const addButton = ref(null);
const panel = ref(null);
function openForm() {
  if (isAdmin.value) { manager.value?.edit(); return; }
  message.value = "";
  roomsStore.writeError = "";
  formOpen.value = true;
  nextTick(() => panel.value?.focus?.());
}
function closeForm() {
  if (saving.value) return;
  formOpen.value = false;
  nextTick(() => addButton.value?.focus());
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
          v-if="!isAdmin"
          v-model="supportTab"
          :tabs="SUPPORT_TABS"
          label="Support sections"
          id-base="support"
        />
        <header class="pr__head">
          <h1 class="nt-title pr__title">Find a pumping room</h1>
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
          <AppButton variant="outline" size="sm" :disabled="locating" @click="locate()">
            <Icon name="locate" :size="16" />
            {{ locating ? "Locating..." : "Use my location" }}
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
          <p v-if="mapNote" class="pr__muted" role="status">{{ mapNote }}</p>
        </section>

        <div class="pr__views" role="group" aria-label="Show">
          <button type="button" class="app-chip" :aria-pressed="view === 'all' ? 'true' : 'false'" @click="view = 'all'">All rooms</button>
          <button v-if="!isAdmin" type="button" class="app-chip" :aria-pressed="view === 'saved' ? 'true' : 'false'" @click="view = 'saved'">
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
            :can-manage="isAdmin"
            :can-confirm="canConfirm(room)"
            @edit="manager?.edit($event)"
            @delete="manager?.remove($event)"
            @select="selectFromList"
            @toggle-save="toggleSaved"
            @confirm="confirmRoom"
          />
        </ul>
        <div v-else class="pr__empty">
          <h2 class="nt-heading nt-heading--sm">{{ view === "saved" ? "No saved places yet" : "No rooms match" }}</h2>
          <p class="pr__muted">
            {{ view === "saved" ? "Save a room from the list and it shows here." : "Try a different search or remove a filter." }}
          </p>
        </div>

        <div class="pr__foot">
          <p class="pr__muted pr__note">
            Verified rooms are from the Breastfeeding Mothers' Support Group directory. Know another room?
            <button ref="addButton" type="button" class="app-textbtn pr__add" @click="openForm">Add it<span class="visually-hidden"> (add a room)</span></button>.
          </p>
        </div>
      </div>

      <RoomManager v-if="isAdmin" ref="manager" />
      <section v-if="formOpen" ref="panel" class="pr__panel" tabindex="-1" aria-labelledby="pr-add-title">
        <div class="pr__panel-head">
          <h2 id="pr-add-title" class="nt-heading nt-heading--sm">Add a pumping room</h2>
          <button type="button" class="pr__x" aria-label="Close add a room" @click="closeForm"><Icon name="close" :size="18" /></button>
        </div>
        <p class="pr__muted">An administrator reviews new rooms before other parents see them.</p>
        <form class="pr__form" @submit.prevent="submitRoom">
          <AddressPicker id="pr-place" :disabled="saving" @pick="pickPlace" />
          <div v-if="draft.address && !manual" class="pr__picked" role="status">
            <p class="pr__picked-name">{{ draft.name }}</p>
            <p class="pr__muted">{{ draft.address }}</p>
          </div>
          <template v-if="manual">
            <div class="pr__f">
              <label class="pr__flabel" for="pr-name">Name of location</label>
              <input id="pr-name" v-model.trim="draft.name" class="form-control" required maxlength="80" :disabled="saving" />
            </div>
            <div class="pr__f">
              <label class="pr__flabel" for="pr-address">Address</label>
              <textarea id="pr-address" v-model.trim="draft.address" class="form-control" required maxlength="200" rows="2" :disabled="saving" @input="draft.lat = null; draft.lng = null" />
            </div>
          </template>
          <button type="button" class="app-textbtn pr__manual" :disabled="saving" @click="manual = !manual">
            {{ manual ? "Use the search instead" : "Cannot find it? Enter the address yourself" }}
          </button>
          <div class="pr__f">
            <label class="pr__flabel" for="pr-type">Room type</label>
            <select id="pr-type" v-model="draft.roomType" class="form-select" required :disabled="saving">
              <option disabled value="">Choose a room type</option>
              <option>Pumping room</option>
              <option>Nursing room</option>
              <option>Baby care room</option>
              <option>Shared nursing and pumping room</option>
            </select>
          </div>
          <fieldset class="pr__f pr__features" :disabled="saving" aria-describedby="pr-features-hint">
            <legend class="pr__flabel">Feature tags</legend>
            <p id="pr-features-hint" class="pr__muted">Select all the features available.</p>
            <div class="pr__chips">
              <label v-for="[key, label] in ROOM_FEATURES" :key="key" class="pr__feature">
                <input v-model="draft.features" class="pr__feature-input" type="checkbox" :value="label" />
                <span class="pr__feature-pill">
                  <span class="pr__feature-mark" aria-hidden="true"><Icon :name="draft.features.includes(label) ? 'check' : 'plus'" :size="14" /></span>
                  {{ label }}
                </span>
              </label>
            </div>
          </fieldset>
          <div class="pr__f">
            <label class="pr__flabel" for="pr-floor">Which level is it on?</label>
            <select id="pr-floor" v-model="draft.floor" class="form-select" required :disabled="saving">
              <option disabled value="">Choose a level</option>
              <optgroup label="Basement"><option v-for="f in BASEMENT_FLOORS" :key="f">{{ f }}</option></optgroup>
              <optgroup label="Upper floors"><option v-for="f in UPPER_FLOORS" :key="f">{{ f }}</option></optgroup>
            </select>
          </div>
          <div class="pr__f">
            <label class="pr__flabel" for="pr-near">Near (optional)</label>
            <input id="pr-near" v-model.trim="draft.near" class="form-control" maxlength="120" placeholder="For example the lifts or a shop name" :disabled="saving" />
          </div>
          <div class="pr__f">
            <label class="pr__flabel" for="pr-feedback">Parent feedback (optional)</label>
            <textarea id="pr-feedback" v-model.trim="draft.feedback" class="form-control" maxlength="400" rows="3" :disabled="saving" />
          </div>
          <p v-if="roomsStore.writeError" class="app-error-text" role="alert">{{ roomsStore.writeError }}</p>
          <div class="pr__actions">
            <AppButton type="submit" size="sm" :disabled="saving">{{ saving ? "Submitting…" : "Submit room" }}</AppButton>
            <AppButton variant="outline" size="sm" :disabled="saving" @click="closeForm">Cancel</AppButton>
          </div>
        </form>
      </section>
    </section>

  </div>
</template>

<style scoped>
.pr { display: grid; grid-template-columns: 440px minmax(0, 1fr); height: 100vh; background: var(--nt-bg-care); }
.pr__side { position: relative; min-width: 0; border-right: 1px solid var(--nt-line); overflow: hidden; }
.pr__scroll { height: 100%; overflow-y: auto; padding: 32px 0 24px; }
.pr__scroll > :deep(.apptabs) { margin: 0 24px; }
.pr__head { padding: 24px 24px 0; }
.pr__title { margin: 0; font-size: 1.75rem; line-height: 1.25; }
.pr__field { position: relative; margin: 24px 24px 8px; }
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
.pr__note { font-size: 0.875rem; }
.pr__add { font-size: 0.875rem; }
.pr__add:focus-visible, .pr__x:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.pr__panel { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; gap: 12px; padding: 32px 24px; overflow-y: auto; background: var(--nt-white); }
.pr__panel:focus { outline: none; }
.pr__panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pr__panel-head h2 { margin: 0; }
.pr__x { display: inline-flex; padding: 6px; background: transparent; border: 0; border-radius: 8px; color: var(--nt-muted); cursor: pointer; }
.pr__x:hover { background: var(--nt-gray); color: var(--nt-ink); }
.pr__form { display: flex; flex-direction: column; gap: 16px; }
.pr__f { display: flex; flex-direction: column; gap: 6px; }
.pr__picked { padding: 12px 16px; background: #f3eef4; border: 1px solid var(--nt-line); border-radius: 8px; }
.pr__picked-name { margin: 0; font-weight: 600; color: var(--nt-ink); }
.pr__manual { align-self: flex-start; }
.pr__flabel { font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.pr__picked { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: var(--nt-gray); border-radius: 8px; font-size: 0.875rem; }
.pr__picked span { color: var(--nt-muted); }
.pr__features { margin: 0; padding: 0; border: 0; min-width: 0; }
.pr__features legend { float: none; width: auto; margin-bottom: 0; }
.pr__chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.pr__feature { position: relative; cursor: pointer; }
.pr__feature-input { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.pr__feature-pill { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 14px; border: 1px solid var(--nt-line); border-radius: 999px; background: var(--nt-white); color: var(--nt-muted); font-size: 0.875rem; font-weight: 500; line-height: 1.4; transition: background-color 150ms, border-color 150ms, color 150ms; }
.pr__feature-mark { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; background: var(--nt-gray); }
.pr__feature:hover .pr__feature-input:not(:disabled) + .pr__feature-pill { border-color: var(--nt-plum); color: var(--nt-plum); }
.pr__feature-input:checked + .pr__feature-pill { background: #f3eef4; border-color: var(--nt-plum); color: var(--nt-plum); }
.pr__feature-input:checked + .pr__feature-pill .pr__feature-mark { background: var(--nt-plum); color: var(--nt-white); }
.pr__feature-input:focus-visible + .pr__feature-pill { outline: 2px solid var(--nt-plum); outline-offset: 3px; }
.pr__feature:has(:disabled) { cursor: default; opacity: 0.6; }
@media (prefers-reduced-motion: reduce) { .pr__feature-pill { transition: none; } }
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
