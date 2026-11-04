<script setup>
import DateField from "@/app/components/DateField.vue";
import LoadingScreen from "@/app/components/LoadingScreen.vue";
import "@/app/app.css";
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import Icon from "@/app/components/Icon.vue";
import PageHero from "@/app/components/PageHero.vue";
import ChipGroup from "@/app/components/ChipGroup.vue";
import ConfirmDanger from "@/app/components/ConfirmDanger.vue";
import GoogleCalendarClientCard from "@/app/components/GoogleCalendarClientCard.vue";
import CaregiverAccessPanel from "@/app/components/CaregiverAccessPanel.vue";
import Toggle from "@/app/components/Toggle.vue";
import { isClientModeAvailable } from "@/api/googleCalendarClient";
import {
  deleteAccountFallback,
  leaveHousehold,
  saveSettingsPatch,
} from "@/api/account";
import { expiresInText, inviteState } from "@/app/utils/inviteHelpers";
import { takeLimit } from "@/app/utils/limits";
import {
  checkInviteCode,
  getHouseholdBabies,
  getInvite,
  joinHousehold,
  regenerateInviteCode,
  updateBaby,
} from "@/api/profile";
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
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";

defineOptions({ name: "SettingsPage" });

const NAV = [
  { id: "st-notif", label: "Notifications", icon: "chat" },
  { id: "st-cal", label: "Google Calendar", icon: "calendar" },
  { id: "st-display", label: "Display", icon: "sliders" },
  { id: "st-privacy", label: "Privacy", icon: "lifebuoy" },
  { id: "st-partner-h", label: "Partner", icon: "heart" },
  { id: "st-caregivers", label: "Caregivers", icon: "briefcase" },
  { id: "st-house", label: "Household", icon: "pin" },
  { id: "st-danger", label: "Danger zone", icon: "trash" },
];

const router = useRouter();
const route = useRoute();
const home = inject(HOME_KEY, null) ?? useHome();
const { loading, error, reload, me, partner, profile, householdId, inviteCode } = home;

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

// A link such as /settings?section=st-caregivers scrolls straight to that card, then tidies the address.
onMounted(async () => {
  const section = Array.isArray(route.query?.section) ? route.query.section[0] : route.query?.section;
  if (!section) return;
  await nextTick();
  goTo(section);
  const rest = { ...route.query };
  delete rest.section;
  router.replace({ path: route.path, query: rest });
});

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

// Household babies: one editable entry per baby.
const { loadBabies: refreshSidebarBabies } = useSelectedBaby();
const babyList = ref([]);
const babySaved = ref("");
const babyError = ref("");
const babyTimers = new Map(); // one debounced save per baby

watch(
  () => householdId.value,
  async (id) => {
    if (!id) {
      babyList.value = [];
      return;
    }
    try {
      const list = await getHouseholdBabies(id);
      babyList.value = list.map((b) => ({
        id: b.id,
        babyName: b.babyName ?? "",
        babyStatus: b.babyStatus === "expected" ? "expected" : "born",
        babyDate: b.babyDate ?? "",
      }));
    } catch {
      babyList.value = [];
    }
  },
  { immediate: true },
);

async function writeBaby(id) {
  const target = babyList.value.find((b) => b.id === id);
  if (!target) return;
  babyError.value = "";
  try {
    await updateBaby(householdId.value, id, target);
    babySaved.value = "Saved";
    await refreshSidebarBabies(householdId.value);
  } catch (cause) {
    console.error("[app settings household]", cause?.code, cause);
    babySaved.value = "";
    babyError.value =
      cause?.code === "permission-denied"
        ? "Your database rules do not allow saving the baby yet. Ask jq to publish the latest firestore.rules, then try again."
        : "We could not save the baby. Check your connection and try again.";
  }
}
function setBaby(id, key, value) {
  const target = babyList.value.find((b) => b.id === id);
  if (!target) return;
  target[key] = value;
  babySaved.value = "";
  if (!babyTimers.has(id)) babyTimers.set(id, debounce(() => writeBaby(id), 600));
  babyTimers.get(id)();
}
onBeforeUnmount(() => babyTimers.forEach((t) => t.flush()));

const babyDateLabel = (b) => (b.babyStatus === "expected" ? "Due date" : "Date of birth");
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
    <PageHero title="Settings" />

    <LoadingScreen v-if="loading" variant="inline" label="Loading" />

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
        ><Icon :name="item.icon" :size="18" class="st__nav-ico" aria-hidden="true" />{{ item.label }}</a>
      </nav>
      <div class="st__cards">
      <p class="st__save" role="status" aria-live="polite">{{ savedAt }}</p>
      <p v-if="saveError" class="app-error-text" role="alert">{{ saveError }}</p>

      <!-- Notifications -->
      <section class="st__card" aria-labelledby="st-notif">
        <h2 id="st-notif" class="st__h"><span class="st__ico" aria-hidden="true"><Icon name="chat" :size="20" /></span>Notifications</h2>
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
        <h2 id="st-cal" class="st__h"><span class="st__ico" aria-hidden="true"><Icon name="calendar" :size="20" /></span>Google Calendar</h2>
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
        <h2 id="st-display" class="st__h"><span class="st__ico" aria-hidden="true"><Icon name="sliders" :size="20" /></span>Display</h2>
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
        <h2 id="st-privacy" class="st__h"><span class="st__ico" aria-hidden="true"><Icon name="lifebuoy" :size="20" /></span>Privacy</h2>
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
        <h2 id="st-partner-h" class="st__h"><span class="st__ico" aria-hidden="true"><Icon name="heart" :size="20" /></span>Partner</h2>
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
                placeholder="NT-XXXXXXXX"
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
      <section class="st__card" aria-labelledby="st-caregivers">
        <h2 id="st-caregivers" class="st__h"><span class="st__ico" aria-hidden="true"><Icon name="briefcase" :size="20" /></span>Caregivers</h2>
        <CaregiverAccessPanel :household-id="householdId || ''" :uid="me?.uid || ''" />
      </section>

      <!-- Household -->
      <section class="st__card" aria-labelledby="st-house">
        <h2 id="st-house" class="st__h"><span class="st__ico" aria-hidden="true"><Icon name="pin" :size="20" /></span>Household</h2>
        <div class="st__rows">
          <div v-for="(b, i) in babyList" :key="b.id" class="st__baby">
            <h3 v-if="babyList.length > 1" class="st__baby-h">Baby {{ i + 1 }}</h3>
            <div class="st__field">
              <label class="st__label" :for="`st-baby-name-${i}`">Baby's name</label>
              <input
                :id="`st-baby-name-${i}`"
                class="app-control st__input"
                type="text"
                maxlength="40"
                autocomplete="off"
                :value="b.babyName"
                @input="setBaby(b.id, 'babyName', $event.target.value)"
              />
            </div>
            <div class="st__field">
              <ChipGroup
                :label="`Baby status${babyList.length > 1 ? ' ' + (i + 1) : ''}`"
                :model-value="b.babyStatus"
                :options="babyStatusOptions"
                @update:model-value="setBaby(b.id, 'babyStatus', $event)"
              />
            </div>
            <div class="st__field">
              <label class="st__label" :for="`st-baby-date-${i}`">{{ babyDateLabel(b) }}</label>
              <DateField :id="`st-baby-date-${i}`" :model-value="b.babyDate" @update:model-value="setBaby(b.id, 'babyDate', $event)" />
            </div>
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
        <h2 id="st-danger" class="st__h"><span class="st__ico" aria-hidden="true"><Icon name="trash" :size="20" /></span>Danger zone</h2>
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
            'Care log entries you added may remain in the household and keep your name.',
          ]"
          confirm-label="Delete my account"
          :busy="deleteBusy"
          @cancel="deleteOpen = false"
          @confirm="confirmDelete"
        />
        <p v-if="deleteDone" class="st__text" role="status">{{ deleteDone }}</p>
        <div v-if="deleteKept.length" class="st__kept">
          <p class="st__text">Some shared information could not be removed:</p>
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
.st { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 53.75rem; margin: 0 auto; font-size: 1rem; color: var(--ink, #1f2a52); }
.st__layout { display: flex; flex-direction: column; gap: 16px; }
.st__nav { display: flex; flex-wrap: wrap; gap: 8px; }
.st__nav-ico { display: none; }
.st__nav-link { flex: none; padding: 6px 14px; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 999px; font-size: 0.875rem; font-weight: 600; color: var(--navy, #243560); text-decoration: none; white-space: nowrap; transition: background 0.15s, color 0.15s; }
.st__nav-link[aria-current="true"] { background: var(--navy, #243560); border-color: var(--navy, #243560); color: #fff; }
.st__nav-link:hover { border-color: var(--navy, #243560); }
.st__nav-link:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.st__cards { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.st__card { display: flex; flex-direction: column; gap: 14px; padding: 22px 24px 26px; background: var(--cream, #fdf9f0); border: 1px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 24px; scroll-margin-top: 24px; }
.st__h { display: flex; align-items: center; gap: 12px; margin: 0; font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 700; line-height: 1.25; color: var(--ink, #1f2a52); }
.st__ico { display: inline-grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 14px; background: #cfe3d4; color: #2f5d43; }
.st__card--danger { background: #fdf0e6; border-color: #f2c9a6; }
.st__card--danger .st__ico { background: #fbe3d3; color: #a4541f; }
.st__card--danger .st__h { color: #7a2e12; }
.st__rows { display: flex; flex-direction: column; }
.st__rows > * { padding: 14px 0; border-top: 1.5px dashed var(--sand, #e9d9b8); }
.st__rows > :first-child { padding-top: 0; border-top: 0; }
.st__field { display: flex; flex-direction: column; gap: 8px; }
.st__pair { display: flex; flex-wrap: wrap; gap: 16px; }
.st__label { font-size: 0.9375rem; font-weight: 600; color: var(--ink, #1f2a52); }
.st__muted { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--mut, #5b6692); }
.st__text { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: var(--ink, #1f2a52); }
.st__save { min-height: 20px; margin: 0; font-size: 0.875rem; line-height: 20px; color: var(--mut, #5b6692); }
.st__code { margin: 0; font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 700; letter-spacing: 0.1em; color: var(--navy, #243560); }
.st__time { max-width: 160px; }
.st__input { max-width: 320px; }
.st__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.st__link { align-self: flex-start; padding: 4px 0; background: none; border: 0; font: inherit; font-size: 0.875rem; font-weight: 600; color: var(--navy, #243560); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.st__link:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; border-radius: 4px; }
.st__link:disabled { opacity: 0.6; cursor: default; }
.st__join { display: flex; flex-direction: column; gap: 12px; }
.st__actions--center { align-items: center; gap: 16px; }
.st__points { margin: 0; padding-left: 20px; font-size: 0.9375rem; line-height: 1.5; color: var(--ink, #1f2a52); }
.st__kept { display: flex; flex-direction: column; gap: 8px; }
.st__retry { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 18px 20px; background: #fdeee6; border: 1.5px solid #f4a98c; border-radius: 18px; color: #7a2e12; }
.st__baby { display: flex; flex-direction: column; gap: 16px; padding: 14px 0 !important; }
.st__baby-h { margin: 0; font-family: var(--nt-serif); font-size: 1.0625rem; font-weight: 700; color: var(--ink, #1f2a52); }

/* Shared controls, in the app's look while they sit inside these cards. */
.st :deep(.app-control) { padding: 11px 14px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 14px; font-size: 0.9375rem; box-shadow: none; }
.st :deep(.app-control:focus) { outline: 3px solid var(--navy, #243560); outline-offset: 1px; border-color: var(--navy, #243560); box-shadow: none; }
.st :deep(.app-chip) { padding: 8px 16px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); color: var(--navy, #243560); font-weight: 600; }
.st :deep(.app-chip:hover) { background: #fff; border-color: var(--navy, #243560); }
.st :deep(.app-chip[aria-checked="true"]), .st :deep(.app-chip[aria-pressed="true"]) { background: var(--navy, #243560); border-color: var(--navy, #243560); color: #fff; }
.st :deep(.app-chip:focus-visible) { outline: 3px solid var(--navy, #243560); }
.st :deep(.btn) { padding: 9px 20px; background: var(--navy, #243560); border: 0; border-bottom: 3px solid #182246; border-radius: 14px; color: #fff; font-size: 0.9375rem; font-weight: 600; }
.st :deep(.btn:hover) { background: #1b2a4f; color: #fff; }
.st :deep(.btn-outline) { background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 3px; color: var(--navy, #243560); }
.st :deep(.btn-outline:hover) { background: #fffdf8; border-color: var(--navy, #243560); color: var(--navy, #243560); }
.st :deep(.app-error-text) { font-weight: 600; color: #a4541f; }

@media (max-width: 575px) { .st__card { padding: 18px 16px 22px; } .st__h { font-size: 1.3125rem; } }

/* On wide screens the sections sit in a menu beside the cards that stays in view while you scroll. */
@media (min-width: 960px) {
  .st__layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 20px; align-items: start; }
  .st__nav { position: sticky; top: 100px; max-height: calc(100vh - 124px); overflow-y: auto; flex-direction: column; flex-wrap: nowrap; gap: 6px; padding: 10px; background: var(--cream, #fdf9f0); border: 1px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 22px; }
  .st__nav-link { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: transparent; border: 0; border-radius: 14px; font-size: 0.9375rem; }
  .st__nav-ico { display: inline-block; flex: none; }
  .st__nav-link:hover { background: var(--sand, #e9d9b8); }
  .st__nav-link[aria-current="true"] { background: var(--navy, #243560); color: #fff; }
}

/* The "saved" note floats as a small pill, so it never pushes the first card down. */
.st__cards > .st__save { position: fixed; right: 24px; bottom: 24px; z-index: 40; min-height: 0; padding: 8px 16px; background: var(--navy, #243560); border-radius: 999px; box-shadow: 0 8px 20px rgb(36 53 96 / 28%); font-weight: 600; color: #fff; }
.st__cards > .st__save:empty { display: none; }
</style>
