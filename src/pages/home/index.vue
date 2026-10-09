<script setup>
import { computed, reactive } from "vue";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppLink from "@/components/ui/AppLink.vue";
import AvatarDot from "@/components/ui/AvatarDot.vue";
import ChoiceRow from "@/components/ui/ChoiceRow.vue";
import NightStrip from "@/components/ui/NightStrip.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import ProgressBar from "@/components/ui/ProgressBar.vue";
import YoursAlone from "@/components/ui/YoursAlone.vue";
import { RouterLink } from "vue-router";
import { useHouseholdStore } from "@/stores/household";
import { SAMPLE } from "@/shared/constants/appConstants";
import { ROUTES, path } from "@/shared/constants/routes";
import { TODAY, TYPE_BADGE, TYPE_LABEL, entries, filterEntries, fmtTime, sortEntries } from "@/data/careLog";
import { COMING_UP, RETURN_TO_WORK, TASKS, calendarUrl } from "@/data/home";

defineOptions({ name: "HomePage" });

const household = useHouseholdStore();
const now = new Date();

const greeting = computed(() => {
  const h = new Date().getHours();
  return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
});
const dateLine = computed(() => {
  const d = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const t = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dob = household.baby?.dob ? new Date(household.baby.dob) : null;
  const weeks = dob ? Math.max(0, Math.floor((now - dob) / (7 * 24 * 3600 * 1000))) : null;
  const age = weeks === null ? "" : ` ${household.baby.name || SAMPLE.baby} is ${weeks} ${weeks === 1 ? "week" : "weeks"} old.`;
  return `${d}, ${t}.${age}`;
});

// Night strip: feeds logged since 6 PM today, the next feed due about 3 hours after the last one.
const nightFeeds = computed(() =>
  sortEntries(filterEntries(entries, "feed").filter((e) => e.date === TODAY && !e.live && e.min >= 18 * 60)).reverse(),
);
const lastFeed = computed(() => nightFeeds.value[nightFeeds.value.length - 1] ?? null);
const hourLabel = (t) => {
  const total = Math.round(t * 4) / 4;
  const h = Math.floor(total) % 24;
  const m = Math.round((total % 1) * 60);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h >= 12 ? "PM" : "AM"}`;
};
const dueAt = computed(() => (lastFeed.value ? Math.min(lastFeed.value.min / 60 + 3, 30) : 24));
const dueLabel = computed(() => hourLabel(dueAt.value));
const marks = computed(() => [
  ...nightFeeds.value.map((e) => ({ t: e.min / 60, label: `Fed ${fmtTime(e.min)}` })),
  { t: dueAt.value, label: `Feed due about ${dueLabel.value}`, dashed: true },
]);
const nowHour = computed(() => {
  const t = now.getHours() + now.getMinutes() / 60;
  return t >= 18 && t < 24 ? t : 21 + 40 / 60; // outside the evening, show the sample 9:40 PM
});

const recent = computed(() =>
  sortEntries(entries.filter((e) => !e.live))
    .slice(0, 3)
    .map((e) => ({
      id: e.id,
      time: fmtTime(e.min),
      type: e.type,
      text: e.text,
      who: e.who,
      unseen: e.who === "M" && !e.seen,
      status:
        e.who === "M"
          ? e.seen
            ? `Seen by you ${e.seenAt}`
            : "Not seen yet"
          : e.seenAt
            ? `Seen by Mei ${e.seenAt}`
            : "Logged by you",
    })),
);

const done = reactive(Object.fromEntries(TASKS.map((t) => [t.id, false])));
const guideTo = path(ROUTES.GUIDE, { topic: "settle" });
const rtwPercent = (RETURN_TO_WORK.done / RETURN_TO_WORK.total) * 100;
</script>

<template>
  <div class="nt-stack">
    <PageHeader :title="`${greeting}, ${household.displayName}.`" :subtitle="dateLine">
      <AppButton variant="outline" :to="ROUTES.ADD_ENTRY">Add to care log</AppButton>
    </PageHeader>

    <div class="nt-cols">
      <div class="nt-col">
        <section class="nt-card" aria-labelledby="oncall">
          <h2 id="oncall" class="nt-heading home-h26">{{ SAMPLE.partner }} is on call tonight.</h2>
          <p class="mb-0 nt-muted">
            You are off duty until your next night, Sunday 11 October. Feed alerts stay quiet on your phone.
          </p>
          <NightStrip who="M" :marks="marks" :now="nowHour" />
          <div class="btn-row">
            <AppButton variant="outline" :to="ROUTES.ROTA">Request a swap</AppButton>
            <AppButton variant="outline" :to="ROUTES.ROTA">Take over tonight</AppButton>
          </div>
        </section>

        <section class="nt-card" aria-labelledby="next">
          <h2 id="next" class="nt-heading">Do this next</h2>
          <p class="next-lead mb-0">Baby is due a feed around {{ dueLabel }}. Offer to take it.</p>
          <p class="nt-muted mb-0">
            The last feed was at {{ lastFeed ? fmtTime(lastFeed.min) : "9:05 PM" }}, so about three hours have passed.
            {{ SAMPLE.partner }} could sleep through if you warm a bottle of expressed milk and take this one.
          </p>
          <div class="btn-row btn-row--wide">
            <AppButton :to="ROUTES.ADD_ENTRY">Take over the {{ dueLabel }} feed</AppButton>
            <AppLink :to="guideTo">Why, and what else to try</AppLink>
          </div>
          <hr class="nt-rule m-0" />
          <ChoiceRow
            v-for="t in TASKS"
            :key="t.id"
            v-model="done[t.id]"
            type="checkbox"
            :title="t.title"
            :description="t.description"
          />
          <p class="nt-small nt-muted mb-0">General guidance only, not medical advice. If you are worried about baby, call your doctor.</p>
        </section>

        <section class="nt-card" aria-labelledby="since">
          <h2 id="since" class="nt-heading">Since you last looked</h2>
          <ul class="since">
            <li v-for="e in recent" :key="e.id" class="since__row">
              <span class="since__time">{{ e.time }}</span>
              <AppBadge :color="TYPE_BADGE[e.type].color" :outlined="TYPE_BADGE[e.type].outlined">{{ TYPE_LABEL[e.type] }}</AppBadge>
              <span class="since__main">
                <span class="since__text">{{ e.text }}</span>
                <span class="since__status"><i v-if="e.unseen" class="since__sq" />{{ e.status }}</span>
              </span>
              <AvatarDot :who="e.who" />
            </li>
          </ul>
          <div><AppLink :to="ROUTES.CARE_LOG">Open the care log</AppLink></div>
        </section>
      </div>

      <aside class="nt-col">
        <section class="nt-card" aria-labelledby="handover">
          <h2 id="handover" class="nt-heading nt-heading--sm">Handover</h2>
          <p class="mb-0 side-strong">You handed over to {{ SAMPLE.partner }} at 5:50 PM</p>
          <p class="nt-small nt-muted mb-0">She tapped Got it at 5:54 PM. Your note: baby was fussy after the 3 PM feed.</p>
          <div><AppLink :to="ROUTES.HANDOVER">View or start a handover</AppLink></div>
        </section>

        <section class="nt-card" aria-labelledby="coming">
          <h2 id="coming" class="nt-heading nt-heading--sm">Coming up</h2>
          <div v-for="ev in COMING_UP" :key="ev.title" class="event">
            <div class="event__date">
              <span>{{ ev.dow }}</span>
              <strong>{{ ev.day }}</strong>
            </div>
            <div class="event__text">
              <span class="side-strong">{{ ev.title }}</span>
              <span class="nt-small nt-muted">{{ ev.detail }}</span>
              <a
                v-if="ev.calendar"
                class="nt-link nt-small"
                :href="calendarUrl(ev.calendar)"
                target="_blank"
                rel="noopener noreferrer"
              >Add to Google Calendar</a>
            </div>
          </div>
        </section>

        <YoursAlone>
          <h2 class="nt-heading nt-heading--sm">How are you doing today?</h2>
          <p class="nt-small mb-0">A minute. {{ SAMPLE.partner }} cannot see it.</p>
          <div><AppButton variant="outline" :to="ROUTES.CHECK_IN">Start your check-in</AppButton></div>
        </YoursAlone>

        <RouterLink :to="ROUTES.RETURN_TO_WORK" class="nt-card rtw">
          <h2 class="nt-heading nt-heading--sm">Return to work</h2>
          <span class="side-strong">{{ RETURN_TO_WORK.done }} of {{ RETURN_TO_WORK.total }} tasks done</span>
          <ProgressBar :value="rtwPercent" />
          <span class="nt-small nt-muted">{{ RETURN_TO_WORK.daysToGo }} days to go</span>
        </RouterLink>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.home-h26 {
  font-size: 1.625rem;
}
.btn-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.btn-row--wide {
  gap: 12px 20px;
}
.next-lead {
  font-size: 1.125rem;
  font-weight: 500;
  line-height: 1.45;
}
.side-strong {
  font-size: 0.9375rem;
  font-weight: 500;
}
.since {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.since__row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.since__time {
  flex: none;
  width: 64px;
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.since__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.since__text {
  font-size: 0.9375rem;
  font-weight: 500;
}
.since__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.since__sq {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--nt-coral);
}
.event {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.event__date {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  padding: 6px 10px;
  background: var(--nt-gray);
  border-radius: 8px;
  line-height: 1.3;
}
.event__date span {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--nt-muted);
}
.event__date strong {
  font-size: 1.125rem;
  font-weight: 600;
}
.event__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.rtw {
  color: inherit;
  text-decoration: none;
}
.rtw:hover {
  border-color: var(--nt-muted);
}
.rtw:focus-visible {
  outline: 2px solid var(--nt-plum);
  outline-offset: 2px;
}
</style>
