<script setup>
import "@/app/app.css";
import { computed, inject, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "@/app/components/Icon.vue";
import { acceptHandover, ATTENTION_MAX, NEXT_UP_MAX, NOTE_MAX, sendHandover } from "@/app/api/handovers";
import { formatTime } from "@/app/api/entryHelpers";
import { describeSharedError } from "@/app/api/sharedHelpers";
import {
  formatWindow,
  handoverStatus,
  periodStartFrom,
  suggestedNextUp,
  summariseWindow,
  summaryBlocks,
  summaryLine,
} from "@/app/api/handoverHelpers";
import { displayName, useHome, HOME_KEY } from "@/app/composables/useHome";
import { useEntries, ENTRIES_KEY } from "@/app/composables/useEntries";
import { useHandovers, HANDOVERS_KEY } from "@/app/composables/useHandovers";
import { SHARED_KEY } from "@/app/composables/useShared";

defineOptions({ name: "HandoverPage" });

const HISTORY_MAX = 10;

const home = inject(HOME_KEY, null) ?? useHome();
const { loading, error, reload, me, partner, householdId } = home;
const entriesShared = inject(ENTRIES_KEY, null) ?? useEntries(householdId);
const myUid = computed(() => me.value.uid);
const shared = inject(HANDOVERS_KEY, null) ?? useHandovers(householdId, myUid);
const sharedStores = inject(SHARED_KEY, null);

const now = ref(new Date());

const myName = computed(() => displayName(me.value.firstName));
const partnerFirst = computed(() => (partner.value ? displayName(partner.value.firstName) : ""));
const partnerLabel = computed(() => partnerFirst.value || "your partner");
const partnerUid = computed(() => partner.value?.uid ?? "");
const hasPartner = computed(() => Boolean(partnerUid.value));

function nameOf(uid) {
  if (!uid) return "Your partner";
  if (uid === myUid.value) return myName.value || "You";
  if (partnerUid.value && uid === partnerUid.value) return partnerFirst.value || "Your partner";
  return "Your partner";
}

const listLoading = computed(() => !householdId.value || shared.loading.value);
const listErrorInfo = computed(() =>
  shared.error.value ? describeSharedError(shared.error.value.code, "handovers") : null,
);
const handovers = computed(() => shared.handovers.value);
const entries = computed(() => entriesShared.entries.value);
const incoming = computed(() => shared.waitingForMe.value);
const latest = computed(() => shared.latest.value);

// The window the send form covers: from the last handover, or the start of today.
const periodStart = computed(() => periodStartFrom(latest.value, now.value));
const sinceLine = computed(() => `Since ${formatTime(periodStart.value)}`);
const liveSummary = computed(() => summariseWindow(entries.value, periodStart.value, now.value));
const liveBlocks = computed(() => summaryBlocks(liveSummary.value));

const rotaView = computed(() => sharedStores?.rota?.view ?? null);
const suggestions = computed(() =>
  suggestedNextUp(entries.value, rotaView.value, now.value, {
    me: myName.value,
    partner: partnerFirst.value,
  }).filter((text) => !nextUp.value.includes(text)),
);

// The received handover
const received = computed(() => {
  const handover = incoming.value;
  if (!handover) return null;
  return {
    id: handover.id,
    heading: `${nameOf(handover.from)} handed over at ${formatTime(handover.sentAt)}`,
    window: formatWindow(handover.periodStart, handover.sentAt),
    blocks: summaryBlocks(handover.summary),
    note: handover.note ?? "",
    needsAttention: Boolean(handover.needsAttention),
    attentionNote: handover.attentionNote ?? "",
    nextUp: handover.nextUp ?? [],
  };
});

const history = computed(() =>
  handovers.value
    .filter((handover) => handover.id !== incoming.value?.id)
    .slice(0, HISTORY_MAX)
    .map((handover) => ({
      id: handover.id,
      time: formatTime(handover.sentAt),
      who: `${nameOf(handover.from)} to ${nameOf(handover.to)}`,
      status: handoverStatus(handover, myUid.value, nameOf(handover.to)),
      summary: summaryLine(handover.summary),
      note: handover.note ?? "",
    })),
);

const openRow = ref("");
function toggleRow(id) {
  openRow.value = openRow.value === id ? "" : id;
}

// Accepting
const accepting = ref(false);
const acceptError = ref("");
const acceptedText = ref("");
async function accept() {
  const handover = received.value;
  if (!handover || accepting.value || !householdId.value) return;
  accepting.value = true;
  acceptError.value = "";
  try {
    await acceptHandover(householdId.value, handover.id, myUid.value);
    acceptedText.value = "Handover accepted.";
  } catch (cause) {
    console.error("[app handover]", cause?.code, cause);
    acceptError.value = "We could not accept the handover. Check your connection and try again.";
  } finally {
    accepting.value = false;
  }
}

// The send form
const note = ref("");
const needsAttention = ref(false);
const attentionNote = ref("");
const nextUp = ref([]);
const draft = ref("");
const sending = ref(false);
const sendError = ref("");
const sentText = ref("");

const noteLeft = computed(() => NOTE_MAX - note.value.length);
const nextUpFull = computed(() => nextUp.value.length >= NEXT_UP_MAX);

function addNextUp(text) {
  const value = String(text ?? "").trim();
  if (!value || nextUpFull.value || nextUp.value.includes(value)) return;
  nextUp.value = [...nextUp.value, value.slice(0, 80)];
}
function addDraft() {
  addNextUp(draft.value);
  draft.value = "";
}
function removeNextUp(text) {
  nextUp.value = nextUp.value.filter((item) => item !== text);
}

async function send() {
  if (sending.value || !hasPartner.value || !householdId.value) return;
  sending.value = true;
  sendError.value = "";
  try {
    await sendHandover({ uid: myUid.value }, householdId.value, {
      to: partnerUid.value,
      note: note.value.trim(),
      needsAttention: needsAttention.value,
      attentionNote: attentionNote.value.trim(),
      nextUp: nextUp.value,
      periodStart: periodStart.value,
      summary: liveSummary.value,
    });
    note.value = "";
    needsAttention.value = false;
    attentionNote.value = "";
    nextUp.value = [];
    draft.value = "";
    sentText.value = `Handover sent to ${partnerLabel.value}.`;
    now.value = new Date();
  } catch (cause) {
    console.error("[app handover]", cause?.code, cause);
    sendError.value = "We could not send the handover. Check your connection and try again.";
  } finally {
    sending.value = false;
  }
}

function retry() {
  shared.retry();
}

// The live summary counts a sleep that is still going, so the clock ticks once a minute.
let clockTimer = null;
onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 60000);
});
onBeforeUnmount(() => clearInterval(clockTimer));
</script>

<template>
  <div class="ho">
    <div aria-live="polite">
      <p v-if="loading" class="ho__status">Loading the handover...</p>
    </div>

    <div v-if="!loading && error" class="ho__error alert alert-danger" role="alert">
      <p class="mb-0">{{ error }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="reload">Try again</button>
    </div>

    <template v-if="!loading && !error">
      <header class="ho__head">
        <h1 class="nt-title ho__title">Handover</h1>
        <p class="ho__sub">Hand the shift over with everything that matters.</p>
      </header>

      <div aria-live="polite">
        <p v-if="listLoading" class="ho__status">Loading the handover...</p>
        <p v-if="acceptedText" class="ho__status">{{ acceptedText }}</p>
        <p v-if="sentText" class="ho__status">{{ sentText }}</p>
      </div>

      <div v-if="!listLoading && listErrorInfo" class="ho__error alert alert-danger" role="alert">
        <div>
          <p class="mb-0">{{ listErrorInfo.text }}</p>
          <p v-if="listErrorInfo.detail" class="ho__muted">{{ listErrorInfo.detail }}</p>
        </div>
        <button type="button" class="btn btn-outline btn-sm" @click="retry">Try again</button>
      </div>

      <template v-if="!listLoading && !listErrorInfo">
        <!-- Waiting for me: read it, then accept it. -->
        <section v-if="received" class="ho__panel" aria-labelledby="ho-received">
          <h2 id="ho-received" class="ho__panel-title">{{ received.heading }}</h2>
          <p class="ho__muted">{{ received.window }}</p>

          <ul class="ho__stats" aria-label="What happened this shift">
            <li v-for="block in received.blocks" :key="block.key">
              <span class="ho__stat-value">{{ block.value }}</span>
              <span class="ho__stat-label">{{ block.label }}</span>
            </li>
          </ul>

          <p v-if="received.note" class="ho__note">{{ received.note }}</p>
          <p v-else class="ho__muted">No note was left.</p>

          <p v-if="received.needsAttention" class="ho__attention">
            <span class="ho__attention-label">Needs attention</span>
            <span>{{ received.attentionNote || "Read this before you take over." }}</span>
          </p>

          <template v-if="received.nextUp.length">
            <h3 class="ho__sub-title">What is coming up</h3>
            <ul class="ho__list">
              <li v-for="item in received.nextUp" :key="item">{{ item }}</li>
            </ul>
          </template>

          <p v-if="acceptError" class="ho__row-error" role="alert">{{ acceptError }}</p>
          <div class="ho__actions">
            <button type="button" class="btn btn-primary" :disabled="accepting" @click="accept">
              {{ accepting ? "Accepting..." : "Accept handover" }}
            </button>
          </div>
        </section>

        <!-- Nothing waiting for me: send the shift on. -->
        <section v-else class="ho__panel" aria-labelledby="ho-send">
          <h2 id="ho-send" class="ho__panel-title">{{ sinceLine }}</h2>
          <p class="ho__muted">
            {{ latest ? `Everything logged since ${partnerLabel} last handed over.` : "Everything logged since midnight." }}
          </p>

          <ul class="ho__stats" aria-label="This shift so far">
            <li v-for="block in liveBlocks" :key="block.key">
              <span class="ho__stat-value">{{ block.value }}</span>
              <span class="ho__stat-label">{{ block.label }}</span>
            </li>
          </ul>

          <div class="ho__field">
            <label class="ho__label" for="ho-note">What should {{ partnerLabel }} know?</label>
            <textarea
              id="ho-note"
              v-model="note"
              class="app-control ho__textarea"
              rows="4"
              :maxlength="NOTE_MAX"
              placeholder="Fussy after the 3 PM feed, settled by 4."
            ></textarea>
            <p class="ho__muted">{{ noteLeft }} characters left</p>
          </div>

          <div class="ho__check">
            <input id="ho-attention" v-model="needsAttention" type="checkbox" class="ho__checkbox" />
            <label class="ho__label" for="ho-attention">Needs attention</label>
          </div>
          <div v-if="needsAttention" class="ho__field">
            <label class="ho__label" for="ho-attention-note">What needs attention?</label>
            <input
              id="ho-attention-note"
              v-model="attentionNote"
              type="text"
              class="app-control"
              :maxlength="ATTENTION_MAX"
              placeholder="Nappy rash, cream used at 2 PM"
            />
          </div>

          <div class="ho__field">
            <h3 class="ho__sub-title">What is coming up</h3>
            <p class="ho__muted">Up to three short things. {{ nextUp.length }} of {{ NEXT_UP_MAX }} added.</p>
            <ul v-if="nextUp.length" class="ho__chips">
              <li v-for="item in nextUp" :key="item" class="ho__chip">
                <span>{{ item }}</span>
                <button
                  type="button"
                  class="ho__chip-remove"
                  :aria-label="`Remove ${item}`"
                  @click="removeNextUp(item)"
                >
                  <Icon name="x" :size="16" />
                </button>
              </li>
            </ul>
            <div v-if="suggestions.length && !nextUpFull" class="ho__suggest">
              <p class="ho__muted">From the care log and the rota</p>
              <ul class="ho__suggest-list">
                <li v-for="text in suggestions" :key="text" class="ho__suggest-row">
                  <span class="ho__suggest-text">{{ text }}</span>
                  <button type="button" class="btn btn-outline btn-sm" @click="addNextUp(text)">Add</button>
                </li>
              </ul>
            </div>
            <form v-if="!nextUpFull" class="ho__add" @submit.prevent="addDraft">
              <label class="visually-hidden" for="ho-next">Add something that is coming up</label>
              <input
                id="ho-next"
                v-model="draft"
                type="text"
                class="app-control"
                maxlength="80"
                placeholder="Bath at 7:30 PM"
              />
              <button type="submit" class="btn btn-outline" :disabled="!draft.trim()">Add</button>
            </form>
          </div>

          <p v-if="!hasPartner" class="ho__muted ho__no-partner">
            There is nobody to hand over to yet. Invite your partner from Today, then send the first handover.
          </p>
          <p v-if="sendError" class="ho__row-error" role="alert">{{ sendError }}</p>
          <div class="ho__actions">
            <button type="button" class="btn btn-primary" :disabled="sending || !hasPartner" @click="send">
              {{ sending ? "Sending..." : `Send handover to ${partnerLabel}` }}
            </button>
          </div>
        </section>

        <!-- History -->
        <section class="ho__history" aria-labelledby="ho-history">
          <h2 id="ho-history" class="nt-heading">Earlier handovers</h2>
          <p v-if="!history.length" class="ho__muted ho__none">No handovers yet. The first one you send shows up here.</p>
          <ul v-else class="ho__rows">
            <li v-for="row in history" :key="row.id" class="ho__row">
              <div class="ho__row-head">
                <span class="ho__row-time">{{ row.time }}</span>
                <div class="ho__row-body">
                  <p class="ho__row-who">{{ row.who }}</p>
                  <p class="ho__row-meta">{{ row.status }}. {{ row.summary }}</p>
                </div>
                <button
                  v-if="row.note"
                  type="button"
                  class="app-textbtn ho__row-toggle"
                  :aria-expanded="openRow === row.id ? 'true' : 'false'"
                  :aria-controls="`ho-note-${row.id}`"
                  @click="toggleRow(row.id)"
                >
                  {{ openRow === row.id ? "Hide note" : "Show note" }}
                </button>
              </div>
              <p v-if="row.note && openRow === row.id" :id="`ho-note-${row.id}`" class="ho__row-note">{{ row.note }}</p>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.ho { display: flex; flex-direction: column; gap: 24px; max-width: 1120px; margin: 0 auto; font-size: 1rem; }
.ho__status { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.ho__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.ho__error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin: 0; font-size: 0.875rem; border-radius: 8px; }

.ho__head { display: flex; flex-direction: column; gap: 8px; }
.ho__title { font-size: 2.5rem; line-height: 1.2; }
.ho__sub { margin: 0; font-size: 1rem; color: var(--nt-muted); }

.ho__panel { display: flex; flex-direction: column; gap: 12px; max-width: 680px; padding: 24px 0; border-top: 1px solid var(--nt-line); border-bottom: 1px solid var(--nt-line); }
.ho__panel-title { margin: 0; font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 400; line-height: 1.3; letter-spacing: -0.01em; color: var(--nt-ink); }
.ho__sub-title { margin: 0; font-family: var(--nt-serif); font-size: 1.125rem; font-weight: 400; line-height: 1.3; color: var(--nt-ink); }

.ho__stats { display: flex; flex-wrap: wrap; margin: 4px 0; padding: 0; list-style: none; }
.ho__stats li { display: flex; flex-direction: column; gap: 2px; min-width: 96px; padding: 0 20px; border-left: 1px solid var(--nt-line); }
.ho__stats li:first-child { padding-left: 0; border-left: 0; }
.ho__stat-value { font-size: 1.125rem; font-weight: 600; line-height: 1.3; color: var(--nt-ink); }
.ho__stat-label { font-size: 0.875rem; line-height: 1.3; color: var(--nt-muted); }

.ho__note { margin: 0; font-size: 1rem; line-height: 1.5; color: var(--nt-ink); overflow-wrap: anywhere; }
.ho__attention { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin: 0; padding: 12px; border: 1px solid var(--nt-coral); border-radius: 8px; font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); }
.ho__attention-label { font-weight: 600; color: var(--nt-coral); }

.ho__list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.ho__list li { padding: 8px 0; border-bottom: 1px solid var(--nt-line); font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); }

.ho__field { display: flex; flex-direction: column; gap: 8px; }
.ho__label { font-size: 0.875rem; font-weight: 500; color: var(--nt-ink); }
.ho__textarea { resize: vertical; }
.ho__check { display: flex; align-items: center; gap: 8px; }
.ho__checkbox { width: 18px; height: 18px; accent-color: var(--nt-plum); }
.ho__checkbox:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.ho__chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.ho__chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 4px 4px 12px; background: var(--nt-gray); border: 1px solid var(--nt-line); border-radius: 999px; font-size: 0.875rem; line-height: 20px; color: var(--nt-ink); }
.ho__chip-remove { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: none; border: 0; border-radius: 999px; color: var(--nt-muted); cursor: pointer; }
.ho__chip-remove:hover { color: var(--nt-coral); }
.ho__chip-remove:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.ho__suggest { display: flex; flex-direction: column; gap: 4px; }
.ho__suggest-list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.ho__suggest-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 8px 0; border-bottom: 1px solid var(--nt-line); }
.ho__suggest-text { font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); }
.ho__add { display: flex; gap: 8px; }
.ho__no-partner { max-width: 48ch; }

.ho__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.ho__row-error { margin: 0; font-size: 0.875rem; color: var(--nt-coral); }

.ho__history { display: flex; flex-direction: column; gap: 8px; }
.ho__none { padding: 16px 0; border-top: 1px solid var(--nt-line); }
.ho__rows { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--nt-line); }
.ho__row { padding: 12px 0; border-bottom: 1px solid var(--nt-line); }
.ho__row-head { display: grid; grid-template-columns: 72px minmax(0, 1fr) auto; gap: 16px; align-items: start; }
.ho__row-time { font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.ho__row-body { min-width: 0; }
.ho__row-who { margin: 0; font-size: 0.875rem; font-weight: 600; line-height: 1.45; color: var(--nt-ink); }
.ho__row-meta { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.ho__row-note { margin: 8px 0 0 88px; font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); overflow-wrap: anywhere; }
.ho__row-toggle { white-space: nowrap; }

@media (max-width: 991px) {
  .ho__title { font-size: 2rem; }
}
@media (max-width: 575px) {
  .ho__stats li { padding: 8px 0; border-left: 0; }
  .ho__row-head { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .ho__row-note { margin-left: 0; }
}
</style>
