<script setup>
import { computed, ref } from "vue";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppLink from "@/components/ui/AppLink.vue";
import AvatarDot from "@/components/ui/AvatarDot.vue";
import EntryPillTabs from "@/components/ui/EntryPillTabs.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import { ROUTES, path } from "@/shared/constants/routes";
import {
  TABS,
  TODAY,
  TYPE_BADGE,
  TYPE_LABEL,
  dayLabel,
  daySummary,
  dayStats,
  entries,
  filterEntries,
  fmtSleep,
  fmtTime,
  groupByDay,
  isUnseen,
  markAllSeen,
  seenLine,
} from "@/data/careLog";

defineOptions({ name: "CareLogPage" });

const tab = ref("all");
const showEarlier = ref(false);

const unseenCount = computed(() => entries.filter(isUnseen).length);

// Days that are always shown, and the older ones behind "Show earlier days".
const RECENT_DAYS = 2;
const groups = computed(() => groupByDay(filterEntries(entries, tab.value)));
const allDates = computed(() => groupByDay(entries).map((g) => g.date));
const hiddenDates = computed(() => new Set(allDates.value.slice(RECENT_DAYS)));
const visibleGroups = computed(() =>
  showEarlier.value ? groups.value : groups.value.filter((g) => !hiddenDates.value.has(g.date)),
);
const canShowEarlier = computed(
  () => !showEarlier.value && groups.value.some((g) => hiddenDates.value.has(g.date)),
);

const today = computed(() => dayStats(TODAY));
const lastFeed = computed(() => {
  const feeds = filterEntries(entries, "feed")
    .filter((e) => e.date === TODAY && !e.live)
    .sort((a, b) => b.min - a.min);
  const f = feeds[0];
  if (!f) return null;
  const detail = f.text.split(", ").slice(1).join(", ");
  return { time: fmtTime(f.min), who: f.who === "M" ? "Mei" : "You", detail };
});

const handoverTo = "Mei";
const guideTo = path(ROUTES.GUIDE, { topic: "settle" });
const editTo = (e) => ({ path: ROUTES.ADD_ENTRY, query: { edit: e.id } });
const title = (e) => (e.live ? e.title : TYPE_LABEL[e.type]);
</script>

<template>
  <div class="nt-stack">
    <PageHeader
      title="Care log"
      subtitle="Whatever either of you writes down shows up on both phones straight away."
    >
      <AppButton variant="outline" size="md" :to="ROUTES.HANDOVER">Hand over to {{ handoverTo }}</AppButton>
      <AppButton size="md" :to="ROUTES.ADD_ENTRY">Add entry</AppButton>
    </PageHeader>

    <div class="filter-row">
      <EntryPillTabs v-model="tab" :tabs="TABS" aria-label="Filter the care log" />
      <div class="legend">
        <span class="legend__item"><i class="legend__sq legend__sq--M" />Mei</span>
        <span class="legend__item"><i class="legend__sq legend__sq--D" />You</span>
        <template v-if="unseenCount">
          <span class="legend__strong">{{ unseenCount }} new from Mei</span>
          <AppLink @click="markAllSeen()">Mark all as seen</AppLink>
        </template>
        <span v-else class="legend__strong">All caught up</span>
      </div>
    </div>

    <div class="log-cols">
      <div class="timeline">
        <section v-for="g in visibleGroups" :key="g.date" class="day" :aria-label="dayLabel(g.date)">
          <h2 class="nt-heading day__title">{{ dayLabel(g.date) }}</h2>
          <p class="nt-small nt-muted mb-0">{{ daySummary(g.date) }}</p>
          <ol class="entries">
            <li v-for="e in g.entries" :key="e.id" class="entry" data-test="entry" :data-type="e.type">
              <i class="entry__node" :class="e.live ? 'entry__node--live' : `entry__node--${e.who}`" />
              <div class="entry__time">
                <span v-if="e.live" class="entry__now">Now</span>
                <template v-else>
                  <i v-if="isUnseen(e)" class="entry__unseen" aria-label="Not seen yet" />
                  <span :class="{ 'entry__time--strong': isUnseen(e) }">{{ fmtTime(e.min) }}</span>
                </template>
              </div>
              <div class="entry__body">
                <div class="entry__head">
                  <span v-if="e.live" class="entry__title">{{ title(e) }}</span>
                  <AppBadge v-else :color="TYPE_BADGE[e.type].color" :outlined="TYPE_BADGE[e.type].outlined">{{ TYPE_LABEL[e.type] }}</AppBadge>
                  <span class="entry__text">{{ e.text }}</span>
                </div>
                <p v-if="e.detail" class="entry__sub entry__sub--ink">{{ e.detail }}</p>
                <p v-if="!e.live" class="entry__sub">{{ seenLine(e) }}</p>
              </div>
              <AvatarDot v-if="!e.live" :who="e.who" :size="24" />
              <AppLink v-if="e.who === 'D' && !e.live" class="entry__edit" :to="editTo(e)">Edit</AppLink>
            </li>
          </ol>
        </section>
        <p v-if="!visibleGroups.length" class="nt-muted">Nothing logged here yet.</p>
        <div v-if="canShowEarlier">
          <AppButton variant="outline" size="md" @click="showEarlier = true">Show earlier days</AppButton>
        </div>
      </div>

      <aside class="side">
        <section class="side__block" aria-label="Today so far">
          <h2 class="nt-heading">Today so far</h2>
          <div class="stat">
            <div>
              <div class="nt-small nt-muted">Feeds</div>
              <div class="nt-small nt-muted">Mei {{ today.feedsMei }}, you {{ today.feedsYou }}</div>
            </div>
            <strong>{{ today.feeds }}</strong>
          </div>
          <div class="stat">
            <span class="nt-small nt-muted">Nappies</span>
            <strong>{{ today.nappies }}</strong>
          </div>
          <div class="stat">
            <span class="nt-small nt-muted">Sleep logged</span>
            <strong>{{ fmtSleep(today.sleepMin) }}</strong>
          </div>
          <div v-if="lastFeed" class="stat">
            <div>
              <div class="nt-small nt-muted">Last feed</div>
              <div class="nt-small nt-muted">{{ lastFeed.who }}, {{ lastFeed.detail }}</div>
            </div>
            <strong>{{ lastFeed.time }}</strong>
          </div>
        </section>

        <section class="side__block" aria-label="Handover">
          <h2 class="nt-heading">Handover</h2>
          <p class="nt-small nt-muted mb-0">Hand over at the end of a shift so the next parent starts with the full picture.</p>
          <div><AppButton variant="outline" size="md" :to="ROUTES.HANDOVER">Start a handover</AppButton></div>
        </section>

        <AppLink :to="guideTo">Stuck? See what to try</AppLink>
        <p class="nt-small nt-muted mb-0">Log medication exactly as the label or your doctor says. This log never suggests doses.</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend__sq {
  width: 8px;
  height: 8px;
}
.legend__sq--M,
.entry__node--M {
  background: var(--nt-powder-d);
}
.legend__sq--D,
.entry__node--D {
  background: var(--nt-apricot-d);
}
.legend__strong {
  font-weight: 500;
  color: var(--nt-ink);
}

.log-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 80px;
  align-items: start;
}
.timeline {
  display: flex;
  flex-direction: column;
  gap: 40px;
  min-width: 0;
}
.day {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.day__title {
  font-size: 1.625rem;
}
.entries {
  margin: 4px 0 0;
  padding: 0 0 0 28px;
  list-style: none;
  border-left: 1px solid var(--nt-line);
}
.entry {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 14px 0;
}
.entry__node {
  position: absolute;
  top: 20px;
  left: -32px;
  width: 8px;
  height: 8px;
}
.entry__node--live {
  top: 18px;
  left: -34px;
  width: 12px;
  height: 12px;
  background: var(--nt-coral);
}
.entry__time {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  width: 84px;
  min-height: 24px;
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.entry__time--strong {
  font-weight: 600;
  color: var(--nt-ink);
}
.entry__unseen {
  width: 6px;
  height: 6px;
  background: var(--nt-coral);
}
.entry__now {
  font-weight: 600;
  color: var(--nt-coral);
}
.entry__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.entry__head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  line-height: 1.45;
}
.entry__title {
  font-weight: 600;
  white-space: nowrap;
}
.entry__sub {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--nt-muted);
}
.entry__sub--ink {
  color: var(--nt-ink);
}
.entry__edit {
  font-size: 0.875rem;
  line-height: 24px;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 36px;
  align-items: flex-start;
}
.side__block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: stretch;
  width: 100%;
}
.side__block > div:last-child:not(.stat) {
  align-self: flex-start;
}
.stat {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid var(--nt-line);
}
.stat strong {
  font-weight: 600;
  white-space: nowrap;
}

@media (max-width: 991px) {
  .log-cols {
    grid-template-columns: minmax(0, 1fr);
    gap: 40px;
  }
  .entry {
    flex-wrap: wrap;
  }
  .entry__time {
    width: 76px;
  }
}
</style>
