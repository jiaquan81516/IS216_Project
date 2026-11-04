<script setup>
import "@/app/app.css";
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import Collapse from "@/app/components/Collapse.vue";
import BabyScene from "@/app/components/BabyScene.vue";
import StatusPill from "@/app/components/StatusPill.vue";
import { summariseEntry } from "@/app/utils/entryHelpers";
import { agoText } from "@/app/utils/homeSummary";
import Icon from "@/app/components/Icon.vue";
import { parseContacts } from "@/app/utils/caregiverHelpers";
import { readBaby } from "@/app/utils/babyMood";
import CaregiverTopBar from "@/app/components/CaregiverTopBar.vue";
import CareLogPanel from "@/app/components/CareLogPanel.vue";
import { useAuth } from "@/app/composables/useAuth";
import { addEntry, updateEntry } from "@/api/entries";
import {
  checkInviteCode,
  getCareBrief,
  getCaregiverHouseholds,
  getMember,
  getMyCareEntries,
  getRecentCareEntries,
  getUpcomingCareAppointments,
  getUserProfile,
  joinHousehold,
  setActiveCaregiverHousehold,
  setCaregiverHouseholdLabel,
  subscribeCareBrief,
  subscribeMember,
} from "@/api/profile";
import { leaveHousehold } from "@/api/account";
import { ROUTES } from "@/app/routes";
import { subscribeNights, subscribeRotaSettings } from "@/api/rota";
import { getHouseholdMembers } from "@/api/profile";
import { dutyForCarer } from "@/app/utils/dutyView";
import { addDays, toIso } from "@/app/utils/rotaHelpers";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";

defineOptions({ name: "CareBriefPage" });

const { currentUser } = useAuth();
const router = useRouter();
const loading = ref(true);
const error = ref("");
const household = ref(null);
const member = ref(null);
const entries = ref([]);
const appointments = ref([]);
const profile = ref(null);
const householdId = ref("");
const panelOpen = ref(false);
const panelSaving = ref(false);
const panelError = ref("");
const caregiverHouseholds = ref([]);
const householdManagerOpen = ref(false);
const householdInviteCode = ref("");
const householdInviteLabel = ref("");
const householdLabelDrafts = ref({});
const householdManagerBusy = ref(false);
const householdManagerError = ref("");
const householdDropdownOpen = ref(false);
const managerEl = ref(null);
// Opens the households panel from the menu in the banner, then eases down to it.
async function openManager() {
  householdDropdownOpen.value = false;
  householdManagerOpen.value = true;
  await nextTick();
  setTimeout(() => managerEl.value?.scrollIntoView?.({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 120);
}
const householdDropdownRef = ref(null);
const {
  babies,
  selectedBaby,
  selectedBabyId,
  babyLoadError,
  loadBabies,
  selectBaby,
} = useSelectedBaby();
const briefLoading = ref(false);
const briefError = ref("");
let stopCareBriefSubscription = null;
let briefLoadRun = 0;

const babyName = computed(() => {
  if (!selectedBaby.value || selectedBaby.value.id === "primary") {
    return (
      selectedBaby.value?.babyName ||
      household.value?.careBrief?.babyName ||
      "your baby"
    );
  }
  const index = babies.value.findIndex(
    (baby) => baby.id === selectedBaby.value.id,
  );
  return selectedBaby.value.babyName || `baby ${index + 1}`;
});
const caregiverName = computed(() =>
  profile.value?.displayName ? ` for ${profile.value.displayName}` : "",
);
const permissions = computed(() => member.value?.permissions ?? {});

// Who is looking after the baby today and tonight. Read only, and only with the duty permission.
const dutyRota = ref(null);
const dutyNights = ref({});
const dutyMembers = ref([]);
let stopDuty = [];
function stopDutyWatch() {
  for (const stop of stopDuty) stop();
  stopDuty = [];
  dutyRota.value = null;
  dutyNights.value = {};
}
async function watchDuty(hid) {
  stopDutyWatch();
  if (!hid || member.value?.permissions?.dutyView !== true) return;
  const today = toIso(new Date());
  try {
    dutyMembers.value = await getHouseholdMembers(hid);
  } catch {
    dutyMembers.value = [];
  }
  stopDuty = [
    subscribeRotaSettings(
      hid,
      (data) => {
        dutyRota.value = data;
      },
      () => {},
    ),
    subscribeNights(
      hid,
      addDays(today, -1),
      addDays(today, 1),
      (list) => {
        dutyNights.value = Object.fromEntries(list.map((n) => [n.date, n]));
      },
      () => {},
    ),
  ];
}
const duty = computed(() =>
  dutyForCarer({
    settings: dutyRota.value,
    nights: dutyNights.value,
    members: dutyMembers.value,
    meUid: currentUser.value?.uid ?? "",
  }),
);
function asDate(value) {
  if (value?.toDate) return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function timeOf(entry) {
  const date = asDate(entry?.at);
  return date
    ? new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : "Time unavailable";
}
const selectedEntries = computed(() =>
  entries.value.filter(
    (entry) =>
      (entry.babyId ?? "primary") === (selectedBaby.value?.id ?? "primary"),
  ),
);
const selectedAppointments = computed(() =>
  appointments.value.filter(
    (appointment) =>
      !appointment.babyIds?.length ||
      appointment.babyIds.includes(selectedBaby.value?.id ?? "primary"),
  ),
);
const latestFeed = computed(
  () => selectedEntries.value.find((entry) => entry.type === "feed") ?? null,
);
const latestNappy = computed(
  () => selectedEntries.value.find((entry) => entry.type === "nappy") ?? null,
);
const careLogTypes = computed(() => [
  "feed",
  "sleep",
  "nappy",
  "note",
  ...(permissions.value.careLogMedication ? ["medication"] : []),
]);

function careBriefOptions(babyId) {
  return {
    babyId,
    routine: member.value?.permissions?.napRoutine === true,
    feeding: member.value?.permissions?.feedingInstructions === true,
    contacts: member.value?.permissions?.careBrief === true,
    child: member.value?.permissions?.careBrief === true,
    allergies: member.value?.permissions?.allergyInfo === true,
    medications: member.value?.permissions?.medicationInfo === true,
  };
}

async function loadSelectedCareBrief() {
  if (!householdId.value || !member.value) return;
  const run = ++briefLoadRun;
  const activeHouseholdId = householdId.value;
  const options = careBriefOptions(selectedBabyId.value);
  stopCareBriefSubscription?.();
  stopCareBriefSubscription = null;
  briefLoading.value = true;
  briefError.value = "";
  household.value = { careBrief: {} };
  try {
    const careBrief = await getCareBrief(activeHouseholdId, options);
    if (run !== briefLoadRun) return;
    household.value = { careBrief };
    stopCareBriefSubscription = subscribeCareBrief(
      activeHouseholdId,
      options,
      (latestCareBrief) => {
        if (run === briefLoadRun)
          household.value = { careBrief: latestCareBrief };
      },
      (cause) => {
        if (run === briefLoadRun) {
          console.error("[app care brief updates]", cause?.code, cause);
          briefError.value =
            "Care instructions could not be updated. Try refreshing the page.";
        }
      },
    );
  } catch (cause) {
    if (run !== briefLoadRun) return;
    console.error("[app care brief]", cause?.code, cause);
    briefError.value =
      "We couldn’t load this baby’s care brief. Check your connection and try again.";
  } finally {
    if (run === briefLoadRun) briefLoading.value = false;
  }
}

// Watch this caregiver's own member record. When the owner changes what they can see, reload the
// parts of the brief that depend on it without a refresh.
let stopMemberWatch = null;
function watchMember(hid, uid) {
  stopMemberWatch?.();
  stopMemberWatch = subscribeMember(
    hid,
    uid,
    async (next) => {
      if (hid !== householdId.value) return;
      // Removed by the owner: reload, which explains that this account no longer has access.
      if (!next) {
        await load();
        return;
      }
      if (JSON.stringify(next.permissions ?? {}) === JSON.stringify(member.value?.permissions ?? {})) return;
      member.value = next;
      await loadSelectedCareBrief();
      watchDuty(hid);
      try {
        entries.value = next.permissions?.careLogRead
          ? await getRecentCareEntries(hid)
          : await getMyCareEntries(hid, uid);
        appointments.value = next.permissions?.appointments ? await getUpcomingCareAppointments(hid) : [];
      } catch (cause) {
        console.error("[app caregiver access]", cause?.code, cause);
      }
    },
    (cause) => console.error("[app caregiver access]", cause?.code, cause),
  );
}

async function load() {
  briefLoadRun += 1;
  stopCareBriefSubscription?.();
  stopCareBriefSubscription = null;
  loading.value = true;
  error.value = "";
  try {
    const uid = currentUser.value?.uid;
    const loadedProfile = uid ? await getUserProfile(uid) : null;
    if (!loadedProfile)
      throw new Error("This account is not linked to a caregiver household.");
    caregiverHouseholds.value = await getCaregiverHouseholds(uid);
    householdLabelDrafts.value = Object.fromEntries(
      caregiverHouseholds.value.map((item) => [
        item.householdId,
        item.editableLabel || "",
      ]),
    );
    const activeHousehold =
      caregiverHouseholds.value.find((item) => item.active) ??
      caregiverHouseholds.value[0];
    if (!activeHousehold)
      throw new Error(
        "This account is not currently a member of any caregiver household. Ask a parent to invite you again.",
      );
    const activeHouseholdId = activeHousehold.householdId;
    await loadBabies(activeHouseholdId);
    const loadedMember = await getMember(activeHouseholdId, uid);
    member.value = loadedMember;
    profile.value = { ...loadedProfile, householdId: activeHouseholdId };
    householdId.value = activeHouseholdId;
    watchMember(activeHouseholdId, uid);
    await loadSelectedCareBrief();
    watchDuty(activeHouseholdId);
    if (member.value?.permissions?.careLogRead)
      entries.value = await getRecentCareEntries(activeHouseholdId);
    else entries.value = await getMyCareEntries(activeHouseholdId, uid);
    if (member.value?.permissions?.appointments)
      appointments.value = await getUpcomingCareAppointments(activeHouseholdId);
    else appointments.value = [];
  } catch (cause) {
    console.error("[app care brief]", cause?.code, cause);
    error.value =
      cause?.code === "permission-denied"
        ? "Some information in this brief is not shared with you. Ask a parent to update your access."
        : cause.message ||
          "We could not load your care brief. Check your connection and try again.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  stopMemberWatch?.();
  stopDutyWatch();
  briefLoadRun += 1;
  stopCareBriefSubscription?.();
  document.removeEventListener("click", handleClickOutside);
});

async function switchHousehold(nextHouseholdId) {
  if (
    !nextHouseholdId ||
    nextHouseholdId === householdId.value ||
    householdManagerBusy.value
  )
    return;
  householdManagerBusy.value = true;
  householdManagerError.value = "";
  try {
    await setActiveCaregiverHousehold(currentUser.value.uid, nextHouseholdId);
    householdManagerOpen.value = false;
    await load();
  } catch (cause) {
    householdManagerError.value =
      cause.message || "Could not switch households. Try again.";
  } finally {
    householdManagerBusy.value = false;
  }
}

async function switchBaby(nextBabyId) {
  if (!nextBabyId || !babies.value.some((baby) => baby.id === nextBabyId))
    return;
  selectBaby(nextBabyId);
  await loadSelectedCareBrief();
}

async function addCaregiverHousehold() {
  if (householdManagerBusy.value) return;
  householdManagerBusy.value = true;
  householdManagerError.value = "";
  try {
    const checked = await checkInviteCode(householdInviteCode.value);
    if (!checked.ok) throw new Error(checked.message);
    if (checked.kind !== "caregiver")
      throw new Error(
        "Use a caregiver invitation from that household's parent.",
      );
    if (
      caregiverHouseholds.value.some(
        (item) => item.householdId === checked.householdId,
      )
    ) {
      throw new Error("You are already connected to that household.");
    }
    await joinHousehold(currentUser.value, householdInviteCode.value, {
      householdLabel: householdInviteLabel.value,
    });
    householdInviteCode.value = "";
    householdInviteLabel.value = "";
    householdManagerOpen.value = false;
    await load();
  } catch (cause) {
    householdManagerError.value =
      cause.message ||
      "Could not join that household. Check the invitation code and try again.";
  } finally {
    householdManagerBusy.value = false;
  }
}

async function saveHouseholdLabel(targetHouseholdId) {
  if (householdManagerBusy.value) return;
  householdManagerBusy.value = true;
  householdManagerError.value = "";
  try {
    await setCaregiverHouseholdLabel(
      currentUser.value.uid,
      targetHouseholdId,
      householdLabelDrafts.value[targetHouseholdId],
    );
    await load();
  } catch (cause) {
    householdManagerError.value =
      cause.message || "Could not save that household name. Try again.";
  } finally {
    householdManagerBusy.value = false;
  }
}

async function leaveCaregiverHousehold(targetHouseholdId) {
  if (householdManagerBusy.value) return;
  const target = caregiverHouseholds.value.find(
    (item) => item.householdId === targetHouseholdId,
  );
  if (!target) return;
  if (
    !window.confirm(
      `Leave ${target.label}? You will lose access to its care brief and shared care log.`,
    )
  )
    return;
  const remaining = caregiverHouseholds.value.filter(
    (item) => item.householdId !== targetHouseholdId,
  );
  const nextActiveId =
    targetHouseholdId === householdId.value
      ? (remaining[0]?.householdId ?? null)
      : householdId.value;
  householdManagerBusy.value = true;
  householdManagerError.value = "";
  try {
    await leaveHousehold(
      currentUser.value.uid,
      targetHouseholdId,
      nextActiveId,
    );
    if (nextActiveId) await load();
    else router.push(ROUTES.HOUSEHOLD);
  } catch (cause) {
    householdManagerError.value =
      cause.message || "Could not leave that household. Try again.";
  } finally {
    householdManagerBusy.value = false;
  }
}

// "Edit own care logs": the caregiver can change what they logged themselves.
const editing = ref(null);
function canEdit(entry) {
  const p = permissions.value;
  return Boolean(p.careLogEdit && entry.by === currentUser.value?.uid && (entry.type !== "medication" || p.careLogMedication));
}
function openAdd() {
  editing.value = null;
  panelError.value = "";
  panelOpen.value = true;
}
function openEdit(entry) {
  editing.value = entry;
  panelError.value = "";
  panelOpen.value = true;
}
function closePanel() {
  if (panelSaving.value) return;
  panelOpen.value = false;
  editing.value = null;
}

async function saveCareEntry(payload) {
  if (editing.value) {
    if (!canEdit(editing.value) || panelSaving.value) return;
    panelSaving.value = true;
    panelError.value = "";
    try {
      await updateEntry(householdId.value, editing.value.id, { at: payload.at, endedAt: payload.endedAt, details: payload.details });
      panelOpen.value = false;
      editing.value = null;
      await load();
    } catch (cause) {
      console.error("[app caregiver edit]", cause?.code, cause);
      panelError.value =
        cause?.code === "permission-denied"
          ? "You can no longer edit this log. Ask a parent to check your permissions."
          : "Could not save the change. Check your connection and try again.";
    } finally {
      panelSaving.value = false;
    }
    return;
  }
  if (!member.value?.permissions?.careLogAdd || panelSaving.value) return;
  panelSaving.value = true;
  panelError.value = "";
  try {
    if (
      payload.type === "medication" &&
      !member.value?.permissions?.careLogMedication
    )
      throw new Error("Medication logging is not shared with you.");
    await addEntry({ uid: currentUser.value.uid }, householdId.value, {
      ...payload,
      byName:
        profile.value?.displayName ||
        currentUser.value?.displayName ||
        "Caregiver",
    });
    panelOpen.value = false;
    await load();
  } catch (cause) {
    console.error("[app caregiver log]", cause?.code, cause);
    panelError.value =
      cause?.code === "permission-denied"
        ? "Your care log access changed. Ask a parent to check your permissions."
        : "Could not save this care log. Check your connection and try again.";
  } finally {
    panelSaving.value = false;
  }
}
function handleClickOutside(event) {
  if (
    householdDropdownRef.value &&
    !householdDropdownRef.value.contains(event.target)
  ) {
    householdDropdownOpen.value = false;
  }
}

// The same animated bassinet as Home, following the selected baby.
const babyMood = computed(() => readBaby(selectedEntries.value, babyName.value, new Date()));

// "Last feed 1 h ago", as on the care log.
const feedStatus = computed(() => {
  const raw = latestFeed.value?.at;
  const at = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  const minutes = (Date.now() - at.getTime()) / 60000;
  const tone = minutes >= 240 ? "due" : minutes >= 180 ? "soon" : "ok";
  const word = tone === "due" ? "Feed is due" : tone === "soon" ? "Feed due soon" : "Recently fed";
  return {
    ago: agoText(at, new Date()),
    clock: at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    tone,
    word,
  };
});

// What this caregiver logged themselves, newest first, so they can see it landed.
const myEntries = computed(() =>
  selectedEntries.value.filter((entry) => entry.by === currentUser.value?.uid).slice(0, 8),
);
function entryDay(entry) {
  const date = asDate(entry?.at);
  if (!date) return "";
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(date);
}
const contactRows = computed(() => parseContacts(household.value?.careBrief?.parentContacts));

// The "right now" tiles: last feed, last nappy and whether the baby is asleep.
function ago(entry) {
  const date = asDate(entry?.at);
  return date ? agoText(date, new Date()) : "";
}
const tiles = computed(() => {
  const feed = latestFeed.value;
  const nappy = latestNappy.value;
  const sleepEntry = selectedEntries.value.find((entry) => entry.type === "sleep") ?? null;
  const asleep = babyMood.value.state === "sleeping";
  const wokeAt = sleepEntry?.endedAt ? timeOf({ at: sleepEntry.endedAt }) : "";
  return [
    {
      label: "Last feed",
      icon: "feed",
      tone: feedStatus.value?.tone ?? "none",
      value: feed ? timeOf(feed) : "None yet",
      sub: feed ? `${ago(feed)}${feed.details?.method ? ` · ${feed.details.method}` : ""}` : "Nothing logged today",
    },
    {
      label: "Last nappy",
      icon: "diaper",
      tone: "none",
      value: nappy ? timeOf(nappy) : "None yet",
      sub: nappy ? ago(nappy) : "Nothing logged today",
    },
    {
      label: "Sleep",
      icon: "moon",
      tone: asleep ? "sleep" : "none",
      value: asleep ? "Asleep" : "Awake",
      sub: asleep ? `Since ${timeOf(sleepEntry)}` : wokeAt ? `Woke at ${wokeAt}` : "No naps logged",
    },
  ];
});

// While a sleep has no end yet, offer "awake now", which ends it at this moment.
const openSleep = computed(() =>
  babyMood.value.state === "sleeping"
    ? selectedEntries.value.find((entry) => entry.type === "sleep") ?? null
    : null,
);
const waking = ref(false);
const wakeError = ref("");
async function wakeUp() {
  if (!openSleep.value || waking.value || !householdId.value) return;
  waking.value = true;
  wakeError.value = "";
  try {
    await updateEntry(householdId.value, openSleep.value.id, { endedAt: new Date() });
    await load();
  } catch (cause) {
    console.error("[app caregiver wake]", cause?.code, cause);
    wakeError.value = "Could not save. Try again.";
  } finally {
    waking.value = false;
  }
}
</script>

<template>
  <div class="brief-page">
    <CaregiverTopBar :show-duty="permissions.dutyView === true" />
    <main class="brief">
      <header class="brief__hero">
        <div class="brief__hero-copy">
          <p class="brief__eyebrow">Caregiver view{{ caregiverName }}</p>
          <h1>Today’s care brief</h1>
          <p class="brief__lead">
            A quick guide for caring for {{ babyName }}.
          </p>
          <StatusPill v-if="permissions.careLogRead" icon="feed" :tone="feedStatus ? feedStatus.tone : 'none'">
            <template v-if="feedStatus">
              <span class="visually-hidden">{{ feedStatus.word }}.</span>Last feed <strong>{{ feedStatus.ago }}</strong>
            </template>
            <template v-else>No feeds logged yet</template>
            <template v-if="feedStatus" #time>{{ feedStatus.clock }}</template>
          </StatusPill>
          <button
            v-if="openSleep && permissions.careLogAdd"
            type="button"
            class="brief__wake"
            :disabled="waking"
            @click="wakeUp"
          >
            <Icon name="sun" :size="18" />{{ babyName }} is awake now
          </button>
          <p v-if="wakeError" class="brief__hero-status" role="alert">{{ wakeError }}</p>
          <p v-if="babyLoadError" class="brief__hero-status" role="status">
            We couldn’t load all baby details. Try refreshing or ask a parent to
            check your access.
          </p>
          <p v-if="briefLoading" class="brief__hero-status" aria-live="polite">
            Loading {{ babyName }}’s care instructions…
          </p>
          <p v-if="briefError" class="brief__hero-status" role="alert">
            {{ briefError }}
          </p>
        </div>
        <div class="brief__hero-side">
          <div class="brief__household-controls">
            <div ref="householdDropdownRef" class="brief__household-dropdown">
              <button
                type="button"
                class="brief__household-trigger"
                aria-haspopup="menu"
                :aria-expanded="householdDropdownOpen ? 'true' : 'false'"
                :disabled="householdManagerBusy"
                @click="householdDropdownOpen = !householdDropdownOpen"
              >
                <span class="brief__household-label">Caregiving for</span>
                <span class="brief__household-current">{{
                  caregiverHouseholds.find((item) => item.householdId === householdId)?.label || "Household"
                }}</span>
                <span class="brief__household-chevron" :class="{ 'is-open': householdDropdownOpen }" aria-hidden="true">⌄</span>
              </button>
              <Transition name="hh-pop">
                <div v-if="householdDropdownOpen" class="brief__household-menu" role="menu">
                  <button
                    v-for="item in caregiverHouseholds"
                    :key="item.householdId"
                    type="button"
                    role="menuitemradio"
                    :aria-checked="item.householdId === householdId ? 'true' : 'false'"
                    class="brief__household-option"
                    :class="{ 'is-active': item.householdId === householdId }"
                    :disabled="householdManagerBusy"
                    @click="
                      switchHousehold(item.householdId);
                      householdDropdownOpen = false;
                    "
                  >
                    <span class="brief__household-icon" aria-hidden="true">⌂</span>
                    <span>{{ item.label }}</span>
                    <span v-if="item.householdId === householdId" class="brief__household-tick" aria-hidden="true">✓</span>
                  </button>
                  <button type="button" role="menuitem" class="brief__household-option brief__household-option--manage" @click="openManager">
                    <span class="brief__household-icon" aria-hidden="true">⚙</span>
                    <span>Manage households</span>
                  </button>
                </div>
              </Transition>
            </div>
          </div>
          <BabyScene class="brief__art" on-dark art-only :state="babyMood.state" :title="babyMood.title" />
        </div>
      </header>
      <div v-if="babies.length > 1 || permissions.careLogAdd" class="brief__bar">
        <div
          v-if="babies.length > 1"
          class="brief__baby-switch"
          role="group"
          aria-label="Select baby"
        >
          <div class="brief__baby-tabs">
            <button
              v-for="(baby, index) in babies"
              :key="baby.id"
              type="button"
              class="brief__baby-tab"
              :class="{ 'is-active': baby.id === selectedBabyId }"
              :aria-pressed="baby.id === selectedBabyId"
              :disabled="loading || briefLoading"
              @click="switchBaby(baby.id)"
            >
              <span class="brief__baby-face" aria-hidden="true">{{ (baby.babyName || `Baby ${index + 1}`).charAt(0).toUpperCase() }}</span>
              {{ baby.babyName || `Baby ${index + 1}` }}
            </button>
          </div>
        </div>
        <div v-if="permissions.careLogAdd" class="brief__bar-add">
          <p v-if="panelError" class="brief__bar-error" role="alert">{{ panelError }}</p>
          <button type="button" class="brief__fab" @click="openAdd">
            <Icon name="plus" :size="20" />Add a care log
          </button>
        </div>
      </div>
      <Collapse>
      <section
        v-if="householdManagerOpen"
        ref="managerEl"
        class="brief__card brief__household-manager"
        aria-labelledby="brief-households-title"
      >
        <div class="brief__manager-head">
          <h2 id="brief-households-title">Your caregiving households</h2>
          <button type="button" class="brief__manager-close" aria-label="Close households" @click="householdManagerOpen = false">×</button>
        </div>
        <p class="brief__muted">
          Give each one a name you’ll recognize. These names are private to your
          account.
        </p>
        <article
          v-for="item in caregiverHouseholds"
          :key="item.householdId"
          class="brief__household-row"
        >
          <div class="brief__household-name">
            <strong>{{ item.label }}</strong>
            <span v-if="item.householdId === householdId" class="brief__muted"
              >Current household</span
            >
          </div>
          <form
            class="brief__rename-household"
            @submit.prevent="saveHouseholdLabel(item.householdId)"
          >
            <label
              class="brief__household-select"
              :for="`brief-household-label-${item.householdId}`"
            >
              <span>Your name for this household</span>
              <input
                :id="`brief-household-label-${item.householdId}`"
                v-model="householdLabelDrafts[item.householdId]"
                class="app-control"
                maxlength="40"
                placeholder="e.g. Lee Family"
                :disabled="householdManagerBusy"
              />
            </label>
            <AppButton
              type="submit"
              variant="outline"
              size="sm"
              :disabled="
                householdManagerBusy ||
                !householdLabelDrafts[item.householdId]?.trim() ||
                householdLabelDrafts[item.householdId]?.trim() ===
                  (item.editableLabel || '')
              "
              >Rename household</AppButton
            >
          </form>
          <div class="brief__household-actions">
            <AppButton
              variant="outline"
              size="sm"
              class="brief__leave"
              :disabled="householdManagerBusy"
              @click="leaveCaregiverHousehold(item.householdId)"
              >Leave household</AppButton
            >
          </div>
        </article>
        <form
          class="brief__join-household"
          @submit.prevent="addCaregiverHousehold"
        >
          <label class="brief__household-select" for="brief-invite-code">
            <span>Caregiver invitation code</span>
            <input
              id="brief-invite-code"
              v-model="householdInviteCode"
              class="app-control"
              autocomplete="off"
              placeholder="Caregiver invitation code"
              :disabled="householdManagerBusy"
            />
          </label>
          <label class="brief__household-select" for="brief-invite-label">
            <span>Name this household</span>
            <input
              id="brief-invite-label"
              v-model="householdInviteLabel"
              class="app-control"
              maxlength="40"
              placeholder="e.g. Lee Family"
              :disabled="householdManagerBusy"
            />
          </label>
          <AppButton
            type="submit"
            :disabled="householdManagerBusy || !householdInviteCode.trim()"
            >{{
              householdManagerBusy ? "Please wait…" : "Join household"
            }}</AppButton
          >
        </form>
        <p v-if="householdManagerError" class="brief__text" role="alert">
          {{ householdManagerError }}
        </p>
      </section>
      </Collapse>
      <p v-if="loading" class="brief__muted" aria-live="polite">
        Loading today’s brief…
      </p>
      <section v-else-if="error" class="brief__card" role="alert">
        <p class="brief__text">{{ error }}</p>
        <AppButton variant="outline" size="sm" @click="load"
          >Try again</AppButton
        >
      </section>
      <template v-else>
        <div class="brief__body">
          <div v-if="permissions.careLogRead" class="brief__tiles" aria-label="Right now">
            <article v-for="tile in tiles" :key="tile.label" class="brief__tile" :class="`brief__tile--${tile.tone}`">
              <span class="brief__tile-ico" aria-hidden="true"><Icon :name="tile.icon" :size="22" /></span>
              <div>
                <p class="brief__tile-label">{{ tile.label }}</p>
                <p class="brief__tile-value">{{ tile.value }}</p>
                <p class="brief__tile-sub">{{ tile.sub }}</p>
              </div>
            </article>
          </div>

          <aside v-if="permissions.allergyInfo" class="brief__alert" :class="{ 'brief__alert--none': !household?.careBrief?.allergies }" role="note">
            <span class="brief__alert-ico" aria-hidden="true"><Icon name="cross" :size="22" /></span>
            <div>
              <p class="brief__alert-title">Allergies</p>
              <p class="brief__alert-text">{{ household?.careBrief?.allergies || "None listed. Check with a parent if unsure." }}</p>
            </div>
          </aside>

          <div class="brief__content">
            <div class="brief__column">
              <section class="brief__card" aria-labelledby="brief-routine">
                <h2 id="brief-routine">Care routine</h2>
                <ul class="brief__rows">
                  <li v-if="permissions.feedingInstructions" class="brief__row">
                    <span class="brief__row-ico" aria-hidden="true"><Icon name="feed" :size="20" /></span>
                    <div>
                      <h3>Feeding</h3>
                      <p>{{ household?.careBrief?.feeding || "Ask a parent to add feeding instructions." }}</p>
                    </div>
                  </li>
                  <li v-if="permissions.napRoutine" class="brief__row">
                    <span class="brief__row-ico" aria-hidden="true"><Icon name="moon" :size="20" /></span>
                    <div>
                      <h3>Naps</h3>
                      <p>{{ household?.careBrief?.napRoutine || "Ask a parent to add the nap routine." }}</p>
                    </div>
                  </li>
                  <li v-if="permissions.medicationInfo" class="brief__row">
                    <span class="brief__row-ico" aria-hidden="true"><Icon name="medication" :size="20" /></span>
                    <div>
                      <h3>Medication</h3>
                      <p>{{ household?.careBrief?.medications || "No medication instructions listed." }}</p>
                    </div>
                  </li>
                </ul>
                <p v-if="!permissions.feedingInstructions && !permissions.napRoutine && !permissions.medicationInfo" class="brief__muted">
                  Your parents have not enabled access to routine details for your account. Ask them to update your caregiver permissions.
                </p>
              </section>
              <section v-if="permissions.dutyView" class="brief__card" aria-labelledby="brief-duty">
                <h2 id="brief-duty">Duty</h2>
                <ul class="brief__rows">
                  <li class="brief__row">
                    <span class="brief__row-ico" aria-hidden="true"><Icon name="moon" :size="20" /></span>
                    <div>
                      <h3>Tonight</h3>
                      <p v-if="duty.night">
                        {{ duty.night.isMe ? "You are" : `${duty.night.name} is` }} looking after {{ babyName }} tonight. Handover at {{ duty.night.handover }}.
                      </p>
                      <p v-else class="brief__muted">Nobody is set for tonight yet.</p>
                    </div>
                  </li>
                  <li class="brief__row">
                    <span class="brief__row-ico" aria-hidden="true"><Icon name="sun" :size="20" /></span>
                    <div>
                      <h3>Today</h3>
                      <ul v-if="duty.today.length" class="brief__duty">
                        <li v-for="(s, i) in duty.today" :key="i"><strong>{{ s.name }}</strong> {{ s.start }} to {{ s.end }}</li>
                      </ul>
                      <p v-else class="brief__muted">No day shifts are set for today.</p>
                    </div>
                  </li>
                </ul>
              </section>
              <section v-if="permissions.appointments" class="brief__card" aria-labelledby="brief-appointments">
                <h2 id="brief-appointments">Upcoming appointments</h2>
                <ul v-if="selectedAppointments.length" class="brief__rows">
                  <li v-for="appointment in selectedAppointments" :key="appointment.id" class="brief__row">
                    <span class="brief__row-ico" aria-hidden="true"><Icon name="calendar" :size="20" /></span>
                    <div>
                      <h3>{{ appointment.title || "Appointment" }}</h3>
                      <p>{{ appointment.date }}<template v-if="appointment.start"> at {{ appointment.start }}</template></p>
                    </div>
                  </li>
                </ul>
                <p v-else class="brief__muted">No upcoming appointments.</p>
              </section>
            </div>
            <div class="brief__column">
              <section class="brief__card" aria-labelledby="brief-contact">
                <h2 id="brief-contact">Parent contacts</h2>
                <p v-if="!permissions.careBrief" class="brief__muted">
                  Your parents have not enabled parent contact access for your account. Ask them to update your caregiver permissions.
                </p>
                <ul v-else-if="contactRows.length" class="brief__people">
                  <li v-for="(row, i) in contactRows" :key="i" class="brief__person">
                    <template v-if="row.phone">
                      <span class="brief__avatar" aria-hidden="true">{{ (row.who || "P").charAt(0).toUpperCase() }}</span>
                      <div class="brief__person-text">
                        <strong>{{ row.who || "Parent" }}</strong>
                        <span>{{ row.phone }}</span>
                      </div>
                      <a class="brief__call" :href="`tel:${row.phone.replace(/[^\d+]/g, '')}`" :aria-label="`Call ${row.who || 'parent'}`">
                        <Icon name="phone" :size="20" />
                      </a>
                    </template>
                    <p v-else class="brief__text">{{ row.note }}</p>
                  </li>
                </ul>
                <p v-else class="brief__muted">Ask a parent to add contact details.</p>
              </section>
              <div class="brief__logs">
              <section v-if="permissions.careLogAdd || myEntries.length" class="brief__card" aria-labelledby="brief-mine">
                <h2 id="brief-mine">Your recent logs</h2>
                <ul v-if="myEntries.length" class="brief__rows">
                  <li v-for="entry in myEntries" :key="entry.id" class="brief__row">
                    <span class="brief__row-ico" aria-hidden="true"><Icon :name="entry.type === 'feed' ? 'feed' : entry.type === 'sleep' ? 'moon' : entry.type === 'nappy' ? 'diaper' : entry.type === 'medication' ? 'medication' : 'note'" :size="20" /></span>
                    <div>
                      <h3>{{ summariseEntry(entry).title }} <span class="brief__when">{{ entryDay(entry) }}, {{ timeOf(entry) }}</span></h3>
                      <p v-if="summariseEntry(entry).detail">{{ summariseEntry(entry).detail }}</p>
                      <p v-if="summariseEntry(entry).note" class="brief__muted">{{ summariseEntry(entry).note }}</p>
                    </div>
                    <button v-if="canEdit(entry)" type="button" class="brief__row-edit" :aria-label="`Edit ${summariseEntry(entry).title.toLowerCase()} log`" @click="openEdit(entry)">
                      <Icon name="edit" :size="18" />
                    </button>
                  </li>
                </ul>
                <p v-else class="brief__muted">Nothing logged by you yet. Tap Add a care log to start.</p>
              </section>
              </div>
            </div>
          </div>

          <p class="brief__foot">
            This brief shows only the information shared with you. The child’s parents can change or remove your access at any time.
          </p>
        </div>
      </template>
      <CareLogPanel
        :open="panelOpen"
        :entry="editing"
        :initial-type="editing?.type ?? 'feed'"
        :lock-type="Boolean(editing)"
        :saving="panelSaving"
        :error="panelError"
        :allowed-types="careLogTypes"
        caregiver
        @close="closePanel"
        @save="saveCareEntry"
      />
    </main>
  </div>
</template>

<style scoped>
.brief-page {
  min-height: 100vh;
  font-family: var(--bs-body-font-family);
  color: var(--nt-ink);
  background-color: #9fb0d0;
  background-image: radial-gradient(
    rgb(255 255 255 / 35%) 1.5px,
    transparent 1.5px
  );
  background-size: 22px 22px;
}
.brief {
  --navy: #243560;
  --navy-2: #2d3f70;
  --ink: #1f2a52;
  --cream: #fdf9f0;
  --sand: #e9d9b8;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px clamp(16px, 4vw, 64px) 48px;
  color: var(--ink);
}
.brief__hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  align-items: center;
  gap: 36px;
  min-height: 270px;
  padding: 30px 40px;
  overflow: hidden;
  background: var(--navy-2);
  border-radius: 28px;
  border-bottom: 5px solid #182246;
  color: #fff;
}
.brief__hero-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}
.brief__eyebrow {
  margin: 0 0 4px;
  color: #f2a477;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.brief__hero h1 {
  margin: 0;
  color: #fff;
  font-family: var(--nt-serif);
  font-size: clamp(2.5rem, 3.8vw, 3.5rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.025em;
}
.brief__lead {
  margin: 0;
  color: #dfe5f7;
  font-size: 1.25rem;
  line-height: 1.5;
}
.brief__wake { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; background: #f2a477; border: 0; border-bottom: 3px solid #d78251; border-radius: 999px; color: #243560; font: inherit; font-size: 1rem; font-weight: 700; cursor: pointer; }
.brief__wake:hover:not(:disabled) { background: #f5ad84; }
.brief__wake:disabled { opacity: 0.6; cursor: default; }
.brief__wake:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
.brief__hero-status {
  margin: 0;
  color: #dfe5f7;
  font-size: 1rem;
}
.brief__hero-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 260px;
  min-width: 0;
  justify-self: end;
  align-self: start;
}
.brief__art {
  width: 190px;
  margin: 0;
}
.brief__muted {
  color: #6b7392;
}
.brief__household-controls,
.brief__household-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 10px;
}
.brief__household-controls {
  position: relative;
  z-index: 5;
  width: 100%;
}
.brief__household-dropdown {
  position: relative;
  width: 100%;
}
.brief__household-select :deep(.app-control) {
  padding: 8px 12px;
  background: #fff8f1;
  border-color: #aab8d3;
}
.brief__baby-switch {
  min-width: 0;
}
.brief__baby-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.brief__baby-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px 4px 4px;
  background: #fdf3e6;
  border: 1px solid #e3d3bf;
  border-radius: 999px;
  color: #1f3556;
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease;
}
.brief__baby-tab:hover:not(:disabled) {
  background: #fff;
}
.brief__baby-tab.is-active,
.brief__baby-tab.is-active:hover {
  background: #1f3556;
  border-color: #1f3556;
  color: #fdf3e6;
}
.brief__baby-face {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: #f1c9ad;
  border-radius: 50%;
  font-family: var(--nt-serif);
  font-size: 1rem;
  color: #1f3556;
}
.brief__baby-tab:disabled {
  cursor: wait;
  opacity: 0.7;
}
.brief__baby-tab:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
.brief__household-manager h2 {
  margin: 0;
  font-family: var(--nt-serif);
  font-size: 1.5rem;
  font-weight: 700;
}
.brief__household-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 0;
  border-bottom: 1px solid var(--sand);
}
.brief__household-name {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.brief__rename-household {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 8px;
}
.brief__household-actions {
  align-items: center;
}
.brief__join-household {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 10px;
  padding-top: 8px;
}
.brief__lead {
  margin: 10px 0 0;
}
.brief__muted,
.brief__foot {
  margin: 0;
  font-size: 1rem;
}
.brief__foot {
  padding: 16px 22px;
  background: #f9e9ee;
  border: 1px solid #e9b9c6;
  border-bottom-width: 3px;
  border-radius: 18px;
  color: #7a4a4a;
}
.brief__card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px 28px 28px;
  border: 1px solid var(--sand);
  border-bottom-width: 4px;
  border-radius: 24px;
  background: var(--cream);
}
.brief__card h2 {
  margin: 0;
  padding-bottom: 13px;
  border-bottom: 1px solid var(--sand);
  color: var(--ink);
  font-family: var(--nt-serif);
  font-size: 1.85rem;
  font-weight: 700;
}
.brief__item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.brief__item h3 {
  margin: 0;
  color: #a8473f;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.brief__duty {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--nt-muted);
}
.brief__duty strong {
  color: var(--nt-ink, inherit);
}
.brief__item p,
.brief__text,
.brief__contacts p {
  margin: 0;
  color: #4a5272;
  font-size: 1.0625rem;
  line-height: 1.65;
  white-space: pre-wrap;
}
.brief__pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.brief__contacts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.brief__content {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 20px;
}
.brief__column {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}
/* The log card fills what is left of the right column and scrolls inside, so both sides end together. */
.brief__logs {
  position: relative;
  flex: 1;
  min-height: 320px;
}
.brief__logs .brief__card {
  position: absolute;
  inset: 0;
  min-height: 0;
}
.brief__logs .brief__rows {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 6px;
  scrollbar-width: thin;
}
.brief__content > .brief__foot {
  grid-column: 1 / -1;
}
@media (max-width: 767px) {
  .brief__content {
    grid-template-columns: 1fr;
  }
  .brief__logs { min-height: 0; }
  .brief__logs .brief__card { position: static; max-height: 460px; }
}
@media (max-width: 1099px) {
  .brief {
    padding: 24px 16px 64px;
  }
  .brief__hero {
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
    gap: 24px;
    padding: 26px 30px;
  }
  .brief__art {
    width: 140px;
  }
}
@media (max-width: 767px) {
  .brief__hero {
    grid-template-columns: 1fr;
    gap: 20px;
    min-height: 0;
    padding: 24px;
  }
  .brief__hero-side {
    width: 100%;
    justify-self: stretch;
  }
  .brief__art {
    display: none;
  }
}
@media (max-width: 575px) {
  .brief {
    gap: 16px;
  }
  .brief__card {
    padding: 20px 16px;
  }
  .brief__pair {
    grid-template-columns: 1fr;
  }
}

/* The household switcher: one cream pill in the banner, with Manage households inside its menu. */
.brief__household-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: #fffaf2;
  border: 2px solid var(--sand);
  border-bottom-width: 4px;
  border-radius: 999px;
  color: var(--navy);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.brief__household-trigger:hover:not(:disabled) { transform: translateY(-1px); border-color: #f2a477; }
.brief__household-trigger:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.brief__household-label { color: #6b7392; font-size: 0.875rem; font-weight: 600; white-space: nowrap; }
.brief__household-current { flex: 1; min-width: 0; overflow: hidden; font-size: 1.0625rem; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.brief__household-chevron { font-size: 1.1rem; line-height: 1; transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.brief__household-chevron.is-open { transform: rotate(180deg); }
.brief__household-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 1000;
  width: max(100%, 240px);
  padding: 6px;
  background: var(--cream);
  border: 2px solid var(--navy);
  border-bottom-width: 4px;
  border-radius: 20px;
  box-shadow: 0 14px 30px rgb(36 53 96 / 28%);
  transform-origin: top right;
}
.brief__household-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: transparent;
  border: 0;
  border-radius: 14px;
  color: var(--navy);
  text-align: left;
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.14s ease;
}
.brief__household-option:hover, .brief__household-option:focus-visible { outline: none; background: var(--sand); }
.brief__household-option.is-active { background: var(--navy); color: #fff; }
.brief__household-tick { margin-left: auto; }
.brief__household-option--manage { margin-top: 4px; border-top: 1px dashed var(--sand); border-radius: 0 0 14px 14px; padding-top: 12px; color: #8a3f14; }
.hh-pop-enter-active { transition: opacity 0.16s ease, transform 0.26s cubic-bezier(0.34, 1.4, 0.64, 1); }
.hh-pop-leave-active { transition: opacity 0.12s ease, transform 0.14s ease; }
.hh-pop-enter-from, .hh-pop-leave-to { opacity: 0; transform: translateY(-8px) scale(0.96); }

/* The households panel and the buttons inside the cards, in the app's pill style. */
.brief__manager-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.brief__manager-head h2 { padding-bottom: 0; border-bottom: 0; }
.brief__manager-close { width: 38px; height: 38px; background: #fff; border: 1.5px solid var(--sand); border-radius: 50%; font-size: 1.25rem; line-height: 1; color: var(--navy); cursor: pointer; }
.brief__manager-close:hover { border-color: var(--navy); }
.brief__household-row { padding: 16px 18px; margin-top: 4px; background: #fffdf8; border: 1.5px solid var(--sand); border-bottom-width: 4px; border-radius: 20px; }
.brief__household-select { display: flex; flex-direction: column; gap: 6px; font-size: 0.875rem; font-weight: 600; color: var(--navy); }
.brief__household-select :deep(.app-control) { min-height: 46px; padding: 10px 14px; background: #fff; border: 1.5px solid var(--sand); border-radius: 14px; font-weight: 400; color: var(--navy); }
.brief__household-select :deep(.app-control:focus) { border-color: var(--navy); box-shadow: 0 0 0 3px rgb(36 53 96 / 15%); outline: none; }
.brief__join-household { padding: 16px 18px; background: #fffdf8; border: 1.5px dashed #d9c79d; border-radius: 20px; }
.brief__card :deep(button) { border-radius: 999px; font-weight: 700; }
.brief__card :deep(.btn-primary) { padding: 11px 24px; background: var(--navy); border: 0; border-bottom: 3px solid #182246; color: #fff; }
.brief__card :deep(.btn-primary:hover:not(:disabled)) { background: #2c4175; }
.brief__card :deep(.btn-primary:disabled) { opacity: 0.55; }
.brief__card :deep(.btn-outline) { background: #fff; border: 1.5px solid var(--sand); border-bottom-width: 3px; color: var(--navy); }
.brief__card :deep(.btn-outline:hover:not(:disabled)) { border-color: var(--navy); background: #fff; color: var(--navy); }
.brief__card :deep(.brief__leave) { color: #a4541f; border-color: #f2c9a6; }
.brief__card :deep(.brief__leave:hover:not(:disabled)) { background: #fbe3d3; border-color: #f2a477; color: #8a3f14; }
@media (prefers-reduced-motion: reduce) {
  .hh-pop-enter-active, .hh-pop-leave-active, .brief__household-chevron, .brief__household-trigger { transition: none; }
}


.brief__when { margin-left: 6px; color: #6b7392; font-size: 0.9375rem; font-weight: 500; }
/* Right now tiles, allergy alert, row lists, contacts and the floating log button. */
.brief__body { display: flex; flex-direction: column; gap: 20px; }
.brief__tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.brief__tile { --tone: #e9e2d2; display: flex; align-items: center; gap: 16px; padding: 18px 22px; background: var(--cream); border: 1px solid var(--sand); border-bottom-width: 4px; border-radius: 22px; }
.brief__tile--ok { --tone: #b9e4c4; }
.brief__tile--soon { --tone: #f6d88e; }
.brief__tile--due { --tone: #f4a98c; }
.brief__tile--sleep { --tone: #b6c6ea; }
.brief__tile-ico { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 48px; height: 48px; background: var(--tone); border-radius: 50%; color: var(--navy); }
.brief__tile p { margin: 0; }
.brief__tile-label { color: #6b7392; font-size: 0.9375rem; font-weight: 600; }
.brief__tile-value { color: var(--ink); font-family: var(--nt-serif); font-size: 1.75rem; line-height: 1.15; }
.brief__tile-sub { color: #4a5272; font-size: 0.9375rem; }
.brief__alert { display: flex; align-items: center; gap: 16px; padding: 16px 22px; background: #f9e9ee; border: 1px solid #e9b9c6; border-bottom-width: 4px; border-radius: 22px; color: #7a3a45; }
.brief__alert--none { background: var(--cream); border-color: var(--sand); color: #4a5272; }
.brief__alert-ico { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 44px; height: 44px; background: #f4b7c4; border-radius: 50%; color: #7a3a45; }
.brief__alert--none .brief__alert-ico { background: #e9e2d2; color: var(--navy); }
.brief__alert p { margin: 0; }
.brief__alert-title { font-size: 0.9375rem; font-weight: 700; }
.brief__alert-text { font-size: 1.1875rem; font-weight: 600; }
.brief__card h2 { padding-bottom: 0; border-bottom: 0; font-size: 1.5rem; }
.brief__rows, .brief__people { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.brief__row { display: flex; align-items: flex-start; gap: 14px; padding: 14px 0; border-top: 1px solid var(--sand); }
.brief__row:first-child { padding-top: 0; border-top: 0; }
.brief__row-edit { display: inline-flex; flex: none; align-items: center; justify-content: center; align-self: center; width: 38px; height: 38px; margin-left: auto; background: #fff; border: 1.5px solid var(--sand); border-radius: 50%; color: var(--navy); cursor: pointer; transition: border-color 0.14s ease, background-color 0.14s ease; }
.brief__row-edit:hover, .brief__row-edit:focus-visible { outline: none; border-color: var(--navy); background: var(--cream); }
.brief__row-ico { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 40px; height: 40px; background: #f1e4c8; border-radius: 12px; color: var(--navy); }
.brief__row h3 { margin: 0 0 2px; color: var(--ink); font-size: 1rem; font-weight: 700; letter-spacing: 0; text-transform: none; }
.brief__row p { margin: 0; color: #4a5272; font-size: 1.0625rem; line-height: 1.55; }
.brief__person { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-top: 1px solid var(--sand); }
.brief__person:first-child { padding-top: 0; border-top: 0; }
.brief__avatar { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 44px; height: 44px; background: #f1c9ad; border-radius: 50%; color: var(--navy); font-family: var(--nt-serif); font-size: 1.125rem; }
.brief__person-text { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.brief__person-text strong { color: var(--ink); font-size: 1.0625rem; }
.brief__person-text span { color: #4a5272; font-size: 1.0625rem; }
.brief__call { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 46px; height: 46px; background: var(--navy); border-radius: 50%; color: #fff; transition: background-color 160ms ease, transform 160ms ease; }
.brief__call:hover { background: #324580; transform: translateY(-1px); }
.brief__call:focus-visible { outline: 3px solid #f2a477; outline-offset: 2px; }
.brief__foot { padding: 0; background: none; border: 0; color: #2b3b57; font-size: 0.9375rem; text-align: center; }
.brief__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 16px; }
.brief__bar-add { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.brief__bar-error { margin: 0; padding: 8px 14px; background: #f9e9ee; border-radius: 12px; color: #7a3a45; font-size: 0.9375rem; }
.brief__fab { display: inline-flex; align-items: center; gap: 10px; padding: 10px 24px; background: #f2a477; border: 0; border-bottom: 4px solid #d78251; border-radius: 999px; color: #243560; font: inherit; font-size: 1.0625rem; font-weight: 700; cursor: pointer; transition: transform 160ms ease, background-color 160ms ease; }
.brief__fab:hover { background: #f5ad84; transform: translateY(-2px); }
.brief__fab:focus-visible { outline: 3px solid #f2a477; outline-offset: 3px; }
@media (max-width: 767px) {
  .brief__tiles { grid-template-columns: 1fr; }
  .brief__tile-value { font-size: 1.5rem; }
}
@media (prefers-reduced-motion: reduce) { .brief__call, .brief__fab { transition: none; } }

/* Household manager: every row uses the same three columns (name, rename, actions), so the boxes line up. */
.brief__household-row { display: grid; grid-template-columns: 170px minmax(0, 1fr) auto; align-items: end; gap: 12px 24px; }
.brief__household-name { display: flex; flex-direction: column; align-self: center; gap: 2px; min-width: 0; }
.brief__household-name strong { overflow-wrap: anywhere; }
.brief__rename-household { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 10px; min-width: 0; }
.brief__rename-household :deep(button), .brief__household-actions :deep(button) { min-height: 46px; }
.brief__household-actions { display: flex; flex-wrap: nowrap; justify-content: flex-end; align-items: center; gap: 10px; }
.brief__join-household { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 10px; }
.brief__join-household :deep(button) { min-height: 46px; }
@media (max-width: 1099px) {
  .brief__household-row { grid-template-columns: minmax(0, 1fr); }
  .brief__household-actions { justify-content: flex-start; flex-wrap: wrap; }
}
@media (max-width: 575px) {
  .brief__rename-household, .brief__join-household { grid-template-columns: minmax(0, 1fr); }
}
</style>
