<script setup>
import "@/app/app.css";
import { computed, onMounted, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import CareLogPanel from "@/app/components/CareLogPanel.vue";
import { useAuth } from "@/app/composables/useAuth";
import { addEntry } from "@/api/entries";
import { getCareBrief, getMember, getRecentCareEntries, getUpcomingCareAppointments, getUserProfile } from "@/api/profile";

defineOptions({ name: "CareBriefPage" });

const { currentUser } = useAuth();
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

const babyName = computed(() => household.value?.careBrief?.babyName || "your baby");
const caregiverName = computed(() => profile.value?.displayName ? ` for ${profile.value.displayName}` : "");
const permissions = computed(() => member.value?.permissions ?? {});
function asDate(value) {
  if (value?.toDate) return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function timeOf(entry) {
  const date = asDate(entry?.at);
  return date ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date) : "Time unavailable";
}
const latestFeed = computed(() => entries.value.find((entry) => entry.type === "feed") ?? null);
const latestNappy = computed(() => entries.value.find((entry) => entry.type === "nappy") ?? null);
const careLogTypes = computed(() => ["feed", "sleep", "nappy", "note", ...(permissions.value.careLogMedication ? ["medication"] : [])]);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const uid = currentUser.value?.uid;
    const loadedProfile = uid ? await getUserProfile(uid) : null;
    if (!loadedProfile?.householdId) throw new Error("This invitation is no longer linked to a household.");
    const loadedMember = await getMember(loadedProfile.householdId, uid);
    const careBrief = await getCareBrief(loadedProfile.householdId, {
      routine: loadedMember?.permissions?.napRoutine === true,
      feeding: loadedMember?.permissions?.feedingInstructions === true,
      contacts: loadedMember?.permissions?.careBrief === true,
      child: loadedMember?.permissions?.careBrief === true,
      allergies: loadedMember?.permissions?.allergyInfo === true,
      medications: loadedMember?.permissions?.medicationInfo === true,
    });
    member.value = loadedMember;
    profile.value = loadedProfile;
    householdId.value = loadedProfile.householdId;
    household.value = { careBrief };
    if (member.value?.permissions?.careLogRead) entries.value = await getRecentCareEntries(loadedProfile.householdId);
    if (member.value?.permissions?.appointments) appointments.value = await getUpcomingCareAppointments(loadedProfile.householdId);
  } catch (cause) {
    console.error("[app care brief]", cause?.code, cause);
    error.value = cause?.code === "permission-denied"
      ? "Some information in this brief is not shared with you. Ask a parent to update your access."
      : cause.message || "We could not load your care brief. Check your connection and try again.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function saveCareEntry(payload) {
  if (!member.value?.permissions?.careLogAdd || panelSaving.value) return;
  panelSaving.value = true;
  panelError.value = "";
  try {
    if (payload.type === "medication" && !member.value?.permissions?.careLogMedication) throw new Error("Medication logging is not shared with you.");
    await addEntry({ uid: currentUser.value.uid }, householdId.value, {
      ...payload,
      byName: profile.value?.displayName || currentUser.value?.displayName || "Caregiver",
    });
    panelOpen.value = false;
    await load();
  } catch (cause) {
    console.error("[app caregiver log]", cause?.code, cause);
    panelError.value = cause?.code === "permission-denied"
      ? "Your care log access changed. Ask a parent to check your permissions."
      : "Could not save this care log. Check your connection and try again.";
  } finally {
    panelSaving.value = false;
  }
}
</script>

<template>
  <main class="brief">
    <header class="brief__head">
      <p class="brief__eyebrow">NurtureTrack · Caregiver view</p>
      <h1 class="nt-title">Today’s care brief{{ caregiverName }}</h1>
      <p class="brief__lead">A quick guide for caring for {{ babyName }}.</p>
    </header>
    <p v-if="loading" class="brief__muted" aria-live="polite">Loading today’s brief…</p>
    <section v-else-if="error" class="brief__card" role="alert">
      <p class="brief__text">{{ error }}</p>
      <AppButton variant="outline" size="sm" @click="load">Try again</AppButton>
    </section>
    <template v-else>
      <section class="brief__card" aria-labelledby="brief-routine">
        <h2 id="brief-routine">Care routine</h2>
        <div v-if="permissions.feedingInstructions" class="brief__item">
          <h3>Usual feeding method</h3>
          <p>{{ household?.careBrief?.feeding || "Ask a parent to add feeding instructions." }}</p>
        </div>
        <div v-if="permissions.careLogRead" class="brief__pair">
          <div class="brief__item"><h3>Last feed</h3><p>{{ latestFeed ? `${timeOf(latestFeed)}${latestFeed.details?.method ? ` · ${latestFeed.details.method}` : ""}` : "No feed logged yet today." }}</p></div>
          <div class="brief__item"><h3>Last diaper change</h3><p>{{ latestNappy ? timeOf(latestNappy) : "No diaper change logged yet today." }}</p></div>
        </div>
        <div v-if="permissions.napRoutine" class="brief__item">
          <h3>Nap routine</h3>
          <p>{{ household?.careBrief?.napRoutine || "Ask a parent to add the nap routine." }}</p>
        </div>
        <p v-if="!permissions.feedingInstructions && !permissions.careLogRead && !permissions.napRoutine" class="brief__muted">Your parents have not shared routine details for this brief.</p>
      </section>
      <section v-if="permissions.allergyInfo || permissions.medicationInfo" class="brief__card" aria-labelledby="brief-health">
        <h2 id="brief-health">Health instructions</h2>
        <div v-if="permissions.allergyInfo" class="brief__item"><h3>Allergies</h3><p>{{ household?.careBrief?.allergies || "None listed. Check with a parent if unsure." }}</p></div>
        <div v-if="permissions.medicationInfo" class="brief__item"><h3>Medication</h3><p>{{ household?.careBrief?.medications || "No medication instructions listed." }}</p></div>
      </section>
      <section class="brief__card" aria-labelledby="brief-contact">
        <h2 id="brief-contact">Parent contacts</h2>
        <p v-if="permissions.careBrief && household?.careBrief?.parentContacts" class="brief__text">{{ household.careBrief.parentContacts }}</p>
        <p v-else class="brief__muted">Ask a parent to add contact details.</p>
      </section>
      <section v-if="permissions.careLogAdd" class="brief__card" aria-labelledby="brief-log">
        <h2 id="brief-log">Care log</h2>
        <p class="brief__muted">Record a feed, nap, diaper change, or note for the parents<span v-if="permissions.careLogMedication">, or record medication when it is given</span>.</p>
        <AppButton @click="panelOpen = true">Add a care log</AppButton>
        <p v-if="panelError" class="brief__text" role="alert">{{ panelError }}</p>
      </section>
      <section v-if="permissions.appointments" class="brief__card" aria-labelledby="brief-appointments">
        <h2 id="brief-appointments">Upcoming appointments</h2>
        <div v-if="appointments.length" class="brief__contacts"><p v-for="appointment in appointments" :key="appointment.id"><strong>{{ appointment.title || "Appointment" }}</strong><span> · {{ appointment.date }}<template v-if="appointment.start"> at {{ appointment.start }}</template></span></p></div>
        <p v-else class="brief__muted">No upcoming appointments.</p>
      </section>
      <p class="brief__foot">This brief shows only the information shared with you. The child’s parents can change or remove your access at any time.</p>
    </template>
    <CareLogPanel :open="panelOpen" :saving="panelSaving" :error="panelError" :allowed-types="careLogTypes" @close="panelOpen = false" @save="saveCareEntry" />
  </main>
</template>

<style scoped>
.brief { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
.brief__head { padding: 12px 0 4px; }
.brief__eyebrow { margin: 0 0 8px; color: var(--nt-muted); font-size: .875rem; }
.brief h1 { margin: 0; font-size: clamp(2rem, 5vw, 2.75rem); }
.brief__lead, .brief__muted, .brief__foot { color: var(--nt-muted); line-height: 1.5; }
.brief__lead { margin: 10px 0 0; }
.brief__muted, .brief__foot { margin: 0; font-size: .9rem; }
.brief__foot { text-align: center; }
.brief__card { display: flex; flex-direction: column; gap: 16px; padding: 24px; border: 1px solid var(--nt-line); border-radius: 12px; background: #fff; }
.brief__card h2 { margin: 0; font-size: 1.15rem; }
.brief__item { display: flex; flex-direction: column; gap: 5px; }
.brief__item h3 { margin: 0; font-size: .9rem; }
.brief__item p, .brief__text, .brief__contacts p { margin: 0; color: var(--nt-muted); line-height: 1.5; white-space: pre-wrap; }
.brief__pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.brief__contacts { display: flex; flex-direction: column; gap: 8px; }
@media (max-width: 575px) { .brief__card { padding: 20px 16px; } .brief__pair { grid-template-columns: 1fr; } }
</style>
