<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import Header from "@/app/components/Header.vue";
import StepHeader from "@/app/components/StepHeader.vue";
import OptionCard from "@/app/components/OptionCard.vue";
import Field from "@/app/components/Field.vue";
import BabyFields from "@/app/components/BabyFields.vue";
import AddBabyForm from "@/app/components/AddBabyForm.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { SAMPLE } from "@/shared/constants/appConstants";
import { ROUTES } from "@/app/routes";
import { useAuth } from "@/app/composables/useAuth";
import {
  babySummary,
  createHousehold,
  getHouseholdBabies,
  getHouseholdInviteCode,
  joinHousehold,
} from "@/api/profile";
import "@/app/app.css";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";

defineOptions({ name: "HouseholdPage" });

const { currentUser, authProfile, loadProfile } = useAuth();
const route = useRoute();

const { loadBabies: refreshSidebarBabies } = useSelectedBaby();

const loaded = ref(false);
// An invite link (/join/NT-XXXX) lands here with ?code= and opens the join form.
const linkCode = typeof route?.query?.code === "string" ? route.query.code : "";
const mode = ref(linkCode ? "join" : "create"); // create | join
const code = ref(linkCode);
const codeError = ref("");
const error = ref("");
const busy = ref(false);
const result = ref(null); // { kind: "created" | "joined", inviteCode }
const copied = ref(false);
const baby = ref({ name: "", status: "born", date: "" }); // the first baby, asked while creating
let copiedTimer = null;

const householdId = ref("");
const babies = ref([]);
const showAddBaby = ref(false);
const babyAdded = ref("");

async function loadBabies() {
  try {
    babies.value = await getHouseholdBabies(householdId.value);
  } catch {
    babies.value = [];
  }
}

async function onBabyAdded(name) {
  babyAdded.value = name;
  showAddBaby.value = false;
  await loadBabies();
  await refreshSidebarBabies(householdId.value);
}

const ready = computed(() => result.value !== null);
const joined = computed(() => result.value?.kind === "joined");
const inviteCode = computed(() => result.value?.inviteCode ?? null);

const title = computed(() => {
  if (!ready.value) return "Set up your shared space";
  return joined.value ? "You have joined the household" : "Your household is ready";
});
const lead = computed(() => {
  if (!ready.value) {
    return `A household connects care logs, tasks and appointments for the people supporting ${baby.value.name.trim() || "your baby"}.`;
  }
  if (joined.value) return "You can now see what your partner shares.";
  return inviteCode.value
    ? "Share this code with your partner. They enter it after creating their account."
    : "Your household is set up.";
});

onMounted(async () => {
  try {
    const profile = await loadProfile();
    if (profile?.householdId) {
      let existing = null;
      try {
        existing = await getHouseholdInviteCode(profile.householdId);
      } catch {
        existing = null;
      }
      result.value = { kind: "created", inviteCode: existing };
      householdId.value = profile.householdId;
      await loadBabies();
    }
  } catch {
    // If the profile cannot be read, fall back to the choice screen.
  } finally {
    loaded.value = true;
  }
});

onBeforeUnmount(() => clearTimeout(copiedTimer));

function selectMode(value) {
  mode.value = value;
  error.value = "";
  codeError.value = "";
}

function onKeydown(event) {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const next = mode.value === "create" ? "join" : "create";
  selectMode(next);
  event.currentTarget.querySelector(`[data-mode="${next}"]`)?.focus();
}

async function submit() {
  if (busy.value) return;
  error.value = "";
  codeError.value = "";
  const user = currentUser.value;
  if (!user) {
    error.value = "Sign in again to continue.";
    return;
  }
  if (mode.value === "join" && !code.value.trim()) {
    codeError.value = "Enter the invitation code from your partner.";
    return;
  }
  busy.value = true;
  try {
    if (mode.value === "create") {
      const created = await createHousehold(user, {
        babyName: baby.value.name,
        babyStatus: baby.value.status,
        babyDate: baby.value.date,
      });
      result.value = { kind: "created", inviteCode: created.inviteCode };
      householdId.value = created.householdId;
    } else {
      const joinedHousehold = await joinHousehold(user, code.value);
      result.value = { kind: "joined", inviteCode: null };
      householdId.value = joinedHousehold.householdId;
    }
    await loadBabies();
    if (authProfile.value) authProfile.value = { ...authProfile.value, onboarded: true };
  } catch (cause) {
    // Invite errors already carry a sentence for the user (see inviteHelpers.js).
    error.value = String(cause?.code ?? "").startsWith("invite/")
      ? cause.message
      : "Something went wrong. Please try again.";
  } finally {
    busy.value = false;
  }
}

async function copyCode() {
  if (!inviteCode.value) return;
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
</script>

<template>
  <Header />
  <main class="app-container app-body">
    <div v-if="loaded" class="hh">
      <div class="app-stack app-stack--24 hh__main">
        <StepHeader :step="4" :title="title" :lead="lead" />

        <div class="hh__card app-stack app-stack--24">
        <template v-if="!ready">
          <form class="app-stack app-stack--24 w-100" novalidate :aria-busy="busy" @submit.prevent="submit">
            <div class="hh__options" role="radiogroup" aria-label="Household setup" @keydown="onKeydown">
              <OptionCard
                variant="radio"
                data-mode="create"
                title="Create household"
                description="Set up a shared space and invite your partner."
                :selected="mode === 'create'"
                :tabindex="mode === 'create' ? 0 : -1"
                @select="selectMode('create')"
              />
              <OptionCard
                variant="radio"
                data-mode="join"
                title="Join a household"
                description="Enter the invitation code from your partner."
                :selected="mode === 'join'"
                :tabindex="mode === 'join' ? 0 : -1"
                @select="selectMode('join')"
              />
            </div>
            <div v-if="mode === 'create'" class="app-stack app-stack--24 w-100">
              <BabyFields v-model="baby" id-prefix="app-baby" hint="You can change this later." :disabled="busy" />
              <p class="hh__hint">Twins or more? You can add each baby on the next step.</p>
            </div>
            <Field
              v-if="mode === 'join'"
              id="app-invite-code"
              v-model="code"
              label="Invitation code"
              :placeholder="SAMPLE.inviteCode"
              autocomplete="off"
              hint="Ask your partner for the code on their screen."
              :error="codeError"
              :disabled="busy"
            />
            <div v-if="error" class="alert alert-danger app-alert" role="alert">{{ error }}</div>
            <button type="submit" class="app-btn app-btn--primary" :disabled="busy">
              {{ busy ? "Setting up..." : "Continue setup" }}
            </button>
          </form>
          <AppLink :to="ROUTES.ACCOUNT" class="app-text-link">Back</AppLink>
        </template>

        <template v-else>
                    <div v-if="babies.length" class="hh__babies">
            <h3 class="hh__babies-title">Your babies</h3>
            <ul class="hh__babies-list">
              <li v-for="(baby, i) in babies" :key="baby.id">
                <strong>{{ baby.babyName || `Baby ${i + 1}` }}</strong>
                <span v-if="babySummary(baby).line"> · {{ babySummary(baby).line }}</span>
              </li>
            </ul>
          </div>

          <p v-if="babyAdded" class="app-text-link" role="status">{{ babyAdded }} was added.</p>

          <button v-if="!showAddBaby" type="button" class="app-btn app-btn--outline" @click="showAddBaby = true">
            Add another baby
          </button>
          <AddBabyForm v-else :household-id="householdId" @added="onBabyAdded" @cancel="showAddBaby = false" />
          <div v-if="!joined && inviteCode" class="hh__code" aria-label="Invitation code">
            <p class="hh__code-text">{{ inviteCode }}</p>
          </div>
          <div class="hh__actions">
            <RouterLink :to="ROUTES.HOME" class="app-btn" :class="showAddBaby ? 'app-btn--outline' : 'app-btn--primary'">Go to home</RouterLink>
            <button
              v-if="!joined && inviteCode"
              type="button"
              class="app-btn app-btn--outline"
              aria-live="polite"
              @click="copyCode"
            >
              {{ copied ? "Copied" : "Copy code" }}
            </button>
          </div>
        </template>
        </div>
      </div>

      <aside class="hh__aside" aria-labelledby="shared-title">
        <h2 id="shared-title" class="hh__aside-title">What is shared?</h2>
        <div class="hh__shared">
          <p class="hh__shared-label">Shared</p>
          <p class="hh__shared-text">Care logs, tasks, appointments and return-to-work plans.</p>
        </div>
        <div class="hh__private">
          <p class="hh__private-label">Private</p>
          <p class="hh__private-text">Wellness check-ins and personal reflections.</p>
        </div>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.hh { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 32px; align-items: start; }
.hh__card { width: 100%; padding: 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.hh__main { min-width: 0; }
.hh__options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; width: 100%; }
.hh__code { display: flex; align-items: center; justify-content: center; width: 100%; padding: 32px 48px; background: var(--nt-gray); border-radius: 12px; }
.hh__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.hh__code-text { margin: 0; font-family: var(--nt-serif); font-size: 40px; line-height: normal; letter-spacing: 0.8px; color: var(--nt-plum); }

.hh__aside { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 20px; padding: 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.hh__aside-title { margin: 0; font-size: 1.125rem; font-weight: 600; line-height: 1.3; color: var(--nt-ink); }
.hh__shared { display: flex; flex-direction: column; gap: 4px; padding-bottom: 20px; border-bottom: 1px solid var(--nt-line); }
.hh__shared-label { margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--nt-ink); }
.hh__shared-text { margin: 0; font-size: 0.875rem; line-height: 21px; color: var(--nt-muted); }
.hh__private { display: flex; flex-direction: column; gap: 6px; padding: 16px 16px 18px; background: var(--nt-butter); border: 1.5px dashed var(--nt-butter-d); border-radius: 8px; font-size: 0.875rem; }
.hh__private-label { margin: 0; font-weight: 600; color: var(--nt-butter-d); }
.hh__private-text { margin: 0; line-height: 21px; color: var(--nt-ink); }
.hh__hint { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.hh__babies { width: 100%; padding: 16px; background: var(--nt-gray); border-radius: 8px; }
.hh__babies-title { margin: 0 0 8px; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }
.hh__babies-list { margin: 0; padding-left: 20px; font-size: 0.875rem; line-height: 24px; color: var(--nt-ink); }

@media (max-width: 1099px) {
  .hh { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .hh__aside { position: static; }
}
@media (max-width: 575px) {
  .hh__options { grid-template-columns: minmax(0, 1fr); }
  .hh__code { padding: 24px; }
  .hh__code-text { font-size: 32px; }
}
</style>
