<script setup>
import "@/app/app.css";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import Icon from "@/app/components/Icon.vue";
import { formatDistance, sortByDistance } from "@/app/api/mapHelpers";
import {
  PAGE_SIZE,
  SAVED_KIDS_KEY,
  byName,
  countText,
  filterPlaces,
  formatDate,
  normalizeView,
  telHref,
} from "@/app/api/kidsCareHelpers";
import OneMapEmbed from "@/app/components/OneMapEmbed.vue";
import { oneMapPlaceUrl } from "@/app/api/oneMapHelpers";
import { loadChasClinics } from "@/app/api/chasClinics";
import { KIDS_EMERGENCY, KIDS_EMERGENCY_NUMBERS, RETRIEVED_AT } from "@/app/data/kidsEmergency";

defineOptions({ name: "KidsCarePage" });

const route = useRoute();
const router = useRouter();
const view = computed(() => normalizeView(route.query.view));

const query = ref("");
const saveView = ref("all");
const filterOpen = ref(false);
const includeDental = ref(false);
const located = ref(false);
const origin = ref(null);
const locationMessage = ref("");
const mapPlace = ref(null);
const shown = ref(PAGE_SIZE);

// Clinics load only when the Clinics view is first opened.
const clinics = ref([]);
const clinicMeta = ref({ retrievedAt: null, count: 0 });
const clinicsState = ref("idle");
async function ensureClinics() {
  if (clinicsState.value !== "idle") return;
  clinicsState.value = "loading";
  const data = await loadChasClinics();
  clinics.value = data.clinics;
  clinicMeta.value = data.meta;
  clinicsState.value = data.failed ? "failed" : "ready";
}
watch(view, (v) => v === "clinics" && ensureClinics(), { immediate: true });
watch([view, query, saveView, includeDental, origin], () => {
  shown.value = PAGE_SIZE;
  mapPlace.value = null;
});

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_KIDS_KEY) || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}
const savedIds = ref(readSaved());
function toggleSaved(place) {
  savedIds.value = savedIds.value.includes(place.id)
    ? savedIds.value.filter((id) => id !== place.id)
    : [...savedIds.value, place.id];
  try {
    localStorage.setItem(SAVED_KIDS_KEY, JSON.stringify(savedIds.value));
  } catch {
    // Saving is a convenience; the list still works for this visit.
  }
}

const source = computed(() => (view.value === "emergency" ? [...KIDS_EMERGENCY] : clinics.value));
const matches = computed(() => {
  const base = saveView.value === "saved" ? source.value.filter((p) => savedIds.value.includes(p.id)) : source.value;
  const filtered = filterPlaces(base, { text: query.value, includeDental: includeDental.value });
  if (located.value && origin.value) return sortByDistance(filtered, origin.value);
  return view.value === "clinics" ? byName(filtered) : filtered;
});
const visible = computed(() => (view.value === "clinics" ? matches.value.slice(0, shown.value) : matches.value));
const hasMore = computed(() => view.value === "clinics" && matches.value.length > shown.value);
const savedCount = computed(() => source.value.filter((p) => savedIds.value.includes(p.id)).length);
const count = computed(() => countText(matches.value.length, located.value ? "near you" : "in Singapore"));
const filterCount = computed(() => (includeDental.value ? 1 : 0));

const retrievedText = computed(() => formatDate(view.value === "emergency" ? RETRIEVED_AT : clinicMeta.value.retrievedAt));

function showOnMap(place) {
  mapPlace.value = place;
  document.getElementById("kc-map")?.scrollIntoView?.({ block: "nearest" });
}
function setView(next) {
  router.replace({ path: route.path, query: { ...route.query, view: next } });
}
function locate() {
  locationMessage.value = "";
  if (!globalThis.navigator?.geolocation) {
    locationMessage.value = "Location is not available in this browser. Search for a place instead.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      origin.value = { lat: coords.latitude, lng: coords.longitude };
      located.value = true;
      query.value = "";
    },
    () => {
      locationMessage.value = "We could not access your location. Search for a place instead.";
    },
  );
}
const distanceOf = (p) => (located.value ? formatDistance(p.distance) : "");
</script>

<template>
  <div class="kc">
    <header class="kc__head">
      <h1 class="nt-title kc__title">Care for your child</h1>
      <p class="kc__lede">Find a children's emergency service, or a clinic close to home.</p>
    </header>

    <nav class="kc__tabs" aria-label="Kids care views">
      <a
        class="kc__tab"
        :class="{ 'kc__tab--on': view === 'emergency' }"
        :href="`${route.path}?view=emergency`"
        :aria-current="view === 'emergency' ? 'page' : undefined"
        @click.prevent="setView('emergency')"
      >
        Emergency
      </a>
      <a
        class="kc__tab"
        :class="{ 'kc__tab--on': view === 'clinics' }"
        :href="`${route.path}?view=clinics`"
        :aria-current="view === 'clinics' ? 'page' : undefined"
        @click.prevent="setView('clinics')"
      >
        Clinics near you
      </a>
    </nav>

    <div class="kc__field">
      <label class="kc__flabel" for="kc-search">Search places</label>
      <div class="kc__wrap">
        <input id="kc-search" v-model="query" class="kc__input" type="text" placeholder="Name or area" autocomplete="off" />
        <span class="kc__icon"><Icon name="search" :size="18" /></span>
      </div>
    </div>

    <p v-if="view === 'emergency'" class="kc__notice" role="status">
      <svg class="kc__info" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" />
      </svg>
      <span>
        For a life-threatening emergency call
        <a class="app-link" :href="`tel:${KIDS_EMERGENCY_NUMBERS.ambulance}`">{{ KIDS_EMERGENCY_NUMBERS.ambulance }}</a>.
        Check the hospital's website before you travel.
      </span>
    </p>
    <p v-else class="kc__notice" role="status">
      <svg class="kc__info" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" />
      </svg>
      <span>CHAS subsidies depend on your card. Check with the clinic. For emergencies use the Emergency tab.</span>
    </p>
    <p v-if="locationMessage" class="kc__notice" role="status">{{ locationMessage }}</p>

    <div class="kc__bar">
      <p class="kc__count" aria-live="polite">{{ count }}</p>
      <div class="kc__controls">
        <AppButton variant="outline" size="sm" @click="locate">
          <Icon name="locate" :size="16" />
          Use my location
        </AppButton>
        <AppButton
          v-if="view === 'clinics'"
          variant="outline"
          size="sm"
          :aria-expanded="filterOpen ? 'true' : 'false'"
          aria-controls="kc-filters"
          @click="filterOpen = !filterOpen"
        >
          <Icon name="sliders" :size="16" />
          Filter<template v-if="filterCount"> ({{ filterCount }})</template>
        </AppButton>
      </div>
    </div>
    <section v-if="filterOpen && view === 'clinics'" id="kc-filters" class="kc__filters" aria-label="Filter clinics">
      <label class="kc__check">
        <input v-model="includeDental" type="checkbox" />
        <span>Include dental clinics</span>
      </label>
    </section>

    <div class="kc__views" role="group" aria-label="Show">
      <button type="button" class="kc__tab kc__tab--btn" :class="{ 'kc__tab--on': saveView === 'all' }" :aria-pressed="saveView === 'all' ? 'true' : 'false'" @click="saveView = 'all'">All</button>
      <button type="button" class="kc__tab kc__tab--btn" :class="{ 'kc__tab--on': saveView === 'saved' }" :aria-pressed="saveView === 'saved' ? 'true' : 'false'" @click="saveView = 'saved'">
        Saved places ({{ savedCount }})
      </button>
    </div>

    <div id="kc-map" class="kc__map">
      <OneMapEmbed :lat="mapPlace?.lat ?? null" :lng="mapPlace?.lng ?? null" :label="mapPlace ? mapPlace.name : ''" />
    </div>

    <ul v-if="visible.length" class="kc__list" :aria-label="view === 'emergency' ? 'Children\'s emergency services' : 'CHAS clinics'">
      <li v-for="place in visible" :id="`kc-card-${place.id}`" :key="place.id" class="kc__card">
        <h2 class="kc__name">{{ place.name }}</h2>
        <p class="kc__text">{{ place.address }}</p>
        <p class="kc__type">{{ place.kind === "emergency" ? place.type : place.type === "dental" ? "CHAS clinic, dental" : "CHAS clinic" }}</p>
        <p v-if="place.kind === 'emergency'" class="kc__muted">{{ place.note }}</p>
        <p v-else class="kc__muted">CHAS subsidies depend on your card. Check with the clinic. For emergencies use the Emergency tab.</p>
        <p v-if="distanceOf(place)" class="kc__muted">{{ distanceOf(place) }} away</p>
        <div class="kc__actions">
          <button
            type="button"
            class="app-textbtn"
            :aria-pressed="savedIds.includes(place.id) ? 'true' : 'false'"
            :aria-label="`${savedIds.includes(place.id) ? 'Remove' : 'Save'} ${place.name}`"
            @click="toggleSaved(place)"
          >
            {{ savedIds.includes(place.id) ? "Saved" : "Save" }}
          </button>
          <a v-if="oneMapPlaceUrl(place.lat, place.lng)" class="app-link" :href="oneMapPlaceUrl(place.lat, place.lng)" target="_blank" rel="noopener noreferrer">
            Open in OneMap<span class="visually-hidden"> for {{ place.name }}, opens in a new tab</span>
          </a>
          <button type="button" class="app-textbtn" :aria-label="`Show ${place.name} on map`" @click="showOnMap(place)">Show on map</button>
          <a v-if="telHref(place.phone)" class="app-link" :href="telHref(place.phone)">
            Call<span class="visually-hidden"> {{ place.name }}</span>
          </a>
          <a v-if="place.sourceUrl" class="kc__source" :href="place.sourceUrl" target="_blank" rel="noopener noreferrer">
            Source<span class="visually-hidden"> for {{ place.name }}, opens in a new tab</span>
          </a>
        </div>
      </li>
    </ul>
    <div v-else class="kc__empty">
      <template v-if="view === 'clinics' && clinicsState === 'loading'">
        <p class="kc__muted">Loading clinics.</p>
      </template>
      <template v-else-if="view === 'clinics' && !clinics.length">
        <h2 class="nt-heading nt-heading--sm">The clinic list is not available yet</h2>
        <p class="kc__muted">
          {{ clinicsState === "failed" ? "The clinic list could not be loaded." : "The CHAS clinic list has not been added to this app yet." }}
          Use the Emergency tab to find care, or search OneMap for a clinic near you.
        </p>
      </template>
      <template v-else>
        <h2 class="nt-heading nt-heading--sm">{{ saveView === "saved" ? "No saved places yet" : "No places match" }}</h2>
        <p class="kc__muted">{{ saveView === "saved" ? "Save a place from the list and it shows here." : "Try a different search." }}</p>
      </template>
    </div>

    <p v-if="hasMore" class="kc__more">
      <button type="button" class="app-textbtn" @click="shown += PAGE_SIZE">Show more</button>
      <span class="kc__muted"> Showing {{ visible.length }} of {{ matches.length }}</span>
    </p>

    <footer class="kc__foot">
      <p v-if="view === 'emergency'" class="kc__muted">
        Hospital details were checked against each hospital's own website on {{ retrievedText }}. Addresses from OneMap. General guidance only.
      </p>
      <p v-else class="kc__muted">
        Dataset: {{ clinicMeta.dataset || "CHAS Clinics" }}. Source: data.gov.sg. Licence: Singapore Open Data Licence.
        {{ retrievedText ? `Retrieved ${retrievedText}.` : "Snapshot not loaded yet." }}
        The list shows CHAS participation only, not child specialties.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.kc { max-width: 1120px; margin: 0 auto; color: var(--nt-ink); font-family: Inter, sans-serif; }
.kc__head { margin-bottom: 20px; }
.kc__title { margin: 0 0 8px; font-size: 1.75rem; line-height: 1.25; }
.kc__lede { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.kc__tabs, .kc__views { display: flex; flex-wrap: wrap; gap: 4px 24px; margin-bottom: 16px; border-bottom: 1px solid var(--nt-line); }
.kc__views { border-bottom: 0; margin-bottom: 16px; }
.kc__tab { padding: 8px 0; margin-bottom: -1px; background: none; border: 0; border-bottom: 2px solid transparent; font: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-muted); text-decoration: none; cursor: pointer; }
.kc__tab:hover { color: var(--nt-ink); }
.kc__tab--on { color: var(--nt-plum); border-bottom-color: var(--nt-plum); font-weight: 600; }
.kc__views .kc__tab { margin-bottom: 0; }
.kc__tab:focus-visible, .kc__source:focus-visible, .kc__input:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
.kc__field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; max-width: 520px; }
.kc__flabel { font-size: 0.875rem; font-weight: 600; }
.kc__wrap { position: relative; }
.kc__input { width: 100%; padding: 12px 44px 12px 16px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 8px; font: inherit; font-size: 0.875rem; color: var(--nt-ink); }
.kc__icon { position: absolute; right: 14px; top: 50%; display: inline-flex; transform: translateY(-50%); color: var(--nt-muted); pointer-events: none; }
.kc__notice { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 12px; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.kc__info { flex: none; margin-top: 3px; }
.kc__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.kc__count { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.kc__controls { display: flex; flex-wrap: wrap; gap: 8px; }
.kc__filters { margin-bottom: 12px; padding: 12px 16px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 8px; }
.kc__check { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; }
.kc__map { margin-bottom: 16px; }
.kc__list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
.kc__card { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 24px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 12px; }
.kc__name { margin: 0; font-family: inherit; font-size: 1rem; line-height: 1.4; font-weight: 600; }
.kc__text { margin: 0; font-size: 0.875rem; line-height: 1.5; }
.kc__type { margin: 0; font-size: 0.875rem; line-height: 1.5; font-weight: 600; color: var(--nt-muted); }
.kc__muted { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.kc__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 20px; margin-top: 8px; }
.kc__source { font-size: 0.875rem; color: var(--nt-muted); text-decoration: underline; text-underline-offset: 3px; }
.kc__empty { display: flex; flex-direction: column; gap: 8px; padding: 24px; background: var(--nt-white); border: 1px solid var(--nt-line); border-radius: 12px; }
.kc__empty h2 { margin: 0; }
.kc__more { margin: 16px 0 0; }
.kc__foot { margin-top: 24px; padding-bottom: 24px; }
@media (max-width: 991px) {
  .kc__list { grid-template-columns: minmax(0, 1fr); }
}
</style>
