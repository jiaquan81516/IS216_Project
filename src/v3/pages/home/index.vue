<script setup>
import "@/v3/v3.css";
import { computed, inject, onBeforeUnmount, ref } from "vue";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppLink from "@/components/ui/AppLink.vue";
import YoursAlone from "@/components/ui/YoursAlone.vue";
import V3Icon from "@/v3/components/V3Icon.vue";
import { describeEntriesError, formatTime, lastFeedHeading, lastOfType, summariseEntry } from "@/v3/api/entryHelpers";
import { babySentence, displayName, useV3Home, V3_HOME_KEY } from "@/v3/composables/useV3Home";
import { useV3Entries, V3_ENTRIES_KEY } from "@/v3/composables/useV3Entries";
import { useV3Handovers, V3_HANDOVERS_KEY } from "@/v3/composables/useV3Handovers";
import { formatWindow, summaryLine } from "@/v3/api/handoverHelpers";
import { V3_ROUTES } from "@/v3/routes";

defineOptions({ name: "V3HomePage" });

// The layout loads the household and the entries once and provides them. Fall back to
// loading here so the page also works when rendered on its own.
const home = inject(V3_HOME_KEY, null) ?? useV3Home();
const { loading, error, reload, me, partner, baby, inviteCode, householdId } = home;
const shared = inject(V3_ENTRIES_KEY, null) ?? useV3Entries(householdId);
const myUid = computed(() => me.value.uid);
const handoversShared = inject(V3_HANDOVERS_KEY, null) ?? useV3Handovers(householdId, myUid);

const now = new Date();
const greeting = now.getHours() < 12 ? "Morning" : now.getHours() < 18 ? "Afternoon" : "Evening";
const dateText = (() => {
  const weekday = now.toLocaleDateString("en-GB", { weekday: "long" });
  const month = now.toLocaleDateString("en-GB", { month: "long" });
  return `${weekday}, ${now.getDate()} ${month}`;
})();

const subtitle = computed(() => {
  const sentence = babySentence(baby.value);
  return sentence ? `${dateText} · ${sentence}` : dateText;
});
const myName = computed(() => displayName(me.value.firstName));
const partnerFirst = computed(() => (partner.value ? displayName(partner.value.firstName) : ""));
const partnerLabel = computed(() => partnerFirst.value || "your partner");
const showInvite = computed(() => !partner.value && Boolean(inviteCode.value));

// Real entries only.
const entries = computed(() => shared.entries.value);
const entriesLoading = computed(() => !householdId.value || shared.loading.value);
const entriesErrorInfo = computed(() => (shared.error.value ? describeEntriesError(shared.error.value.code) : null));
const isMine = (entry) => entry.by === me.value.uid;
const hasSeen = (entry) => Object.prototype.hasOwnProperty.call(entry.seenBy ?? {}, me.value.uid);
function byLabel(entry) {
  if (isMine(entry)) return "you";
  return displayName(entry.byName) || partnerFirst.value || "your partner";
}
function lineOf(entry) {
  const s = summariseEntry(entry);
  return [s.detail, s.note].filter(Boolean).join(", ");
}

const lastFeed = computed(() => lastOfType(entries.value, "feed"));
const feedTitle = computed(() => lastFeedHeading(lastFeed.value, now));
const feedLine = computed(() => (lastFeed.value ? `${lineOf(lastFeed.value) || "Feed"} by ${byLabel(lastFeed.value)}.` : ""));
const recent = computed(() =>
  entries.value.slice(0, 5).map((entry) => {
    const s = summariseEntry(entry);
    return {
      id: entry.id,
      time: formatTime(entry.at),
      title: s.title,
      detail: `${lineOf(entry) || s.title} by ${byLabel(entry)}`,
      isNew: !isMine(entry) && !hasSeen(entry),
    };
  }),
);

// A handover waiting for me is one quiet line, not a second solid button.
const waitingHandover = computed(() => handoversShared.waitingForMe.value);
const waitingLine = computed(() => {
  const handover = waitingHandover.value;
  if (!handover) return "";
  const who = handover.from === me.value.uid ? myName.value : partnerFirst.value || "Your partner";
  const when = formatTime(handover.sentAt);
  const covers = formatWindow(handover.periodStart, handover.sentAt);
  return `${who} handed over at ${when}. ${covers}. ${summaryLine(handover.summary)}.`;
});

// "Since the last handover" once there is one, so the section says which window it shows.
const hasHandover = computed(() => Boolean(handoversShared.latest.value));
const recentHeading = computed(() => (hasHandover.value ? "Since the last handover" : "Recent activity"));

const copied = ref(false);
let copiedTimer = null;
async function copyCode() {
  try {
    await navigator.clipboard.writeText(inviteCode.value);
    copied.value = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Clipboard can be blocked; the code stays visible to copy by hand.
  }
}
onBeforeUnmount(() => clearTimeout(copiedTimer));
</script>

<template>
  <div class="hp">
    <div aria-live="polite">
      <p v-if="loading" class="hp__status">Loading your household...</p>
    </div>

    <div v-if="!loading && error" class="hp__error alert alert-danger" role="alert">
      <p class="mb-0">{{ error }}</p>
      <AppButton variant="outline" size="sm" @click="reload">Try again</AppButton>
    </div>

    <template v-if="!loading && !error">
      <div v-if="showInvite" class="hp__invite" role="status">
        <p class="hp__invite-text">
          Invite your partner with code <strong>{{ inviteCode }}</strong>
        </p>
        <AppButton variant="outline" size="sm" @click="copyCode">{{ copied ? "Copied" : "Copy code" }}</AppButton>
      </div>

      <section v-if="waitingLine" class="hp__handover" aria-labelledby="hp-handover">
        <p id="hp-handover" class="hp__handover-text">{{ waitingLine }}</p>
        <AppLink class="hp__link" :to="V3_ROUTES.HANDOVER">
          <span>Read the handover</span>
          <V3Icon name="chevron" :size="16" />
        </AppLink>
      </section>

      <header class="hp__head">
        <h1 class="nt-title hp__title">Good {{ greeting.toLowerCase() }}, {{ myName }}</h1>
        <p class="hp__sub">{{ subtitle }}</p>
      </header>

      <div class="hp__cols">
        <div class="hp__main">
          <section class="nt-card hp__next" aria-labelledby="hp-next">
            <template v-if="entriesLoading">
              <h2 id="hp-next" class="hp__next-title">Loading your log...</h2>
            </template>
            <template v-else-if="lastFeed">
              <h2 id="hp-next" class="hp__next-title">{{ feedTitle }}</h2>
              <p class="hp__lead">{{ feedLine }}</p>
              <div class="hp__actions">
                <AppButton size="md" :to="{ path: V3_ROUTES.CARE_LOG, query: { log: 'feed' } }">Log a feed</AppButton>
                <AppButton variant="outline" size="md" :to="V3_ROUTES.CARE_LOG">Open care log</AppButton>
              </div>
            </template>
            <template v-else>
              <h2 id="hp-next" class="hp__next-title">Log your first care entry</h2>
              <p class="hp__lead">Feeds, naps and nappies you log show up here for both of you.</p>
              <div class="hp__actions">
                <AppButton size="md" :to="V3_ROUTES.CARE_LOG">Log care</AppButton>
              </div>
            </template>
          </section>

          <section aria-labelledby="hp-recent" class="hp__since">
            <div class="hp__title-row">
              <h2 id="hp-recent" class="nt-heading">{{ recentHeading }}</h2>
              <AppLink class="hp__link" :to="V3_ROUTES.CARE_LOG">
                <span>View full log</span>
                <V3Icon name="chevron" :size="16" />
              </AppLink>
            </div>
            <p class="hp__muted">Latest from you and {{ partnerLabel }}</p>
            <p v-if="entriesLoading" class="hp__muted">Loading...</p>
            <div v-else-if="entriesErrorInfo" role="alert">
              <p class="hp__muted">{{ entriesErrorInfo.text }}</p>
              <p v-if="entriesErrorInfo.detail" class="hp__muted">{{ entriesErrorInfo.detail }}</p>
            </div>
            <p v-else-if="!recent.length" class="hp__muted">Nothing logged yet.</p>
            <ul v-else class="hp__rows">
              <li v-for="row in recent" :key="row.id" class="hp__row">
                <span class="hp__time">{{ row.time }}</span>
                <div class="hp__row-body">
                  <div class="hp__row-head">
                    <p class="hp__row-title">{{ row.title }}</p>
                    <AppBadge v-if="row.isNew" color="blue">New</AppBadge>
                  </div>
                  <p class="hp__row-detail">{{ row.detail }}</p>
                </div>
              </li>
            </ul>
          </section>
        </div>

        <aside class="hp__aside" aria-label="Check-in">
          <YoursAlone aria-labelledby="hp-checkin">
            <h2 id="hp-checkin" class="nt-heading nt-heading--sm">How are you holding up?</h2>
            <p class="hp__checkin-text">A one minute check-in. Only you can see it.</p>
            <AppButton variant="outline" size="md" block :to="V3_ROUTES.WELLNESS">Check in privately</AppButton>
          </YoursAlone>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hp { display: flex; flex-direction: column; gap: 24px; max-width: 1120px; margin: 0 auto; font-size: 1rem; }
.hp__status { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.hp__error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin: 0; font-size: 0.875rem; border-radius: 8px; }

.hp__invite { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 8px 16px; background: var(--nt-gray); border: 1px solid var(--nt-line); border-radius: 8px; }
.hp__invite-text { margin: 0; font-size: 0.875rem; color: var(--nt-ink); }
.hp__invite-text strong { font-weight: 600; }

.hp__handover { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 12px 16px; background: var(--nt-gray); border: 1px solid var(--nt-line); border-radius: 8px; }
.hp__handover-text { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); }

.hp__head { display: flex; flex-direction: column; gap: 8px; }
.hp__title { font-size: 2.5rem; line-height: 1.2; }
.hp__sub { margin: 0; font-size: 1rem; color: var(--nt-muted); }

.hp__cols { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 32px; align-items: start; }
.hp__main { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.hp__aside { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

.hp__next { gap: 8px; padding: 24px; }
.hp__next-title { margin: 0; font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 400; line-height: 1.3; letter-spacing: -0.01em; color: var(--nt-ink); }
.hp__lead { margin: 0; font-size: 1rem; line-height: 1.5; color: var(--nt-muted); }
.hp__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }

.hp__since { display: flex; flex-direction: column; gap: 8px; }
.hp__title-row { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 16px; }
.hp__muted { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }

.hp__link, .hp__link:visited { display: inline-flex; align-items: center; gap: 4px; font-size: 0.875rem; font-weight: 500; color: var(--nt-plum); text-decoration: none; }
.hp__link:hover { color: var(--nt-plum-hover); text-decoration: underline; text-underline-offset: 3px; }
.hp__link:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }

.hp__rows { margin: 8px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.hp__row { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 16px; align-items: start; padding: 16px 0; border-bottom: 1px solid var(--nt-line); }
.hp__time { font-size: 0.875rem; line-height: 1.5rem; color: var(--nt-muted); }
.hp__row-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.hp__row-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.hp__row-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }
.hp__row-detail { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }

.hp__checkin-text { margin: 0 0 8px; font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); }

@media (max-width: 991px) {
  .hp__cols { grid-template-columns: minmax(0, 1fr); }
  .hp__title { font-size: 2rem; }
}
@media (max-width: 575px) {
  .hp__row { grid-template-columns: minmax(0, 1fr); gap: 4px; }
}
</style>
