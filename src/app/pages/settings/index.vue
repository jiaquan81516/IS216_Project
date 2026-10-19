<script setup>
import "@/app/app.css";
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import ChipGroup from "@/app/components/ChipGroup.vue";
import ConfirmDanger from "@/app/components/ConfirmDanger.vue";
import GoogleCalendarClientCard from "@/app/components/GoogleCalendarClientCard.vue";
import Toggle from "@/app/components/Toggle.vue";
import { isClientModeAvailable } from "@/api/googleCalendarClient";
import {
  deleteAccountFallback,
  leaveHousehold,
  saveHouseholdBaby,
  saveSettingsPatch,
} from "@/api/account";
import { expiresInText, inviteState } from "@/app/utils/inviteHelpers";
import { takeLimit } from "@/app/utils/limits";
import { checkInviteCode, getInvite, joinHousehold, regenerateInviteCode } from "@/api/profile";
import {
  debounce,
  normaliseSettings,
  settingsPatch,
  TIME_FORMATS,
  WEEK_STARTS,
} from "@/app/utils/settingsHelpers";
import {
  deleteAccount,
  describeServerError,
  describeSyncResult,
  disconnectGoogle,
  startGoogleConnect,
  syncGoogleCalendar,
} from "@/api/server";
import { displayName, useHome, HOME_KEY } from "@/app/composables/useHome";
import { setDisplay } from "@/app/composables/usePrefs";
import { usePush } from "@/app/composables/usePush";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "SettingsPage" });

const NAV = [
  { id: "st-notif", label: "Notifications" },
  { id: "st-cal", label: "Google Calendar" },
  { id: "st-display", label: "Display" },
  { id: "st-privacy", label: "Privacy" },
  { id: "st-partner-h", label: "Partner" },
  { id: "st-house", label: "Household" },
  { id: "st-danger", label: "Danger zone" },
];

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

const rootEl = ref(null);
const activeId = ref("");
let observer = null;
let lockUntil = 0;

function prefersReducedMotion() {
  if (form.value.display?.reduceMotion) return true;
  try {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

// The section card for a heading id. The page scrolls inside the app shell, so the plain
// #hash jump is not reliable; scrollIntoView works whichever element scrolls.
function sectionFor(id) {
  const scope = rootEl.value ?? document;
  const heading = scope.querySelector(`#${id}`);
  if (!heading) return { heading: null, target: null };
  const target = scope.querySelector(`[aria-labelledby="${id}"]`) || heading.closest(".st__card") || heading;
  return { heading, target };
}

function goTo(id) {
  const { heading, target } = sectionFor(id);
  if (!target) return;
  activeId.value = id;
  lockUntil = Date.now() + 800;
  target.scrollIntoView?.({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus?.({ preventScroll: true });
  }
}

function watchSections() {
  if (observer) observer.disconnect();
  observer = null;
  if (typeof IntersectionObserver === "undefined") return;
  const visible = new Map();
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = entry.target.getAttribute("aria-labelledby");
        if (entry.isIntersecting) visible.set(id, entry.boundingClientRect.top);
        else visible.delete(id);
      }
      if (Date.now() < lockUntil || !visible.size) return;
      const [first] = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
      activeId.value = first;
    },
    { rootMargin: "-10% 0px -60% 0px" },
  );
  for (const item of NAV) {
    const { target } = sectionFor(item.id);
    if (target) observer.observe(target);
  }
}

watch(
  () => [loading.value, error.value],
  async ([isLoading, hasError]) => {
    if (isLoading || hasError) return;
    await nextTick();
    watchSections();
  },
  { immediate: true, flush: "post" },
);
onBeforeUnmount(() => observer?.disconnect());

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

// Push is on for this device only when the parent allowed it and the device was registered.
// Turning it off here switches off the master setting, which the server checks for every
// device of the account.
const push = usePush(() => me.value.uid);
async function setPush(on) {
  if (on) {
    if (!(await push.enable())) {
      set("notifications.push", false);
      return;
    }
    set("notifications.push", true);
  } else {
    await push.disable();
    set("notifications.push", false);
  }
}
const pushHint = computed(() => {
  if (!push.supported) return "This browser cannot receive push notifications. On iPhone, add NurtureTrack to the Home Screen first.";
  if (!push.configured) return "Web push is not set up yet. Add VITE_FIREBASE_VAPID_KEY to .env.";
  if (push.permission.value === "denied") return "Notifications are blocked for this site. Allow them in the browser's site settings.";
  return "Turn on to get alerts on this device. The master switch for everything below.";
});

const timeFormatOptions = TIME_FORMATS.map((value) => ({ value, label: value === "12h" ? "12 hour" : "24 hour" }));
const weekStartOptions = WEEK_STARTS.map((value) => ({ value, label: value === "mon" ? "Monday" : "Sunday" }));

// Calendar connection. With a browser OAuth client id the card talks to Google directly and
// the server only controls below are hidden.
const clientMode = isClientModeAvailable();
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
    inviteNote.value =
      cause?.code === "permission-denied"
        ? "Your database rules do not allow new codes yet. Publish the latest firestore.rules in the Firebase console, then try again."
        : "We could not make a new code. Check your connection and try again.";
  } finally {
    inviteBusy.value = false;
  }
}

// Joining the partner's household from a solo household
const joinOpen = ref(false);
const joinCode = ref("");
const joinBusy = ref(false);
const joinError = ref("");

function openJoin() {
  joinOpen.value = true;
  joinError.value = "";
}
function cancelJoin() {
  joinOpen.value = false;
  joinCode.value = "";
  joinError.value = "";
}

async function submitJoin() {
  if (joinBusy.value) return;
  joinError.value = "";
  const code = joinCode.value.trim();
  if (!code) {
    joinError.value = "Enter the invitation code from your partner.";
    return;
  }
  joinBusy.value = true;
  try {
    // Check first, so a bad code never takes anyone out of their household.
    let checked;
    try {
      checked = await checkInviteCode(code);
    } catch (cause) {
      console.error("[app settings join check]", cause?.code, cause);
      joinError.value = "We could not check that code. Check your connection and try again.";
      return;
    }
    if (!checked.ok) {
      joinError.value = checked.message;
      return;
    }
    if (checked.householdId && checked.householdId === householdId.value) {
      joinError.value = "That is your own household code. Give it to your partner instead.";
      return;
    }
    const user = { uid: me.value.uid, displayName: me.value.displayName };
    try {
      await leaveHousehold(me.value.uid, householdId.value);
    } catch (cause) {
      console.error("[app settings join leave]", cause?.code, cause);
      joinError.value = "We could not switch households. Nothing has changed. Check your connection and try again.";
      return;
    }
    try {
      await joinHousehold(user, code);
    } catch (cause) {
      console.error("[app settings join]", cause?.code, cause);
      joinError.value = "We could not join that household. You are not in a household right now. Enter the code again.";
      router.push({ path: ROUTES.HOUSEHOLD, query: { code } });
      return;
    }
    // The household id changed. Reloading the profile updates the id that the care log and
    // the shared stores in the app shell watch, so they stop listening to the old household.
    try {
      await reload();
    } catch {
      // Home loads it again.
    }
    router.push(ROUTES.HOME);
  } finally {
    joinBusy.value = false;
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
  <div ref="rootEl" class="st">
    <header class="st__head">
      <h1 class="nt-title st__title">Settings</h1>
      <p class="st__sub">Changes save as you make them.</p>
    </header>

    <p v-if="loading" class="st__muted" aria-live="polite">Loading...</p>

    <div v-else-if="error" role="alert" class="st__retry">
      <p class="st__text">{{ error }}</p>
      <AppButton variant="outline" size="sm" @click="reload">Try again</AppButton>
    </div>

    <div v-else class="st__layout">
      <nav class="st__nav" aria-label="Settings sections">
        <a
          v-for="item in NAV"
          :key="item.id"
          class="st__nav-link"
          :href="`#${item.id}`"
          :aria-current="activeId === item.id ? 'true' : undefined"
          @click.prevent="goTo(item.id)"
        >{{ item.label }}</a>
      </nav>
      <div class="st__cards">
      <p class="st__save" role="status" aria-live="polite">{{ savedAt }}</p>
      <p v-if="saveError" class="app-error-text" role="alert">{{ saveError }}</p>

      <!-- Notifications -->
      <section class="st__card" aria-labelledby="st-notif">
        <h2 id="st-notif" class="st__h">Notifications</h2>
        <p class="st__muted">
          Alerts for a message or a task from your partner reach this device while the browser is
          running. They need the push server from docs/setup.md.
        </p>
        <p v-if="push.error.value" class="app-error-text" role="alert">{{ push.error.value }}</p>
        <div class="st__rows">
          <Toggle
            id="st-push"
            label="Push notifications"
            :hint="pushHint"
            :disabled="push.busy.value || (!form.notifications.push && (!push.supported || !push.configured))"
            :model-value="form.notifications.push"
            @update:model-value="setPush"
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
      <section class="st__card" aria-labelledby="st-cal">
        <h2 id="st-cal" class="st__h">Google Calendar</h2>
        <GoogleCalendarClientCard v-if="clientMode" :household-id="householdId || ''" :uid="me?.uid || ''" />
        <template v-else>
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
        </template>
      </section>

      <!-- Display -->
      <section class="st__card" aria-labelledby="st-display">
        <h2 id="st-display" class="st__h">Display</h2>
        <div class="st__rows">
          <div class="st__field">
            <ChipGroup
              label="Time format"
              :model-value="form.display.timeFormat"
              :options="timeFormatOptions"
              @update:model-value="set('display.timeFormat', $event)"
            />
            <p class="st__muted">How times read in the care log.</p>
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
      <section class="st__card" aria-labelledby="st-privacy">
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
      <section class="st__card" aria-labelledby="st-partner-h">
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

          <button v-if="!joinOpen" type="button" class="st__link" @click="openJoin">
            Have a code from your partner? Join their household
          </button>
          <form v-else class="st__join" novalidate :aria-busy="joinBusy" @submit.prevent="submitJoin">
            <div class="st__field">
              <label class="st__label" for="st-join-code">Invitation code</label>
              <input
                id="st-join-code"
                v-model="joinCode"
                class="app-control st__input"
                type="text"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                placeholder="NT-XXXX"
                :disabled="joinBusy"
                :aria-invalid="joinError ? 'true' : undefined"
              />
            </div>
            <p class="st__muted">
              You will leave your current household. Anything you logged here stays with it, and you will see your partner's household instead.
            </p>
            <p v-if="joinError" class="app-error-text" role="alert">{{ joinError }}</p>
            <div class="st__actions st__actions--center">
              <button type="button" class="st__link" :disabled="joinBusy" @click="cancelJoin">Cancel</button>
              <AppButton variant="outline" size="sm" :disabled="joinBusy" @click="submitJoin">
                {{ joinBusy ? "Joining..." : "Join household" }}
              </AppButton>
            </div>
          </form>
        </template>
      </section>

      <!-- Household -->
      <section class="st__card" aria-labelledby="st-house">
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
      <section class="st__card st__card--danger" aria-labelledby="st-danger">
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.st { display: flex; flex-direction: column; gap: 24px; max-width: 960px; font-size: 1rem; }
.st__head { display: flex; flex-direction: column; gap: 8px; }
.st__title { font-size: 2.5rem; line-height: 1.2; }
.st__sub { margin: 0; color: var(--nt-muted); }
.st__layout { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 40px; align-items: start; }
.st__nav { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 2px; }
.st__nav-link { padding: 8px 12px; border-radius: 8px; font-size: 0.9375rem; color: var(--nt-muted); text-decoration: none; }
.st__nav-link[aria-current="true"] { background: var(--nt-gray); color: var(--nt-ink); font-weight: 600; }
.st__nav-link:hover { background: var(--nt-gray); color: var(--nt-ink); }
.st__nav-link:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.st__cards { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.st__card { display: flex; flex-direction: column; gap: 14px; padding: 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; scroll-margin-top: 24px; }
.st__h { margin: 0; font-size: 1.125rem; font-weight: 600; line-height: 1.3; color: var(--nt-ink); }
.st__card--danger .st__h { color: var(--nt-coral); }
.st__rows { display: flex; flex-direction: column; gap: 16px; }
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
.st__link { align-self: flex-start; padding: 4px 0; background: none; border: 0; font: inherit; font-size: 0.875rem; color: var(--nt-plum); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.st__link:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
.st__link:disabled { opacity: 0.6; cursor: default; }
.st__join { display: flex; flex-direction: column; gap: 12px; }
.st__actions--center { align-items: center; gap: 16px; }
.st__points { margin: 0; padding-left: 20px; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.st__kept { display: flex; flex-direction: column; gap: 8px; }
.st__retry { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
@media (max-width: 991px) {
  .st__title { font-size: 2rem; }
  .st__layout { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .st__nav { display: none; }
}
@media (max-width: 575px) { .st__card { padding: 20px 16px; } }
</style>
