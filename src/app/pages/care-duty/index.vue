<script setup>
import "@/app/app.css";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import CaregiverTopBar from "@/app/components/CaregiverTopBar.vue";
import DaySchedule from "@/app/components/DaySchedule.vue";
import PageHero from "@/app/components/PageHero.vue";
import { useAuth } from "@/app/composables/useAuth";
import { getCaregiverHouseholds, getHouseholdMembers, subscribeMember } from "@/api/profile";
import { saveRotaSettings, subscribeNights, subscribeRotaSettings } from "@/api/rota";
import { buildRotaView } from "@/app/utils/homeSummary";
import { isPrimaryParent } from "@/app/utils/caregiverHelpers";
import { addDays, mondayOf, toIso } from "@/app/utils/rotaHelpers";
import { cleanShifts, toHhmm } from "@/app/utils/scheduleHelpers";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "CareDutyPage" });

// The parents' Duty page, read only: the same week calendar and night band, from the carer's side.
// Only carers whose parent turned on "duty" can open it.
const { currentUser } = useAuth();
const router = useRouter();
const loading = ref(true);
const error = ref("");
const allowed = ref(false);
const settings = ref(null);
const nights = ref({});
const members = ref([]);
const stops = [];
const householdId = ref("");
const canEdit = ref(false);
const saveError = ref("");

const meUid = computed(() => currentUser.value?.uid ?? "");
const parents = computed(() => members.value.filter((m) => isPrimaryParent(m)));
const firstName = (m) => {
  const word = String(m?.displayName ?? "").trim().split(/\s+/)[0] || "";
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
};
const nameOfUid = (uid) => firstName(members.value.find((m) => m.uid === uid)) || "A parent";

// The calendar speaks in "me", "partner", "both" and "other". Here "me" is the carer, and the
// parents are shown by name as "other", so they read as someone else.
const view = computed(() => {
  const base = buildRotaView({ rotaSettings: settings.value ?? {}, nights: nights.value, swaps: [], uid: parents.value[0]?.uid ?? "", hasPartner: parents.value.length > 1 });
  const raw = Array.isArray(settings.value?.schedule) ? settings.value.schedule : [];
  const mapped = raw.map((s) => {
    if (s?.who === "both") return { ...s, who: "both" };
    if (s?.who === "other") return { ...s, who: "other" };
    if (s?.who === meUid.value) return { ...s, who: "me" };
    return { ...s, who: "other", label: nameOfUid(s?.who) };
  });
  return { ...base, schedule: cleanShifts(mapped) };
});

// Saving writes the carer's own shifts back as her uid, and keeps every parent's shift under the
// parent's uid, so renaming for display never changes who a shift belongs to.
async function saveSchedule(next) {
  saveError.value = "";
  const raw = Array.isArray(settings.value?.schedule) ? settings.value.schedule : [];
  const stored = cleanShifts(next)
    .map((s) => {
      const was = raw.find((r) => r.id === s.id);
      let who = s.who;
      if (who === "me") who = meUid.value;
      else if (who === "other" && was && !["both", "other", meUid.value].includes(was.who) && s.label === nameOfUid(was.who)) who = was.who;
      return { id: s.id, day: s.day, start: toHhmm(s.start), end: toHhmm(s.end), who, label: s.who === "other" && who === "other" ? s.label : "" };
    })
    .filter((s) => s.who);
  try {
    await saveRotaSettings(householdId.value, meUid.value, { schedule: stored });
  } catch (cause) {
    console.error("[app care duty save]", cause?.code, cause);
    saveError.value =
      cause?.code === "permission-denied"
        ? "You can’t change the schedule right now. Ask a parent to check your access."
        : "We couldn’t save that change. Try again.";
  }
}

// Reword each night the same way. A night set by hand to this carer is "You".
function resolveNight(night) {
  const set = nights.value?.[night.date]?.onCall;
  if (set && set === meUid.value) return { ...night, who: "me", shared: false, second: undefined };
  const person = (kind) => {
    if (kind === "me") return { who: "other", label: nameOfUid(parents.value[0]?.uid) };
    if (kind === "partner") return { who: "other", label: nameOfUid(parents.value[1]?.uid) };
    return { who: kind, label: night.label };
  };
  const first = person(night.who);
  const out = { ...night, ...first };
  if (night.shared && night.second) {
    out.second = person(night.second).who;
  }
  return out;
}

const babyLabel = "the baby";

function stopAll() {
  while (stops.length) stops.pop()?.();
}
function watchDuty(hid) {
  const today = toIso(new Date());
  stops.push(
    subscribeRotaSettings(hid, (data) => { settings.value = data; }, () => {}),
    subscribeNights(
      hid,
      addDays(mondayOf(today), -14),
      addDays(mondayOf(today), 56),
      (list) => { nights.value = Object.fromEntries(list.map((n) => [n.date, n])); },
      () => {},
    ),
  );
}

onMounted(async () => {
  try {
    const uid = currentUser.value?.uid;
    const homes = uid ? await getCaregiverHouseholds(uid) : [];
    const active = homes.find((h) => h.active) ?? homes[0];
    if (!active) {
      router.replace(ROUTES.CARE_BRIEF);
      return;
    }
    const hid = active.householdId;
    householdId.value = hid;
    // Live: if the parent switches duty access off while this page is open, send the carer back.
    stops.push(
      subscribeMember(
        hid,
        uid,
        (me) => {
          if (!me || me.permissions?.dutyView !== true) {
            allowed.value = false;
            router.replace(ROUTES.CARE_BRIEF);
            return;
          }
          canEdit.value = me.permissions?.dutyEdit === true;
          if (!allowed.value) {
            allowed.value = true;
            watchDuty(hid);
            getHouseholdMembers(hid).then((list) => { members.value = list; }).catch(() => {});
          }
          loading.value = false;
        },
        () => {
          error.value = "We couldn’t load the duty schedule. Check your connection and try again.";
          loading.value = false;
        },
      ),
    );
  } catch (cause) {
    console.error("[app care duty]", cause?.code, cause);
    error.value = "We couldn’t load the duty schedule. Check your connection and try again.";
    loading.value = false;
  }
});
onUnmounted(stopAll);
</script>

<template>
  <div class="duty-page">
    <CaregiverTopBar :show-duty="allowed" />
    <main class="duty">
      <PageHero eyebrow="Caregiver view" title="Duty" :lead="`Who is looking after ${babyLabel}, day and night.`" />

      <p v-if="error" class="duty__note" role="alert">{{ error }}</p>
      <p v-else-if="loading" class="duty__note" role="status">Loading the schedule…</p>
      <section v-else class="duty__card" aria-labelledby="duty-day">
        <h2 id="duty-day" class="duty__h2">Day</h2>
        <p class="duty__muted">
          Who looks after {{ babyLabel }} from 6 AM to 6 PM.
          {{ canEdit ? "Tap or drag on a day to add your shifts." : "Your parents keep this up to date." }}
        </p>
        <p v-if="saveError" class="duty__error" role="alert">{{ saveError }}</p>
        <DaySchedule
          :readonly="!canEdit"
          :allow-both="false"
          :rota="view"
          :resolve-night="resolveNight"
          :names="{ me: 'You', partner: 'Partner' }"
          :baby-label="babyLabel"
          @save="saveSchedule"
        />
      </section>
    </main>
  </div>
</template>

<style scoped>
.duty-page {
  min-height: 100vh;
  font-family: var(--bs-body-font-family);
  color: var(--nt-ink);
  background-color: #9fb0d0;
  background-image: radial-gradient(rgb(255 255 255 / 35%) 1.5px, transparent 1.5px);
  background-size: 22px 22px;
}
.duty {
  --navy: #243560;
  --navy-2: #2d3f70;
  --ink: #1f2a52;
  --cream: #fdf9f0;
  --sand: #e9d9b8;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 1020px;
  margin: 0 auto;
  padding: 32px clamp(16px, 4vw, 32px) 48px;
  color: var(--ink);
}
.duty__card,
.duty__note {
  background: var(--cream);
  border: 1px solid var(--sand);
  border-bottom-width: 4px;
  border-radius: 24px;
  padding: 24px 28px 28px;
}
.duty__card { display: flex; flex-direction: column; gap: 14px; }
.duty__note { margin: 0; font-size: 1.0625rem; }
.duty__h2 { margin: 0; font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 700; color: var(--ink); }
.duty__error { margin: 0; padding: 10px 14px; background: #fbe3d3; border-radius: 12px; color: #8a3f14; font-size: 0.9375rem; }
.duty__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: #6b7392; }
@media (max-width: 767px) {
  .duty__card, .duty__note { padding: 20px 16px; }
}
</style>
