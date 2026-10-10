<script setup>
import "@/v3/v3.css";
import { computed, onBeforeUnmount, onMounted } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import V3ChipGroup from "@/v3/components/V3ChipGroup.vue";
import { pumpingProgress, pumpingSummary } from "@/v3/api/rtwHelpers";
import { statusText } from "@/v3/api/roomHelpers";
import { PUMPING_SESSIONS, PUMPING_TIMES } from "@/v3/data/rtw";
import { V3_ROUTES } from "@/v3/routes";
import { useReturnToWorkStore } from "@/v3/stores/returnToWork";
import { useRoomsStore } from "@/v3/stores/rooms";

defineOptions({ name: "RtwPumping" });

const store = useReturnToWorkStore();
const roomsStore = useRoomsStore();

const progress = computed(() => pumpingProgress(store.pumpingItems));
const summary = computed(() => pumpingSummary(store.pumping));
const sessionOptions = PUMPING_SESSIONS.map((n) => ({ value: n, label: `${n} sessions` }));
onMounted(() => roomsStore.bind());
onBeforeUnmount(() => roomsStore.unbind());
const rooms = computed(() => roomsStore.rooms);
</script>

<template>
  <div class="rtp">
    <p class="rtp__intro">Get set up before the first day back.</p>

    <section class="rtp__section" aria-labelledby="rtp-checklist">
      <div class="rtp__head">
        <h2 id="rtp-checklist" class="nt-heading nt-heading--sm">Checklist</h2>
        <p class="rtp__progress">{{ progress.text }}</p>
      </div>
      <ul class="rtp__list">
        <li v-for="item in store.pumpingItems" :key="item.key" class="rtp__item">
          <input
            :id="`rtp-item-${item.key}`"
            class="form-check-input rtp__check"
            type="checkbox"
            :checked="item.done"
            @change="store.togglePumpingItem(item.key)"
          />
          <label :for="`rtp-item-${item.key}`" class="rtp__label" :class="{ 'rtp__label--done': item.done }">
            {{ item.label }}
          </label>
        </li>
      </ul>
    </section>

    <section class="rtp__section" aria-labelledby="rtp-breaks">
      <h2 id="rtp-breaks" class="nt-heading nt-heading--sm">Pumping breaks at work</h2>
      <p class="rtp__label-text" id="rtp-sessions-label">Sessions per workday</p>
      <V3ChipGroup
        :model-value="store.pumping.sessions"
        :options="sessionOptions"
        label="Sessions per workday"
        @update:model-value="(value) => store.setSessions(value)"
      />
      <p class="rtp__label-text">Time of day</p>
      <div class="rtp__chips" role="group" aria-label="Time of day">
        <button
          v-for="time in PUMPING_TIMES"
          :key="time.value"
          type="button"
          class="v3-chip"
          :aria-pressed="store.pumping.times.includes(time.value) ? 'true' : 'false'"
          @click="store.togglePumpingTime(time.value)"
        >
          {{ time.label }}
        </button>
      </div>
      <p v-if="summary" class="rtp__summary" role="status">{{ summary }}</p>
      <p v-else class="rtp__muted" role="status">Choose how many breaks and when, and your plan shows here.</p>
    </section>

    <section class="rtp__section" aria-labelledby="rtp-rooms">
      <h2 id="rtp-rooms" class="nt-heading nt-heading--sm">Rooms near work</h2>
      <p class="rtp__muted">Sample rooms for now, plus any you added in Support. Check details before you go.</p>
      <ul class="rtp__rooms" aria-label="Pumping rooms">
        <li v-for="room in rooms" :key="room.id" class="rtp__room">
          <div class="rtp__room-text">
            <p class="rtp__room-name">{{ room.name }}</p>
            <p class="rtp__muted">{{ room.address }}</p>
            <p class="rtp__muted">{{ statusText(room) }}</p>
          </div>
          <AppButton variant="outline" size="sm" :to="V3_ROUTES.SUPPORT">
            Open in Support<span class="visually-hidden"> for {{ room.name }}</span>
          </AppButton>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.rtp { display: flex; flex-direction: column; gap: 32px; max-width: 720px; }
.rtp__intro { margin: 0; font-size: 1rem; color: var(--nt-muted); }
.rtp__section { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.rtp__section h2 { margin: 0; }
.rtp__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 16px; width: 100%; }
.rtp__progress { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.rtp__list { width: 100%; margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.rtp__item { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--nt-line); }
.rtp__check { flex: none; width: 20px; height: 20px; margin: 0; cursor: pointer; }
.rtp__check:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.rtp__label { font-size: 1rem; color: var(--nt-ink); cursor: pointer; }
.rtp__label--done { color: var(--nt-muted); text-decoration: line-through; }
.rtp__label-text { margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.rtp__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.rtp__summary { margin: 0; font-size: 1rem; font-weight: 500; color: var(--nt-ink); }
.rtp__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.rtp__rooms { width: 100%; margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.rtp__room { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 14px 0; border-bottom: 1px solid var(--nt-line); }
.rtp__room-name { margin: 0; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }
</style>
