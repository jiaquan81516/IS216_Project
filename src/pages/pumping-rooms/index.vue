<script setup>
import { computed, ref } from "vue";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import EntryPillTabs from "@/components/ui/EntryPillTabs.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import { ROUTES, path } from "@/shared/constants/routes";
import {
  FEATURES,
  FILTERS,
  OFFICES,
  REGIONS,
  filterRooms,
  notReportedText,
  rooms,
  shortDate,
  yesFeatures,
} from "@/data/pumpingRooms";
import RoomsMap from "./components/RoomsMap.vue";

defineOptions({ name: "pumping-roomsPage" });

const region = ref("All");
const active = ref([]);
const selectedId = ref("ion-orchard");
const hoverId = ref("");
const officeName = ref("Raffles Place");
const changing = ref(false);

const office = computed(() => OFFICES.find((o) => o.value === officeName.value));
const visible = computed(() => filterRooms(rooms.value, region.value, active.value));
const tabs = computed(() => [
  { value: "All", label: `All ${rooms.value.length}` },
  ...REGIONS.map((r) => ({ value: r, label: `${r} ${rooms.value.filter((x) => x.region === r).length}` })).filter(
    (t) => !t.label.endsWith(" 0"),
  ),
]);
const highlightId = computed(() => hoverId.value || selectedId.value);
const countText = computed(() =>
  visible.value.length === rooms.value.length ? "" : `${visible.value.length} of ${rooms.value.length} rooms shown`,
);

function toggleFilter(key) {
  active.value = active.value.includes(key) ? active.value.filter((k) => k !== key) : [...active.value, key];
}
function clearFilters() {
  region.value = "All";
  active.value = [];
}
function selectOnMap(id) {
  selectedId.value = id;
  document.getElementById(`room-${id}`)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
}
const badge = (r) =>
  r.status === "verified"
    ? { color: "green", text: `Verified ${shortDate(r.verifiedOn)}` }
    : r.status === "check"
      ? { color: "yellow", text: `Check again, last ${shortDate(r.verifiedOn)}` }
      : { color: "gray", text: "Unverified" };
</script>

<template>
  <div class="nt-stack">
    <PageHeader
      title="Pumping rooms"
      subtitle="Mall nursing rooms that parents have used, and what is actually inside each one."
    />
    <p class="nt-small nt-muted mb-0">Sample data: verified dates and parent counts are placeholders.</p>

    <div class="filters">
      <EntryPillTabs v-model="region" :tabs="tabs" aria-label="Region" />
      <div class="filters__only">
        <span class="nt-small nt-muted">Show only</span>
        <button
          v-for="f in FILTERS"
          :key="f.key"
          type="button"
          class="filter"
          :class="{ 'filter--on': active.includes(f.key) }"
          :aria-pressed="active.includes(f.key)"
          @click="toggleFilter(f.key)"
        >{{ f.label }}</button>
      </div>
    </div>

    <div class="near">
      <template v-if="!changing">
        Near <strong>{{ officeName }}</strong>, Mei's office.
        <AppLink @click="changing = true">Change</AppLink>
      </template>
      <template v-else>
        <label class="near__label" for="office">Mei's office is near</label>
        <select id="office" v-model="officeName" class="form-select near__select" @change="changing = false">
          <option v-for="o in OFFICES" :key="o.value" :value="o.value">{{ o.value }}</option>
        </select>
        <AppLink @click="changing = false">Done</AppLink>
      </template>
    </div>

    <div class="nt-cols rooms-cols">
      <div class="nt-col">
        <p v-if="countText" class="nt-small nt-muted mb-0" role="status">{{ countText }}</p>
        <section class="nt-card rooms" aria-label="Rooms">
          <template v-for="(r, i) in visible" :key="r.id">
            <hr v-if="i > 0" class="nt-rule" />
            <RouterLink
              :id="`room-${r.id}`"
              :to="path(ROUTES.PUMPING_DETAIL, { id: r.id })"
              class="room"
              :class="{ 'room--on': r.id === highlightId }"
              @mouseenter="hoverId = r.id"
              @mouseleave="hoverId = ''"
              @focus="hoverId = r.id"
              @blur="hoverId = ''"
            >
              <span class="room__top">
                <span class="room__name">{{ r.name }}</span>
                <AppBadge :color="badge(r).color">{{ badge(r).text }}</AppBadge>
              </span>
              <span class="room__levels">{{ r.levelsLine }} {{ r.hours }}</span>
              <span class="room__tags">
                <AppBadge v-for="f in yesFeatures(r)" :key="f.key" color="blue">{{ f.badge }}</AppBadge>
                <span v-if="notReportedText(r)" class="room__missing">{{ notReportedText(r) }}</span>
              </span>
            </RouterLink>
          </template>
          <div v-if="!visible.length" class="empty">
            <p class="mb-2">No rooms match these filters.</p>
            <AppLink @click="clearFilters">Clear filters</AppLink>
          </div>
        </section>
      </div>

      <div class="nt-col">
        <RoomsMap
          :rooms="visible"
          :active-id="highlightId"
          :office="office"
          @select="selectOnMap"
          @hover="hoverId = $event"
        />
        <AppCard title="Know a room we are missing?">
          <p class="nt-muted mb-0">Other parents rely on what you add. It takes under a minute and mostly taps.</p>
          <AppButton :to="ROUTES.PUMPING_NEW" class="align-self-start">Add a room</AppButton>
        </AppCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;
}
.filters__only {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.filter {
  padding: 5px 10px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--nt-muted);
  background: var(--nt-white);
  border: 1px solid var(--nt-muted);
  border-radius: 6px;
  cursor: pointer;
}
.filter--on {
  color: var(--nt-plum);
  background: var(--nt-gray);
  border: 2px solid var(--nt-plum);
  padding: 4px 9px;
}
.near {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  font-size: 0.9375rem;
  color: var(--nt-muted);
}
.near strong {
  color: var(--nt-ink);
  font-weight: 500;
}
.near__label {
  color: var(--nt-ink);
}
.near__select {
  width: auto;
  padding-block: 0.4rem;
}
.rooms-cols {
  grid-template-columns: minmax(0, 1fr) 400px;
}
@media (max-width: 991px) {
  .rooms-cols {
    grid-template-columns: minmax(0, 1fr);
  }
}
.rooms {
  gap: 0;
  padding: 8px 24px;
}
.room {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 0;
  color: inherit;
  text-decoration: none;
}
.room--on {
  background: var(--nt-gray);
  margin: 0 -24px;
  padding: 16px 24px;
}
.room__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.room__name {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--nt-ink);
}
.room__levels {
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.room__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.room__missing {
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.empty {
  padding: 24px 0;
  color: var(--nt-muted);
}
</style>
