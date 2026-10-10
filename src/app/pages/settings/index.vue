<script setup>
import "@/app/app.css";
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import ChipGroup from "@/app/components/ChipGroup.vue";
import ConfirmDanger from "@/app/components/ConfirmDanger.vue";
import Toggle from "@/app/components/Toggle.vue";
import {
  deleteAccountFallback,
  leaveHousehold,
  saveHouseholdBaby,
  saveSettingsPatch,
} from "@/app/api/account";
import { expiresInText, inviteState } from "@/app/api/inviteHelpers";
import { takeLimit } from "@/app/api/limits";
import { getInvite, regenerateInviteCode } from "@/app/api/profile";
import {
  debounce,
  normaliseSettings,
  settingsPatch,
  TIME_FORMATS,
  WEEK_STARTS,
} from "@/app/api/settingsHelpers";
import {
  deleteAccount,
  describeServerError,
  describeSyncResult,
  disconnectGoogle,
  startGoogleConnect,
  syncGoogleCalendar,
} from "@/app/api/server";
import { displayName, useHome, HOME_KEY } from "@/app/composables/useHome";
import { setDisplay } from "@/app/composables/usePrefs";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "SettingsPage" });

const router = useRouter();
const route = useRoute();
const home = inject(HOME_KEY, null) ?? useHome();
const { loading, error, reload, me, partner, profile, household, householdId, inviteCode } = home;

// Settings. One local copy, saved field by field with a debounce.
const form = ref(normaliseSettings(null));
const savedAt = ref("");
const saveError = ref("");
const pending = {};

watch(
  () => profile?.value,
  (value) => {
    if (value) form.value = normaliseSettings(value.settings);
  },
  { immediate: true },
);

function nested(path) {
  const parts = path.split(".");
  let node = form.value;
  for (let i = 0; i < parts.length - 1; i += 1) node = node[parts[i]];
  return [node, parts[parts.length - 1]];
}

async function writePending() {
  const patch = { ...pending };
  for (const key of Object.keys(pending)) delete pending[key];
  if (!Object.keys(patch).length) return;
  saveError.value = "";
  try {
    await saveSettingsPatch(me.value.uid, patch);
    savedAt.value = "Saved";
  } catch (cause) {
    console.error("[app settings]", cause?.code, cause);
    savedAt.value = "";
    saveError.value =
      cause?.code === "permission-denied"
        ? "Your database rules do not allow saving settings yet. Publish the latest firestore.rules, then try again."
        : "We could not save that. Check your connection and try again.";
  }
}

const flush = debounce(writePending, 600);

// Every control calls this. The screen updates at once, the write waits 600 ms, so dragging
// a time input does not make one write per keystroke.
function set(path, value) {
  const [node, key] = nested(path);
  node[key] = value;
  Object.assign(pending, settingsPatch(path, value));
  savedAt.value = "";
  if (path.startsWith("display.")) setDisplay(form.value.display);
  flush();
}

onBeforeUnmount(() => flush.flush());

const timeFormatOptions = TIME_FORMATS.map((value) => ({ value, label: value === "12h" ? "12 hour" : "24 hour" }));
const weekStartOptions = WEEK_STARTS.map((value) => ({ value, label: value === "mon" ? "Monday" : "Sunday" }));

// Calendar connection
const calendarNote = ref("");
const calendarAlert = ref(false); // an alert when something went wrong, a status otherwise
const calendarBusy = ref(false);
const syncBusy = ref(false);
const syncNote = ref("");

// The Google callback sends the browser back to /settings?calendar=connected, error or
// denied. Say what happened in one line, then take the flag out of the address so a refresh
// does not say it again.
const CALENDAR_RETURNS = {
  connected: { text: "Google Calendar is connected.", alert: false },
  error: { text: "We could not connect Google Calendar. Try again, or check docs/setup.md.", alert: true },
  denied: { text: "Google Calendar was not connected, because access was not granted.", alert: true },
};

onMounted(() => {
  const flag = route.query?.calendar;
  const outcome = CALENDAR_RETURNS[Array.isArray(flag) ? flag[0] : flag];
  if (!outcome) return;
  calendarNote.value = outcome.text;
  calendarAlert.value = outcome.alert;
  const query = { ...route.query };
  delete query.calendar;
  router.replace({ path: route.path, query });
});

async function connectCalendar() {
  calendarNote.value = "";
  calendarAlert.value = false;
  calendarBusy.value = true;
  try {
    await startGoogleConnect();
  } catch (cause) {
    calendarNote.value = describeServerError(cause, "calendar");
    calendarAlert.value = true;
  } finally {
    calendarBusy.value = false;
  }
}

async function disconnectCalendar() {
  calendarNote.value = "";
  calendarAlert.value = false;
  calendarBusy.value = true;
  try {
    await disconnectGoogle();
    set("calendar.connected", false);
    calendarNote.value = "Google Calendar is disconnected.";
  } catch (cause) {
    calendarNote.value = describeServerError(cause, "calendar");
    calendarAlert.value = true;
  } finally {
    calendarBusy.value = false;
  }
}

async function syncNow() {
  if (!householdId.value) return;
  syncNote.value = "";
  syncBusy.value = true;
  try {
    syncNote.value = describeSyncResult(await syncGoogleCalendar(householdId.value));
  } catch (cause) {
    console.error("[app settings sync]", cause?.code, cause);
    syncNote.value = describeServerError(cause, "calendar");
  } finally {
    syncBusy.value = false;
  }
}

// Partner and the invitation code
const invite = ref(null);
const inviteBusy = ref(false);
const inviteNote = ref("");
const copied = ref(false);
let copiedTimer = null;

watch(
  () => inviteCode.value,
  async (code) => {
    invite.value = null;
    if (!code) return;
    try {
      invite.value = await getInvite(code);
    } catch {
      invite.value = null;
    }
  },
  { immediate: true },
);

const inviteStatus = computed(() => inviteState(invite.value));
const inviteExpiry = computed(() => expiresInText(invite.value?.expiresAt));
const inviteNeedsNew = computed(() => Boolean(invite.value) && inviteStatus.value !== "valid");
const partnerName = computed(() => (partner.value ? displayName(partner.value.firstName) : ""));
const partnerRole = computed(() => partner.value?.role || "");

async function copyCode() {
  if (!inviteCode.value) return;
  try {
    await navigator.clipboard.writeText(inviteCode.value);
    copied.value = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied.value = false), 2000);
  } catch {
    // Clipboard can be blocked; the code stays on screen to copy by hand.
  }
}

async function newCode() {
  inviteNote.value = "";
  const gate = takeLimit("inviteRegenerate");
  if (!gate.allowed) {
    inviteNote.value = gate.message;
    return;
  }
  inviteBusy.value = true;
  try {
    await regenerateInviteCode({ uid: me.value.uid }, householdId.value, inviteCode.value || null);
    await reload();
    inviteNote.value = "New code ready. The old one no longer works.";
  } catch (cause) {
    console.error("[app settings invite]", cause?.code, cause);
    inviteNote.value = "We could not make a new code. Check your connection and try again.";
  } finally {
    inviteBusy.value = false;
  }
}

// Household baby details
const baby = ref({ babyName: "", babyStatus: "born", babyDate: "" });
const babySaved = ref("");
const babyError = ref("");

watch(
  () => household?.value,
  (value) => {
    baby.value = {
      babyName: value?.babyName ?? "",
      babyStatus: value?.babyStatus === "expected" ? "expected" : "born",
      babyDate: value?.babyDate ?? "",
    };
  },
  { immediate: true },
);

async function writeBaby() {
  babyError.value = "";
  try {
    await saveHouseholdBaby(householdId.value, baby.value);
    babySaved.value = "Saved";
  } catch (cause) {
    console.error("[app settings household]", cause?.code, cause);
    babySaved.value = "";
    babyError.value =
      cause?.code === "permission-denied"
        ? "Your database rules do not allow saving the household yet. Publish the latest firestore.rules, then try again."
        : "We could not save the household. Check your connection and try again.";
  }
}
const flushBaby = debounce(writeBaby, 600);
function setBaby(key, value) {
  baby.value[key] = value;
  babySaved.value = "";
  flushBaby();
}
onBeforeUnmount(() => flushBaby.flush());

const babyDateLabel = computed(() => (baby.value.babyStatus === "expected" ? "Due date" : "Date of birth"));
const babyStatusOptions = [
  { value: "born", label: "Baby is here" },
  { value: "expected", label: "Baby is on the way" },
];

// Leaving the household
const leaveOpen = ref(false);
const leaveBusy = ref(false);
const leaveError = ref("");

async function confirmLeave() {
  leaveError.value = "";
  leaveBusy.value = true;
  try {
    await leaveHousehold(me.value.uid, householdId.value);
    router.push(ROUTES.HOUSEHOLD);
  } catch (cause) {
    console.error("[app settings leave]", cause?.code, cause);
    leaveError.value = "We could not take you out of the household. Check your connection and try again.";
  } finally {
    leaveBusy.value = false;
  }
}

// Deleting the account
const deleteOpen = ref(false);
const deleteBusy = ref(false);
const deleteError = ref("");
const deleteKept = ref([]);
const deleteDone = ref("");

async function confirmDelete() {
  deleteError.value = "";
  deleteKept.value = [];
  const gate = takeLimit("accountDelete");
  if (!gate.allowed) {
    deleteError.value = gate.message;
    return;
  }
  deleteBusy.value = true;
  try {
    await deleteAccount();
    deleteDone.value = "Your account has been deleted.";
    router.push(ROUTES.LANDING);
  } catch (serverCause) {
    console.error("[app settings delete]", serverCause?.code, serverCause);
    // No server yet, so remove what the browser is allowed to remove and say what stayed.
    try {
      const outcome = await deleteAccountFallback({ uid: me.value.uid }, householdId.value);
      deleteKept.value = outcome.kept;
      deleteDone.value = "Your account has been deleted.";
      router.push(ROUTES.LANDING);
    } catch (cause) {
      deleteKept.value = cause?.kept ?? [];
      deleteError.value =
        cause?.code === "auth/requires-recent-login"
          ? "For your safety, sign out, sign in again, and then delete your account."
          : cause?.message || "We could not delete your account. Check your connection and try again.";
    }
  } finally {
    deleteBusy.value = false;
  }
}
</script>

<template>
  <div class="st">
    <header class="st__head">
      <h1 class="nt-title st__title">Settings</h1>
      <p class="st__sub">Changes save as you make them.</p>
    </header>

    <p v-if="loading" class="st__muted" aria-live="polite">Loading...</p>

    <div v-else-if="error" role="alert" class="st__retry">
      <p class="st__text">{{ error }}</p>
      <AppButton variant="outline" size="sm" @click="reload">Try again</AppButton>
    </div>

    <template v-else>
      <p class="st__save" role="status" aria-live="polite">{{ savedAt }}</p>
      <p v-if="saveError" class="app-error-text" role="alert">{{ saveError }}</p>

      <!-- Notifications -->
      <section class="st__section" aria-labelledby="st-notif">
        <h2 id="st-notif" class="st__h">Notifications</h2>
        <p class="st__muted">
          Push notifications need the server set up. These preferences are saved now and used
          once it is connected.
        </p>
        <div class="st__rows">
          <Toggle
            id="st-push"
            label="Push notifications"
            hint="The master switch for everything below."
            :model-value="form.notifications.push"
            @update:model-value="set('notifications.push', $event)"
          />
          <Toggle
            id="st-feeds"
            label="Feeds due"
            :disabled="!form.notifications.push"
            :model-value="form.notifications.feedsDue"
            @update:model-value="set('notifications.feedsDue', $event)"
          />
          <Toggle
            id="st-partner"
            label="What my partner logs"
            :disabled="!form.notifications.push"
            :model-value="form.notifications.partnerLogs"
            @update:model-value="set('notifications.partnerLogs', $event)"
          />
          <Toggle
            id="st-handovers"
            label="Handovers"
            :disabled="!form.notifications.push"
            :model-value="form.notifications.handovers"
            @update:model-value="set('notifications.handovers', $event)"
          />
          <Toggle
            id="st-swaps"
            label="Swap requests"
            :disabled="!form.notifications.push"
            :model-value="form.notifications.swapRequests"
            @update:model-value="set('notifications.swapRequests', $event)"
          />
          <Toggle
            id="st-checkin"
            label="Check-in reminder"
            hint="A nudge to log how you are doing."
            :model-value="form.notifications.checkInReminder.on"
            @update:model-value="set('notifications.checkInReminder.on', $event)"
          />
          <div class="st__field">
            <label class="st__label" for="st-checkin-time">Reminder time</label>
            <input
              id="st-checkin-time"
              class="app-control st__time"
              type="time"
              :value="form.notifications.checkInReminder.time"
              :disabled="!form.notifications.checkInReminder.on"
              @change="set('notifications.checkInReminder.time', $event.target.value)"
            />
          </div>
          <Toggle
            id="st-quiet"
            label="Quiet hours"
            hint="Nothing buzzes between these times."
            :model-value="form.notifications.quietHours.on"
            @update:model-value="set('notifications.quietHours.on', $event)"
          />
          <div class="st__pair">
            <div class="st__field">
              <label class="st__label" for="st-quiet-start">Quiet hours start</label>
              <input
                id="st-quiet-start"
                class="app-control st__time"
                type="time"
                :value="form.notifications.quietHours.start"
                :disabled="!form.notifications.quietHours.on"
                @change="set('notifications.quietHours.start', $event.target.value)"
              />
            </div>
            <div class="st__field">
              <label class="st__label" for="st-quiet-end">Quiet hours end</label>
              <input
                id="st-quiet-end"
                class="app-control st__time"
                type="time"
                :value="form.notifications.quietHours.end"
                :disabled="!form.notifications.quietHours.on"
                @change="set('notifications.quietHours.end', $event.target.value)"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Calendar -->
      <section class="st__section" aria-labelledby="st-cal">
        <h2 id="st-cal" class="st__h">Google Calendar</h2>
        <p v-if="form.calendar.connected" class="st__text">Connected.</p>
        <p v-else class="st__muted">Not connected. Appointments stay inside NurtureTrack.</p>
        <div class="st__actions">
          <AppButton
            v-if="!form.calendar.connected"
            variant="outline"
            size="sm"
            :disabled="calendarBusy"
            @click="connectCalendar"
          >
            Connect Google Calendar
          </AppButton>
          <template v-else>
            <AppButton variant="outline" size="sm" :disabled="syncBusy" @click="syncNow">
              {{ syncBusy ? "Syncing..." : "Sync now" }}
            </AppButton>
            <AppButton variant="outline" size="sm" :disabled="calendarBusy" @click="disconnectCalendar">
              Disconnect
            </AppButton>
          </template>
        </div>
        <p v-if="calendarNote && calendarAlert" class="app-error-text" role="alert">{{ calendarNote }}</p>
        <p v-else-if="calendarNote" class="st__text" role="status">{{ calendarNote }}</p>
        <p v-if="syncNote" class="st__muted" role="status" aria-live="polite">{{ syncNote }}</p>
        <div class="st__rows">
          <Toggle
            id="st-sync-rota"
            label="Sync the sleep rota"
            :model-value="form.calendar.syncOn.rota"
            @update:model-value="set('calendar.syncOn.rota', $event)"
          />
          <Toggle
            id="st-sync-appts"
            label="Sync appointments"
            :model-value="form.calendar.syncOn.appointments"
            @update:model-value="set('calendar.syncOn.appointments', $event)"
          />
          <Toggle
            id="st-sync-mine"
            label="Sync my reminders"
            :model-value="form.calendar.syncOn.myReminders"
            @update:model-value="set('calendar.syncOn.myReminders', $event)"
          />
        </div>
      </section>

      <!-- Display -->
      <section class="st__section" aria-labelledby="st-display">
        <h2 id="st-display" class="st__h">Display</h2>
        <div class="st__rows">
          <div class="st__field">
            <ChipGroup
              label="Time format"
              :model-value="form.display.timeFormat"
              :options="timeFormatOptions"
              @update:model-value="set('display.timeFormat', $event)"
            />
            <p class="st__muted">How times read in the care log and the handover.</p>
          </div>
          <div class="st__field">
            <ChipGroup
              label="Week starts on"
              :model-value="form.display.weekStartsOn"
              :options="weekStartOptions"
              @update:model-value="set('display.weekStartsOn', $event)"
            />
            <p class="st__muted">The first column of the calendar month.</p>
          </div>
          <Toggle
            id="st-motion"
            label="Reduce motion"
            hint="Turns off the few transitions in the app."
            :model-value="form.display.reduceMotion"
            @update:model-value="set('display.reduceMotion', $event)"
          />
        </div>
      </section>

      <!-- Privacy -->
      <section class="st__section" aria-labelledby="st-privacy">
        <h2 id="st-privacy" class="st__h">Privacy</h2>
        <Toggle
          id="st-lastseen"
          label="Show my partner when I was last active"
          hint="Your wellness check-ins stay private either way."
          :model-value="form.privacy.shareLastSeen"
          @update:model-value="set('privacy.shareLastSeen', $event)"
        />
      </section>

      <!-- Partner -->
      <section class="st__section" aria-labelledby="st-partner-h">
        <h2 id="st-partner-h" class="st__h">Partner</h2>
        <template v-if="partner">
          <p class="st__text">{{ partnerName }} shares this household.</p>
          <p v-if="partnerRole" class="st__muted">Role: {{ partnerRole }}.</p>
        </template>
        <template v-else>
          <p class="st__muted">Nobody else has joined yet. Share this code.</p>
          <p class="st__code">{{ inviteCode || "No code yet" }}</p>
          <p v-if="inviteExpiry" class="st__muted">{{ inviteExpiry }}</p>
          <p v-if="inviteNeedsNew" class="st__text">This code no longer works. Make a new one.</p>
          <div class="st__actions">
            <AppButton v-if="inviteCode" variant="outline" size="sm" @click="copyCode">
              {{ copied ? "Copied" : "Copy" }}
            </AppButton>
            <AppButton variant="outline" size="sm" :disabled="inviteBusy" @click="newCode">
              Generate a new code
            </AppButton>
          </div>
          <p v-if="inviteNote" class="st__muted" role="status">{{ inviteNote }}</p>
        </template>
      </section>

      <!-- Household -->
      <section class="st__section" aria-labelledby="st-house">
        <h2 id="st-house" class="st__h">Household</h2>
        <div class="st__rows">
          <div class="st__field">
            <label class="st__label" for="st-baby-name">Baby's name</label>
            <input
              id="st-baby-name"
              class="app-control st__input"
              type="text"
              maxlength="40"
              autocomplete="off"
              :value="baby.babyName"
              @input="setBaby('babyName', $event.target.value)"
            />
          </div>
          <div class="st__field">
            <ChipGroup
              label="Baby status"
              :model-value="baby.babyStatus"
              :options="babyStatusOptions"
              @update:model-value="setBaby('babyStatus', $event)"
            />
          </div>
          <div class="st__field">
            <label class="st__label" for="st-baby-date">{{ babyDateLabel }}</label>
            <input
              id="st-baby-date"
              class="app-control st__time"
              type="date"
              :value="baby.babyDate"
              @change="setBaby('babyDate', $event.target.value)"
            />
          </div>
          <p class="st__save" role="status" aria-live="polite">{{ babySaved }}</p>
          <p v-if="babyError" class="app-error-text" role="alert">{{ babyError }}</p>
        </div>

        <div v-if="!leaveOpen" class="st__actions">
          <AppButton variant="outline" size="sm" @click="leaveOpen = true">Leave household</AppButton>
        </div>
        <ConfirmDanger
          v-else
          id="st-leave"
          word="LEAVE"
          title="Leave this household"
          lead="You stop seeing the shared care log, rota, calendar and plans."
          :points="[
            'Everything you logged stays with the household, because your partner still needs it.',
            'Your wellness check-ins are private and stay with you.',
            'You can join again later with a new invitation code.',
          ]"
          confirm-label="Leave household"
          :busy="leaveBusy"
          @cancel="leaveOpen = false"
          @confirm="confirmLeave"
        />
        <p v-if="leaveError" class="app-error-text" role="alert">{{ leaveError }}</p>
      </section>

      <!-- Danger zone -->
      <section class="st__section st__section--last" aria-labelledby="st-danger">
        <h2 id="st-danger" class="st__h">Danger zone</h2>
        <div v-if="!deleteOpen" class="st__actions">
          <AppButton variant="outline" size="sm" @click="deleteOpen = true">Delete my account</AppButton>
        </div>
        <ConfirmDanger
          v-else
          id="st-delete"
          word="DELETE"
          title="Delete my account"
          lead="This removes your account and cannot be undone."
          :points="[
            'Your profile, settings and saved devices go.',
            'Your private wellness check-ins go.',
            'Shared household data stays, so your partner keeps the care log, rota and calendar.',
            'Your care log entries will show the words A parent instead of your name.',
          ]"
          confirm-label="Delete my account"
          :busy="deleteBusy"
          @cancel="deleteOpen = false"
          @confirm="confirmDelete"
        />
        <p v-if="deleteDone" class="st__text" role="status">{{ deleteDone }}</p>
        <div v-if="deleteKept.length" class="st__kept">
          <p class="st__text">The server is not set up yet, so this was done from the browser. It could not remove:</p>
          <ul class="st__points">
            <li v-for="item in deleteKept" :key="item">{{ item }}</li>
          </ul>
        </div>
        <p v-if="deleteError" class="app-error-text" role="alert">{{ deleteError }}</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.st { display: flex; flex-direction: column; gap: 0; max-width: 720px; font-size: 1rem; }
.st__head { display: flex; flex-direction: column; gap: 8px; padding-bottom: 16px; }
.st__title { font-size: 2.5rem; line-height: 1.2; }
.st__sub { margin: 0; color: var(--nt-muted); }
.st__section { display: flex; flex-direction: column; gap: 12px; padding: 20px 0; border-top: 1px solid var(--nt-line); }
.st__section--last { border-bottom: 1px solid var(--nt-line); }
.st__h { margin: 0; font-family: var(--nt-serif); font-size: 1.125rem; font-weight: 400; color: var(--nt-ink); }
.st__rows { display: flex; flex-direction: column; gap: 14px; }
.st__field { display: flex; flex-direction: column; gap: 6px; }
.st__pair { display: flex; flex-wrap: wrap; gap: 16px; }
.st__label { font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.st__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.st__text { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.st__save { min-height: 20px; margin: 0; font-size: 0.875rem; line-height: 20px; color: var(--nt-muted); }
.st__code { margin: 0; font-size: 1.25rem; font-weight: 600; letter-spacing: 0.08em; color: var(--nt-plum); }
.st__time { max-width: 160px; }
.st__input { max-width: 320px; }
.st__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.st__points { margin: 0; padding-left: 20px; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.st__kept { display: flex; flex-direction: column; gap: 8px; }
.st__retry { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
@media (max-width: 991px) { .st__title { font-size: 2rem; } }
</style>
