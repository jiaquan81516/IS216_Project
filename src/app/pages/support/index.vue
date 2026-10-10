<script setup>
import "@/app/app.css";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import ChipGroup from "@/app/components/ChipGroup.vue";
import Icon from "@/app/components/Icon.vue";
import Tabs from "@/app/components/Tabs.vue";
import { FILTER_FEATURES, FORM_FEATURES } from "@/app/data/pumpingRooms";
import { SUPPORT_GUIDES, TRUSTED_RESOURCES } from "@/app/data/support";
import { calendarUrl, filterRooms, mapEmbedUrl, mapOpenUrl, statusText } from "@/app/api/roomHelpers";
import { describeSharedError } from "@/app/api/sharedHelpers";
import { useRoomsStore } from "@/app/stores/rooms";

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
const filtered = computed(() =>
  filterRooms(allRooms.value, { status: status.value, features: features.value, search: search.value }),
);
const selectedId = ref("");
const selected = computed(() => filtered.value.find((r) => r.id === selectedId.value) ?? filtered.value[0] ?? null);

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
const form = ref({ name: "", address: "", features: [] });
const errors = ref({ name: "", address: "" });
const added = ref("");
const addButton = ref(null);

function openForm() {
  added.value = "";
  formOpen.value = true;
}
function closeForm() {
  formOpen.value = false;
  form.value = { name: "", address: "", features: [] };
  errors.value = { name: "", address: "" };
  requestAnimationFrame(() => addButton.value?.$el?.focus?.());
}
async function saveRoom() {
  errors.value = {
    name: form.value.name.trim() ? "" : "Enter the room name.",
    address: form.value.address.trim() ? "" : "Enter the address.",
  };
  if (errors.value.name || errors.value.address) return;
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
      <div class="sp__rooms-head">
        <p v-if="roomsStore.usingSeed" class="sp__muted">
          Seed rooms for now, not confirmed. Add a real one and the directory takes over.
        </p>
        <p v-else class="sp__muted">Shared by everyone using NurtureTrack. Check details before you go.</p>
        <AppButton
          v-if="!formOpen"
          ref="addButton"
          variant="outline"
          size="sm"
          @click="openForm"
        >
          Add a room
        </AppButton>
      </div>

      <form v-if="formOpen" id="sp-add-form" class="sp__form" novalidate aria-label="Add a room" @submit.prevent="saveRoom">
        <label class="sp__field">
          <span class="sp__label">Room name</span>
          <input v-model="form.name" class="app-control" :class="{ 'app-control--invalid': errors.name }" type="text" required :aria-invalid="errors.name ? 'true' : 'false'" :aria-describedby="errors.name ? 'sp-err-name' : undefined" />
          <span v-if="errors.name" id="sp-err-name" class="app-error-text">{{ errors.name }}</span>
        </label>
        <label class="sp__field">
          <span class="sp__label">Address</span>
          <input v-model="form.address" class="app-control" :class="{ 'app-control--invalid': errors.address }" type="text" required :aria-invalid="errors.address ? 'true' : 'false'" :aria-describedby="errors.address ? 'sp-err-address' : undefined" />
          <span v-if="errors.address" id="sp-err-address" class="app-error-text">{{ errors.address }}</span>
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

      <div class="sp__filters">
        <label class="sp__search">
          <span class="visually-hidden">Search by name or address</span>
          <span class="sp__search-icon"><Icon name="search" :size="18" /></span>
          <input v-model="search" class="app-control sp__search-input" type="search" placeholder="Search by name or address" />
        </label>
        <ChipGroup v-model="status" :options="STATUS_OPTIONS" label="Status" />
        <div class="sp__chips" role="group" aria-label="Features">
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
      </div>

      <p v-if="!filtered.length" class="sp__muted">No rooms match. Try removing a filter.</p>

      <div v-else class="sp__cols">
        <ul class="sp__list" aria-label="Pumping rooms">
          <li v-for="r in filtered" :key="r.id" class="sp__room" :class="{ 'sp__room--on': selected && selected.id === r.id }">
            <h2 class="sp__room-name">{{ r.name }}</h2>
            <p class="sp__text">{{ r.address }}</p>
            <ul class="sp__pills" aria-label="Features">
              <li v-for="f in r.features" :key="f" class="app-pill">{{ f }}</li>
            </ul>
            <p class="sp__text sp__strong">{{ statusText(r) }}</p>
            <div class="sp__room-actions">
              <AppButton variant="outline" size="sm" @click="selectedId = r.id">Show on map</AppButton>
              <a class="app-link" :href="calendarUrl(r)" target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
            </div>
            <div v-if="!r.seed" class="sp__room-actions">
              <AppButton variant="outline" size="sm" @click="report(r, 'confirm')">Confirm this room</AppButton>
              <AppButton variant="outline" size="sm" @click="report(r, 'gone')">Flag as gone</AppButton>
            </div>
            <p v-else class="sp__muted">Seed data, so it cannot be confirmed or flagged yet.</p>
          </li>
        </ul>

        <section v-if="selected" class="sp__map" aria-label="Map">
          <iframe
            class="sp__frame"
            :src="mapEmbedUrl(selected)"
            :title="`Map of ${selected.name}`"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          ></iframe>
          <a class="app-link sp__open" :href="mapOpenUrl(selected)" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
        </section>
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
.sp__status:empty { display: none; }
.sp__form { display: flex; flex-direction: column; gap: 16px; max-width: 560px; padding: 16px; background: var(--nt-gray); border: 1px solid var(--nt-line); border-radius: 12px; }
.sp__field { display: flex; flex-direction: column; gap: 6px; }
.sp__label { font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.sp__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.sp__form-actions { display: flex; gap: 8px; }
.sp__filters { display: flex; flex-direction: column; gap: 12px; }
.sp__search { position: relative; display: block; max-width: 420px; }
.sp__search-icon { position: absolute; top: 50%; left: 12px; display: inline-flex; transform: translateY(-50%); color: var(--nt-muted); pointer-events: none; }
.sp__search-input { padding-left: 38px; }

.sp__cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: start; }
.sp__list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.sp__room { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 16px 0; border-bottom: 1px solid var(--nt-line); }
.sp__room--on .sp__room-name { color: var(--nt-plum); }
.sp__room-name { margin: 0; font-family: var(--nt-serif); font-size: 1.25rem; font-weight: 400; }
.sp__pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.sp__room-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }

.sp__map { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.sp__frame { width: 100%; height: 360px; border: 1px solid var(--nt-line); border-radius: 12px; background: var(--nt-gray); }
.sp__open { align-self: flex-start; }

@media (max-width: 991px) {
  .sp__cols { grid-template-columns: minmax(0, 1fr); }
  .sp__title { font-size: 2rem; }
}
</style>
