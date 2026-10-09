<script setup>
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import ProgressBar from "@/components/ui/ProgressBar.vue";
import { ROUTES } from "@/shared/constants/routes";
import {
  DEMO_TODAY,
  DETAIL_ORDER,
  daysSince,
  featureDef,
  getRoom,
  isoMinusDays,
  noteDate,
  shortDate,
} from "@/data/pumpingRooms";

defineOptions({ name: "pumping-room-detailPage" });

const route = useRoute();
const room = computed(() => getRoom(String(route.params.id)));
const message = ref("");
const helped = ref(new Set());

const subtitle = computed(() => `${room.value.address}. ${room.value.hours}`);
const mapsUrl = computed(
  () =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${room.value.name} ${room.value.address} Singapore`)}`,
);

const rows = computed(() => DETAIL_ORDER.map((key) => ({ def: featureDef(key), ...room.value.features[key], key })));
const parents = (n) => `${n} ${n === 1 ? "parent" : "parents"}`;
const rowNote = (row) =>
  row.state === "yes"
    ? `Confirmed by ${parents(row.count)}`
    : row.state === "no"
      ? `Reported missing by ${parents(row.count)}`
      : "Not reported yet";
function answer(key, state) {
  room.value.features[key] = { state, count: 1 };
}

// Level grid: top floors from the highest level down, then basements.
const grid = computed(() => {
  const levels = room.value.levels;
  const upper = Math.max(4, ...levels.filter((l) => !l.startsWith("B")).map(Number));
  const basement = Math.max(4, ...levels.filter((l) => l.startsWith("B")).map((l) => Number(l.slice(1))));
  const cell = (id, label) => ({ id, label, has: levels.includes(id) });
  return {
    upper: Array.from({ length: upper }, (_, i) => cell(String(upper - i), `Level ${upper - i}`)),
    basements: Array.from({ length: basement }, (_, i) => cell(`B${i + 1}`, `Basement ${i + 1}`)),
  };
});
const whereLine = computed(() => room.value.whereNote);

// Last verified card.
const windowDays = 31;
const status = computed(() => room.value.status);
const verifiedLabel = computed(() => (room.value.verifiedOn ? shortDate(room.value.verifiedOn) : "Not yet"));
const freshness = computed(() => {
  if (!room.value.verifiedOn) return 0;
  const used = windowDays - daysSince(room.value.verifiedOn);
  return Math.max(0, Math.min(100, Math.round((used / windowDays) * 100)));
});
const verifiedText = computed(() => {
  const r = room.value;
  if (r.status === "unverified") return "No other parent has confirmed this room yet.";
  if (r.status === "check") return `Last confirmed by ${parents(r.verifiedBy)}. It may be out of date.`;
  return `Confirmed by ${parents(r.verifiedBy)} in the last 30 days.`;
});
function stillCorrect() {
  const r = room.value;
  r.status = "verified";
  r.verifiedOn = DEMO_TODAY;
  r.verifiedBy += 1;
  message.value = `Thanks. Marked as still correct on ${shortDate(DEMO_TODAY)}.`;
}
function reportOutdated() {
  room.value.status = "check";
  message.value = "Thanks. We have flagged this room to be checked again.";
}

function helpful(note) {
  if (helped.value.has(note.id)) return;
  note.helpful += 1;
  helped.value = new Set([...helped.value, note.id]);
}
</script>

<template>
  <div v-if="!room" class="nt-stack">
    <AppLink :to="ROUTES.PUMPING" muted class="align-self-start nt-small">All pumping rooms</AppLink>
    <PageHeader title="Room not found" subtitle="We could not find that room. It may have been removed." />
    <AppButton :to="ROUTES.PUMPING" class="align-self-start">Back to all pumping rooms</AppButton>
  </div>

  <div v-else class="nt-stack">
    <AppLink :to="ROUTES.PUMPING" muted class="align-self-start nt-small">All pumping rooms</AppLink>
    <PageHeader :title="room.name" :subtitle="subtitle">
      <a class="btn btn-outline btn-lg" :href="mapsUrl" target="_blank" rel="noopener noreferrer">Open in Maps</a>
    </PageHeader>

    <div class="nt-cols">
      <div class="nt-col">
        <AppCard title="What is inside">
          <template v-for="(row, i) in rows" :key="row.key">
            <hr v-if="i > 0" class="nt-rule" />
            <div class="feature">
              <div class="feature__text">
                <span class="feature__name">{{ row.def.detail }}</span>
                <span class="feature__note">{{ rowNote(row) }}</span>
              </div>
              <AppBadge v-if="row.state === 'yes'" color="green">Yes</AppBadge>
              <AppBadge v-else-if="row.state === 'no'" color="red">No</AppBadge>
              <div v-else class="d-flex gap-2">
                <AppButton variant="outline" size="sm" @click="answer(row.key, 'yes')">Yes, it has one</AppButton>
                <AppButton variant="outline" size="sm" @click="answer(row.key, 'no')">No</AppButton>
              </div>
            </div>
          </template>
          <p v-if="room.extras" class="nt-small nt-muted mb-0">{{ room.extras }}</p>
        </AppCard>

        <AppCard title="Where to find it">
          <div class="levels">
            <div v-for="c in grid.upper" :key="c.id" class="level" :class="{ 'level--none': !c.has }">
              <span class="level__name">{{ c.label }}</span>
              <AppBadge v-if="c.has" color="green">Nursing rooms</AppBadge>
              <span v-else class="level__none">None reported</span>
            </div>
          </div>
          <div class="levels">
            <div v-for="c in grid.basements" :key="c.id" class="level" :class="{ 'level--none': !c.has }">
              <span class="level__name">{{ c.label }}</span>
              <AppBadge v-if="c.has" color="green">Nursing rooms</AppBadge>
              <span v-else class="level__none">None reported</span>
            </div>
          </div>
          <p class="nt-small nt-muted mb-0">{{ whereLine }}</p>
        </AppCard>

        <AppCard title="Notes from parents">
          <p class="nt-small nt-muted mb-0">Sample notes and counts for the prototype.</p>
          <p v-if="!room.notes.length" class="mb-0">No notes yet. Be the first to add one when you update this room.</p>
          <template v-for="(note, i) in room.notes" :key="note.id">
            <hr v-if="i > 0" class="nt-rule" />
            <div class="note">
              <p class="note__text">{{ note.text }}</p>
              <div class="note__meta">
                <span>{{ noteDate(note.date) }}</span>
                <button
                  type="button"
                  class="note__helpful"
                  :aria-pressed="helped.has(note.id)"
                  :disabled="helped.has(note.id)"
                  @click="helpful(note)"
                >Helpful {{ note.helpful }}</button>
              </div>
            </div>
          </template>
        </AppCard>
      </div>

      <div class="nt-col">
        <AppCard title="Last verified">
          <p class="verified__date">{{ verifiedLabel }}</p>
          <p class="nt-muted mb-0">{{ verifiedText }}</p>
          <template v-if="room.verifiedOn">
            <div class="d-flex justify-content-between nt-small nt-muted">
              <span>{{ shortDate(isoMinusDays(DEMO_TODAY, windowDays)) }}</span>
              <span>Today</span>
            </div>
            <ProgressBar :value="freshness" color="var(--nt-teal-t)" />
          </template>
          <div class="d-flex flex-wrap align-items-center gap-3">
            <AppButton @click="stillCorrect">Still correct</AppButton>
            <AppLink @click="reportOutdated">Report outdated</AppLink>
          </div>
          <p v-if="message" class="nt-small mb-0 confirm" role="status">{{ message }}</p>
        </AppCard>

        <AppCard title="Going back to work?">
          <AppButton variant="outline" :to="ROUTES.RETURN_TO_WORK" class="align-self-start">
            Add to Mei's workday plan
          </AppButton>
        </AppCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.feature {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.feature__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.feature__name {
  font-size: 1rem;
  font-weight: 500;
}
.feature__note {
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.levels {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 575px) {
  .levels {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.level {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: var(--nt-white);
  border: 1px solid var(--nt-line);
  border-radius: 8px;
}
.level--none {
  background: var(--nt-gray);
}
.level__name {
  font-size: 0.875rem;
  font-weight: 500;
}
.level__none {
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.note {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.note__text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.45;
}
.note__meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.note__helpful {
  padding: 2px 4px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--nt-muted);
  background: none;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
}
.note__helpful:hover:not(:disabled) {
  color: var(--nt-plum);
  text-decoration: underline;
}
.note__helpful:disabled {
  cursor: default;
  color: var(--nt-teal-t);
}
.verified__date {
  margin: 0;
  font-family: var(--nt-serif);
  font-size: 2rem;
  line-height: 1.2;
}
.confirm {
  color: var(--nt-teal-t);
}
</style>
