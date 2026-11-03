<script setup>
import SkeletonList from "@/app/components/SkeletonList.vue";
import "@/app/app.css";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import Icon from "@/app/components/Icon.vue";
import { formatDistance, sortByDistance } from "@/app/utils/mapHelpers";
import {
  PAGE_SIZE,
  SAVED_KIDS_KEY,
  byName,
  countText,
  filterPlaces,
  formatDate,
  isStale,
  normalizeView,
  telHref,
} from "@/app/utils/kidsCareHelpers";
import AppPager from "@/app/components/AppPager.vue";
import OneMapEmbed from "@/app/components/OneMapEmbed.vue";
import { oneMapPlaceUrl } from "@/app/utils/oneMapHelpers";
import { loadChasClinics } from "@/api/chasClinics";
import { useSavedPlaces } from "@/app/composables/useSavedPlaces";
import { useLocate } from "@/app/composables/useLocate";
import { useAdmin } from "@/composables/useAdmin";

defineOptions({ name: "KidsCarePage" });

const route = useRoute();
// Clinics only. The children's emergency details now sit on the first Who to call card on Support.
const view = computed(() => normalizeView(route.query.view));

const query = ref("");
// Saving places is for parents; an administrator has no saved list.
const { isAdmin } = useAdmin();
const saveView = ref("all");
const filterOpen = ref(false);
const includeDental = ref(false);
const located = ref(false);
const origin = ref(null);
const selectedId = ref("");
const page = ref(1);

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
  page.value = 1;
  selectedId.value = "";
});

const { savedIds, toggleSaved } = useSavedPlaces(SAVED_KIDS_KEY);

const source = computed(() => clinics.value);
const matches = computed(() => {
  const base = saveView.value === "saved" ? source.value.filter((p) => savedIds.value.includes(p.id)) : source.value;
  const filtered = filterPlaces(base, { text: query.value, includeDental: includeDental.value });
  if (located.value && origin.value) return sortByDistance(filtered, origin.value);
  return view.value === "clinics" ? byName(filtered) : filtered;
});
const visible = computed(() => matches.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));
const savedCount = computed(() => source.value.filter((p) => savedIds.value.includes(p.id)).length);
const count = computed(() => countText(matches.value.length, located.value ? "near you" : "in Singapore"));
const filterCount = computed(() => (includeDental.value ? 1 : 0));

const clinicsStale = computed(() => view.value === "clinics" && isStale(clinicMeta.value.retrievedAt));
const retrievedText = computed(() => formatDate(clinicMeta.value.retrievedAt));

// Same as the pumping rooms map: the chosen clinic, else the person's location, else the island.
const hasPoint = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng);
const embed = computed(() => {
  const place = visible.value.find((p) => p.id === selectedId.value);
  if (place && hasPoint(place)) return { lat: place.lat, lng: place.lng, label: place.name };
  if (located.value && origin.value) return { lat: origin.value.lat, lng: origin.value.lng, label: "your area" };
  return { lat: null, lng: null, label: "" };
});
const select = (place) => {
  selectedId.value = place.id;
};
const { locating, message: locationMessage, locate: findMe } = useLocate();
function locate() {
  findMe(({ lat, lng }) => {
    origin.value = { lat, lng };
    located.value = true;
    query.value = "";
  });
}
// Open on where the person is. If they say no, the island view and search still work.
onMounted(locate);
const distanceOf = (p) => (located.value ? formatDistance(p.distance) : "");
</script>

<template>
  <div class="kc">
    <header>
      <component :is="isAdmin ? 'h1' : 'h2'" class="nt-title kc__title">Find a clinic</component>
    </header>

    <div class="kc__field">
      <label class="kc__flabel" for="kc-search">Search clinics</label>
      <div class="kc__wrap">
        <input id="kc-search" v-model="query" class="kc__input" type="text" placeholder="Clinic name or area" autocomplete="off" />
        <span class="kc__icon"><Icon name="search" :size="18" /></span>
      </div>
    </div>

    <p class="kc__notice" role="status">
      <svg class="kc__info" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" />
      </svg>
      <span>CHAS subsidies depend on your card. Check with the clinic. For an emergency call <a class="app-link" href="tel:995">995</a>.</span>
    </p>
    <p v-if="clinicsStale" class="kc__notice" role="status">
      <span>This clinic list was last updated on {{ retrievedText }}, so some details may have changed. Check with the clinic before you go.</span>
    </p>
    <p v-if="locationMessage" class="kc__notice" role="status">{{ locationMessage }}</p>

    <div class="kc__bar">
      <p class="kc__count" aria-live="polite">{{ count }}</p>
      <div class="kc__controls">
        <AppButton variant="outline" size="sm" :disabled="locating" @click="locate">
          <Icon name="locate" :size="16" />
          {{ locating ? "Locating..." : "Use my location" }}
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

    <div v-if="!isAdmin" class="kc__views" role="group" aria-label="Show">
      <button type="button" class="kc__tab kc__tab--btn" :class="{ 'kc__tab--on': saveView === 'all' }" :aria-pressed="saveView === 'all' ? 'true' : 'false'" @click="saveView = 'all'">All</button>
      <button type="button" class="kc__tab kc__tab--btn" :class="{ 'kc__tab--on': saveView === 'saved' }" :aria-pressed="saveView === 'saved' ? 'true' : 'false'" @click="saveView = 'saved'">
        Saved places ({{ savedCount }})
      </button>
    </div>

    <section class="kc__map" aria-label="Map">
      <OneMapEmbed :lat="embed.lat" :lng="embed.lng" :label="embed.label" />
    </section>

    <ul v-if="visible.length" class="kc__list" aria-label="CHAS clinics">
      <li v-for="place in visible" :id="`kc-card-${place.id}`" :key="place.id" class="kc__card" :class="{ 'kc__card--on': place.id === selectedId }" :aria-current="place.id === selectedId ? 'true' : undefined" @click="select(place)">
        <h2 class="kc__name">{{ place.name }}</h2>
        <p class="kc__text">{{ place.address }}</p>
        <p class="kc__type">{{ place.type === "dental" ? "CHAS clinic, dental" : "CHAS clinic" }}</p>
                <p class="kc__muted">CHAS subsidies depend on your card. Check with the clinic.</p>
        <p v-if="distanceOf(place)" class="kc__muted">{{ distanceOf(place) }} away</p>
        <div class="kc__actions">
          <button
            v-if="!isAdmin"
            type="button"
            class="app-textbtn"
            :aria-pressed="savedIds.includes(place.id) ? 'true' : 'false'"
            :aria-label="`${savedIds.includes(place.id) ? 'Remove' : 'Save'} ${place.name}`"
            @click.stop="toggleSaved(place)"
          >
            {{ savedIds.includes(place.id) ? "Saved" : "Save" }}
          </button>
          <a v-if="oneMapPlaceUrl(place.lat, place.lng)" class="app-link" :href="oneMapPlaceUrl(place.lat, place.lng)" target="_blank" rel="noopener noreferrer" @click.stop>
            Open in OneMap<span class="visually-hidden"> for {{ place.name }}, opens in a new tab</span>
          </a>
          <button type="button" class="app-textbtn" :aria-label="`Show ${place.name} on map`" @click.stop="select(place)">Show on map</button>
          <a v-if="telHref(place.phone)" class="app-link kc__call" :href="telHref(place.phone)" @click.stop>
            Call<span class="visually-hidden"> {{ place.name }}</span>
          </a>
          <a v-if="place.sourceUrl" class="kc__source" :href="place.sourceUrl" target="_blank" rel="noopener noreferrer" @click.stop>
            Source<span class="visually-hidden"> for {{ place.name }}, opens in a new tab</span>
          </a>
        </div>
      </li>
    </ul>
    <div v-else class="kc__empty">
      <template v-if="view === 'clinics' && clinicsState === 'loading'">
        <SkeletonList :rows="3" :height="88" label="Loading clinics" />
      </template>
      <template v-else-if="view === 'clinics' && !clinics.length">
        <h2 class="nt-heading nt-heading--sm">The clinic list is not available yet</h2>
        <p class="kc__muted">
          {{ clinicsState === "failed" ? "The clinic list could not be loaded." : "The CHAS clinic list has not been added to this app yet." }}
          Search OneMap for a clinic near you.
        </p>
      </template>
      <template v-else>
        <h2 class="nt-heading nt-heading--sm">{{ saveView === "saved" ? "No saved places yet" : "No places match" }}</h2>
        <p class="kc__muted">{{ saveView === "saved" ? "Save a place from the list and it shows here." : "Try a different search." }}</p>
      </template>
    </div>

    <AppPager v-model="page" :total="matches.length" :page-size="PAGE_SIZE" label="Clinic pages" />

    <footer class="kc__foot">
      <p class="kc__muted">
        Dataset: {{ clinicMeta.dataset || "CHAS Clinics" }}. Source: data.gov.sg. Licence: Singapore Open Data Licence.
        {{ retrievedText ? `Retrieved ${retrievedText}.` : "Snapshot not loaded yet." }}
        The list shows CHAS participation only, not child specialties.
      </p>
    </footer>
  </div>
</template>

<style scoped>
/* The app's look: serif banner, cream cards with a sand edge, pill buttons in navy and sand. */
.kc { --navy: #243560; --navy-2: #2d3f70; --ink: #1f2a52; --sand: #e9d9b8; --cream: #fdf9f0; display: flex; flex-direction: column; gap: 16px; min-width: 0; color: var(--ink); font-family: Inter, sans-serif; }
.kc > * { margin: 0; }
.kc__tabs, .kc__views { display: flex; flex-wrap: wrap; gap: 8px; }
.kc__tab { display: inline-flex; align-items: center; min-height: 40px; padding: 7px 20px; background: #fff; border: 1.5px solid var(--sand); border-bottom-width: 3px; border-radius: 999px; font: inherit; font-size: 0.9375rem; font-weight: 600; color: var(--navy); text-decoration: none; cursor: pointer; transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease; }
.kc__tab:hover { border-color: var(--navy); color: var(--navy); transform: translateY(-1px); }
.kc__tab--on, .kc__tab--on:hover { background: var(--navy); border-color: #182246; color: #fff; }
.kc__tab:focus-visible, .kc__source:focus-visible, .kc__input:focus-visible { outline: 3px solid #f2a477; outline-offset: 2px; }
.kc__title { margin: 0; font-size: 1.75rem; line-height: 1.25; }
.kc__field { display: flex; flex-direction: column; gap: 6px; }
.kc__flabel { font-size: 0.9375rem; font-weight: 600; }
.kc__wrap { position: relative; }
.kc__input { width: 100%; padding: 12px 44px 12px 16px; background: #fff; border: 1.5px solid var(--sand); border-radius: 14px; font: inherit; font-size: 1rem; color: var(--ink); }
.kc__input:focus { border-color: var(--navy); }
.kc__icon { position: absolute; right: 14px; top: 50%; display: inline-flex; transform: translateY(-50%); color: #6b7392; pointer-events: none; }
.kc__notice { display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; background: var(--cream); border: 1px solid var(--sand); border-radius: 16px; font-size: 0.9375rem; line-height: 1.5; color: var(--ink); }
.kc__notice :deep(.app-link) { color: var(--navy); font-weight: 700; }
.kc__info { flex: none; margin-top: 3px; color: #6b7392; }
.kc__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.kc__count { margin: 0; font-size: 1rem; font-weight: 600; color: var(--ink); }
.kc__controls { display: flex; flex-wrap: wrap; gap: 8px; }
.kc__controls :deep(.btn) { min-height: 40px; padding: 7px 18px; background: #fff; border: 1.5px solid var(--sand); border-bottom-width: 3px; border-radius: 999px; color: var(--navy); font-size: 0.9375rem; font-weight: 600; transition: border-color 0.18s ease, transform 0.18s ease; }
.kc__controls :deep(.btn:hover:not(:disabled)) { background: #fff; border-color: var(--navy); color: var(--navy); transform: translateY(-1px); }
.kc__controls :deep(.btn:focus-visible) { outline: 3px solid #f2a477; outline-offset: 2px; }
.kc__filters { padding: 14px 18px; background: var(--cream); border: 1px solid var(--sand); border-radius: 16px; }
.kc__check { display: flex; align-items: center; gap: 8px; font-size: 0.9375rem; }
.kc__map { margin: 0; }
.kc__list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 0; padding: 0; list-style: none; }
.kc__card { cursor: pointer; transition: background-color 150ms, border-color 150ms; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; padding: 22px 26px 20px; background: var(--cream); border: 1px solid var(--sand); border-bottom-width: 4px; border-radius: 24px; }
.kc__card:hover { background: #fffdf8; border-color: #d9c79a; }
.kc__card--on { border-color: #f2a477; }
.kc__name { margin: 0; font-family: var(--nt-serif); font-size: 1.3125rem; line-height: 1.25; font-weight: 700; color: var(--ink); }
.kc__text { margin: 0; font-size: 0.9375rem; line-height: 1.5; }
.kc__type { margin: 0; font-size: 0.875rem; line-height: 1.5; font-weight: 700; color: var(--navy); }
.kc__muted { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: #6b7392; }
.kc__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%; margin-top: auto; padding-top: 12px; }
.kc__actions :deep(.app-textbtn), .kc__actions :deep(.app-link) { display: inline-flex; align-items: center; justify-content: center; min-height: 38px; padding: 6px 16px; background: #fff; border: 1.5px solid var(--sand); border-bottom-width: 3px; border-radius: 999px; color: var(--navy); font: inherit; font-size: 0.9375rem; font-weight: 600; text-decoration: none; cursor: pointer; transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease; }
.kc__actions :deep(.app-textbtn:hover), .kc__actions :deep(.app-link:hover) { border-color: var(--navy); color: var(--navy); transform: translateY(-1px); }
.kc__actions :deep(.app-textbtn[aria-pressed="true"]) { background: var(--navy); border-color: #182246; color: #fff; }
.kc__actions :deep(.kc__call) { background: var(--navy); border-color: #182246; color: #fff; }
.kc__actions :deep(.kc__call:hover) { background: #2c4175; color: #fff; }
.kc__actions :deep(a:focus-visible), .kc__actions :deep(button:focus-visible) { outline: 3px solid #f2a477; outline-offset: 2px; }
.kc__source { margin-left: auto; font-size: 0.875rem; color: #6b7392; text-decoration: underline; text-underline-offset: 3px; }
.kc__empty { display: flex; flex-direction: column; gap: 8px; padding: 24px 28px; background: var(--cream); border: 1px solid var(--sand); border-bottom-width: 4px; border-radius: 24px; }
.kc__empty h2 { margin: 0; font-family: var(--nt-serif); font-size: 1.375rem; font-weight: 700; }
.kc__foot { padding-bottom: 24px; }
@media (max-width: 991px) {
  .kc__list { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 575px) { .kc__card { padding: 18px 18px 16px; } }
@media (prefers-reduced-motion: reduce) { .kc__tab, .kc__back, .kc__controls :deep(.btn), .kc__actions :deep(.app-textbtn), .kc__actions :deep(.app-link) { transition: none; } }
</style>
