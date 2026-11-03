<script setup>
import "@/app/app.css";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import CareLogPanel from "@/app/components/CareLogPanel.vue";
import { useAuth } from "@/app/composables/useAuth";
import { addEntry } from "@/api/entries";
import {
  checkInviteCode,
  getCareBrief,
  getCaregiverHouseholds,
  getMember,
  getRecentCareEntries,
  getUpcomingCareAppointments,
  getUserProfile,
  joinHousehold,
  setActiveCaregiverHousehold,
  setCaregiverHouseholdLabel,
  subscribeCareBrief,
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
    await loadSelectedCareBrief();
    watchDuty(activeHouseholdId);
    if (member.value?.permissions?.careLogRead)
      entries.value = await getRecentCareEntries(activeHouseholdId);
    else entries.value = [];
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

async function saveCareEntry(payload) {
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
</script>

<template>
  <div class="brief-page">
    <main class="brief">
      <header class="brief__hero">
        <div class="brief__hero-copy">
          <p class="brief__eyebrow">Caregiver view{{ caregiverName }}</p>
          <h1>Today’s care brief</h1>
          <p class="brief__lead">
            A quick guide for caring for {{ babyName }}.
          </p>
          <div class="brief__hero-copy-controls">
            <div
              v-if="babies.length > 1"
              class="brief__baby-switch"
              role="group"
              aria-label="Select baby"
            >
              <span>Baby</span>
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
                  {{ baby.babyName || `Baby ${index + 1}` }}
                </button>
              </div>
            </div>
          </div>
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
            <div
              v-if="caregiverHouseholds.length > 1"
              ref="householdDropdownRef"
              class="brief__household-dropdown"
            >
              <button
                type="button"
                class="brief__household-trigger"
                :disabled="householdManagerBusy"
                @click="householdDropdownOpen = !householdDropdownOpen"
              >
                <span>Caregiving for</span>

                <span class="brief__household-current">
                  {{
                    caregiverHouseholds.find(
                      (item) => item.householdId === householdId,
                    )?.label
                  }}
                </span>

                <span
                  class="brief__household-chevron"
                  :class="{ 'is-open': householdDropdownOpen }"
                >
                  ⌄
                </span>
              </button>

              <div v-if="householdDropdownOpen" class="brief__household-menu">
                <button
                  v-for="item in caregiverHouseholds"
                  :key="item.householdId"
                  type="button"
                  class="brief__household-option"
                  :class="{ 'is-active': item.householdId === householdId }"
                  :disabled="householdManagerBusy"
                  @click="
                    switchHousehold(item.householdId);
                    householdDropdownOpen = false;
                  "
                >
                  <span class="brief__household-icon">⌂</span>

                  <span>
                    {{ item.label }}
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div class="brief__hero-actions">
            <AppButton
              variant="outline"
              size="sm"
              :disabled="householdManagerBusy"
              @click="householdManagerOpen = !householdManagerOpen"
              >Manage households</AppButton
            >
          </div>
          <svg class="brief__art" viewBox="0 0 150 180" aria-hidden="true">
            <path
              d="M5 175V75a70 70 0 0 1 140 0v100z"
              fill="#f6e3c4"
              stroke="#e8cf9f"
              stroke-width="4"
            />
            <path d="M20 175V78a55 55 0 0 1 110 0v97z" fill="#b6c6ea" />
            <circle cx="75" cy="85" r="26" fill="#f8dcc0" />
            <path d="M49 82a26 26 0 0 1 52 0z" fill="#f4e6d0" />
            <circle cx="67" cy="90" r="2.5" fill="#2a2f55" />
            <circle cx="83" cy="90" r="2.5" fill="#2a2f55" />
            <path
              d="M69 99q6 5 12 0"
              fill="none"
              stroke="#c76a5a"
              stroke-width="2.5"
              stroke-linecap="round"
            />
            <path d="M45 175c0-28 14-42 30-42s30 14 30 42z" fill="#98aadb" />
          </svg>
        </div>
      </header>
      <section
        v-if="householdManagerOpen"
        class="brief__card brief__household-manager"
        aria-labelledby="brief-households-title"
      >
        <h2 id="brief-households-title">Your caregiving households</h2>
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
              v-if="item.householdId !== householdId"
              variant="outline"
              size="sm"
              :disabled="householdManagerBusy"
              @click="switchHousehold(item.householdId)"
              >Switch to this household</AppButton
            >
            <AppButton
              variant="outline"
              size="sm"
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
            variant="outline"
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
        <div class="brief__content">
          <div class="brief__column">
            <section class="brief__card" aria-labelledby="brief-routine">
              <h2 id="brief-routine">Care routine</h2>
              <div v-if="permissions.feedingInstructions" class="brief__item">
                <h3>Feeding instructions</h3>
                <p>
                  {{
                    household?.careBrief?.feeding ||
                    "Ask a parent to add feeding instructions."
                  }}
                </p>
              </div>
              <div v-if="permissions.careLogRead" class="brief__pair">
                <div class="brief__item">
                  <h3>Last feed</h3>
                  <p>
                    {{
                      latestFeed
                        ? `${timeOf(latestFeed)}${latestFeed.details?.method ? ` · ${latestFeed.details.method}` : ""}`
                        : "No feed logged yet today."
                    }}
                  </p>
                </div>
                <div class="brief__item">
                  <h3>Last diaper change</h3>
                  <p>
                    {{
                      latestNappy
                        ? timeOf(latestNappy)
                        : "No diaper change logged yet today."
                    }}
                  </p>
                </div>
              </div>
              <div v-if="permissions.napRoutine" class="brief__item">
                <h3>Nap routine</h3>
                <p>
                  {{
                    household?.careBrief?.napRoutine ||
                    "Ask a parent to add the nap routine."
                  }}
                </p>
              </div>
              <p
                v-if="
                  !permissions.feedingInstructions &&
                  !permissions.careLogRead &&
                  !permissions.napRoutine
                "
                class="brief__muted"
              >
                Your parents have not enabled access to routine details for your
                account. Ask them to update your caregiver permissions.
              </p>
            </section>
            <section
              v-if="permissions.dutyView"
              class="brief__card"
              aria-labelledby="brief-duty"
            >
              <h2 id="brief-duty">Duty</h2>
              <div class="brief__item">
                <h3>Tonight</h3>
                <p v-if="duty.night">
                  {{
                    duty.night.isMe ? "You are" : `${duty.night.name} is`
                  }}
                  looking after {{ babyName }} tonight. Handover at
                  {{ duty.night.handover }}.
                </p>
                <p v-else class="brief__muted">
                  Nobody is set for tonight yet.
                </p>
              </div>
              <div class="brief__item">
                <h3>Today</h3>
                <ul v-if="duty.today.length" class="brief__duty">
                  <li v-for="(s, i) in duty.today" :key="i">
                    <strong>{{ s.name }}</strong> {{ s.start }} to {{ s.end }}
                  </li>
                </ul>
                <p v-else class="brief__muted">
                  No day shifts are set for today.
                </p>
              </div>
            </section>
            <section class="brief__card" aria-labelledby="brief-contact">
              <h2 id="brief-contact">Parent contacts</h2>
              <p v-if="!permissions.careBrief" class="brief__muted">
                Your parents have not enabled parent contact access for your
                account. Ask them to update your caregiver permissions.
              </p>
              <p
                v-else-if="household?.careBrief?.parentContacts"
                class="brief__text"
              >
                {{ household.careBrief.parentContacts }}
              </p>
              <p v-else class="brief__muted">
                Ask a parent to add contact details.
              </p>
            </section>
          </div>
          <div class="brief__column">
            <section
              v-if="permissions.allergyInfo || permissions.medicationInfo"
              class="brief__card"
              aria-labelledby="brief-health"
            >
              <h2 id="brief-health">Health instructions</h2>
              <div v-if="permissions.allergyInfo" class="brief__item">
                <h3>Allergies</h3>
                <p>
                  {{
                    household?.careBrief?.allergies ||
                    "None listed. Check with a parent if unsure."
                  }}
                </p>
              </div>
              <div v-if="permissions.medicationInfo" class="brief__item">
                <h3>Medication</h3>
                <p>
                  {{
                    household?.careBrief?.medications ||
                    "No medication instructions listed."
                  }}
                </p>
              </div>
            </section>
            <section
              v-if="permissions.careLogAdd"
              class="brief__card"
              aria-labelledby="brief-log"
            >
              <h2 id="brief-log">Care log</h2>
              <p class="brief__muted">
                Record a feed, nap, diaper change, or note for the parents<span
                  v-if="permissions.careLogMedication"
                  >, or record medication when it is given</span
                >.
              </p>
              <AppButton @click="panelOpen = true">Add a care log</AppButton>
              <p v-if="panelError" class="brief__text" role="alert">
                {{ panelError }}
              </p>
            </section>
            <section
              v-if="permissions.appointments"
              class="brief__card"
              aria-labelledby="brief-appointments"
            >
              <h2 id="brief-appointments">Upcoming appointments</h2>
              <div v-if="selectedAppointments.length" class="brief__contacts">
                <p
                  v-for="appointment in selectedAppointments"
                  :key="appointment.id"
                >
                  <strong>{{ appointment.title || "Appointment" }}</strong
                  ><span>
                    · {{ appointment.date
                    }}<template v-if="appointment.start">
                      at {{ appointment.start }}</template
                    ></span
                  >
                </p>
              </div>
              <p v-else class="brief__muted">No upcoming appointments.</p>
            </section>
          </div>
          <p class="brief__foot">
            This brief shows only the information shared with you. The child’s
            parents can change or remove your access at any time.
          </p>
        </div>
      </template>
      <CareLogPanel
        :open="panelOpen"
        :saving="panelSaving"
        :error="panelError"
        :allowed-types="careLogTypes"
        caregiver
        @close="panelOpen = false"
        @save="saveCareEntry"
      />
    </main>
  </div>
</template>

<style scoped>
.brief-page {
  min-height: 100vh;
  padding: 32px clamp(16px, 4vw, 64px) 48px;
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
  max-width: 1320px;
  margin: 0 auto;
  color: var(--ink);
}
.brief__hero {
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
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.brief__hero h1 {
  margin: 0;
  color: #fff;
  font-family: var(--nt-serif);
  font-size: clamp(2.25rem, 3.4vw, 3rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.025em;
}
.brief__lead {
  margin: 0;
  color: #dfe5f7;
  font-size: 1.0625rem;
}
.brief__hero-status {
  margin: 0;
  color: #dfe5f7;
  font-size: 0.875rem;
}
.brief__hero-side {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  align-items: center;
  gap: 14px 18px;
  min-width: 0;
}
.brief__hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.brief__hero-actions :deep(.btn-outline) {
  --bs-btn-color: #fff8f1;
  --bs-btn-bg: transparent;
  --bs-btn-border-color: #aab8d3;
  --bs-btn-hover-color: var(--navy);
  --bs-btn-hover-bg: #fff8f1;
  --bs-btn-hover-border-color: #fff8f1;
}
.brief__hero-actions :deep(.app-btn) {
  width: fit-content;
}
.brief__art {
  grid-column: 2;
  grid-row: 1 / span 2;
  width: 108px;
  height: auto;
  justify-self: center;
  align-self: end;
  margin-bottom: -26px;
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
  align-items: end;
  gap: 10px;
}
.brief__household-dropdown {
  position: relative;
  width: min(100%, 230px);
}
.brief__household-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 0;
  border-radius: 14px;
  background: #182d4d;
  color: #fff;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.brief__household-trigger > span:first-child {
  display: block;
  color: #aebbd3;
  font-size: 0.75rem;
  font-weight: 600;
}

.brief__household-current {
  flex: 1;
  color: #fff;
  font-size: 0.875rem;
  font-weight: 600;
}

.brief__household-chevron {
  font-size: 1.1rem;
  transition: transform 0.2s ease;
}

.brief__household-chevron.is-open {
  transform: rotate(180deg);
}

.brief__household-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 1000;
  width: 100%;
  padding: 5px;
  background: #182d4d;
  border: 2px solid #30476b;
  border-radius: 12px;
  box-shadow: 0 12px 30px rgb(0 0 0 / 25%);
}

.brief__household-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #dfe5f7;
  text-align: left;
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}

.brief__household-option:hover,
.brief__household-option.is-active {
  background: #243b60;
  color: #fff;
}

.brief__household-option:disabled {
  cursor: wait;
  opacity: 0.7;
}

.brief__household-icon {
  width: 20px;
  font-size: 1.1rem;
  text-align: center;
}
.brief__household-select :deep(.app-control) {
  padding: 8px 12px;
  background: #fff8f1;
  border-color: #aab8d3;
}
.brief__baby-switch {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  color: #dfe5f7;
  font-size: 0.75rem;
  font-weight: 600;
}
.brief__baby-tabs {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  padding: 4px;
  overflow-x: auto;
  background: #fffaf2;
  border: 2px solid #e9d9b8;
  border-radius: 999px;
}
.brief__baby-tab {
  flex: 0 0 auto;
  padding: 7px 16px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.brief__baby-tab.is-active {
  background: var(--navy);
  color: #fff;
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
  font-size: 0.9rem;
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
  font-size: 1.65rem;
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
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.1em;
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
  line-height: 1.6;
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
  align-items: start;
  gap: 20px;
}
.brief__column {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}
.brief__content > .brief__foot {
  grid-column: 1 / -1;
}
@media (max-width: 767px) {
  .brief__content {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
@media (max-width: 1099px) {
  .brief-page {
    padding: 24px 16px 64px;
  }
  .brief__hero {
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
    gap: 24px;
    padding: 26px 30px;
  }
  .brief__hero-side {
    grid-template-columns: minmax(0, 1fr) 88px;
  }
  .brief__art {
    width: 88px;
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
    grid-template-columns: 1fr;
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
</style>
