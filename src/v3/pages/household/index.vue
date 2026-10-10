<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import V3Header from "@/v3/components/V3Header.vue";
import StepHeader from "@/v3/components/StepHeader.vue";
import OptionCard from "@/v3/components/OptionCard.vue";
import V3Field from "@/v3/components/V3Field.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { SAMPLE } from "@/shared/constants/appConstants";
import { V3_ROUTES } from "@/v3/routes";
import { useV3Auth } from "@/v3/composables/useV3Auth";
import { createHousehold, getHouseholdInviteCode, joinHousehold } from "@/v3/api/profile";
import "@/v3/v3.css";

defineOptions({ name: "V3HouseholdPage" });

const { currentUser, v3Profile, loadProfile } = useV3Auth();
const route = useRoute();

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
const babyName = ref("");
const babyStatus = ref("born"); // born | expected
const babyDate = ref("");
const todayIso = (() => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();
const dateLabel = computed(() => (babyStatus.value === "born" ? "Date of birth" : "Due date"));
const dateMax = computed(() => (babyStatus.value === "born" ? todayIso : undefined));
const dateMin = computed(() => (babyStatus.value === "expected" ? todayIso : undefined));
let copiedTimer = null;

const ready = computed(() => result.value !== null);
const joined = computed(() => result.value?.kind === "joined");
const inviteCode = computed(() => result.value?.inviteCode ?? null);

const title = computed(() => {
  if (!ready.value) return "Set up your shared space";
  return joined.value ? "You have joined the household" : "Your household is ready";
});
const lead = computed(() => {
  if (!ready.value) {
    return `A household connects care logs, tasks and appointments for the people supporting ${babyName.value.trim() || "your baby"}.`;
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

function onStatusKeydown(event) {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const next = babyStatus.value === "born" ? "expected" : "born";
  babyStatus.value = next;
  event.currentTarget.querySelector(`[data-status="${next}"]`)?.focus();
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
        babyName: babyName.value,
        babyStatus: babyStatus.value,
        babyDate: babyDate.value,
      });
      result.value = { kind: "created", inviteCode: created.inviteCode };
    } else {
      await joinHousehold(user, code.value);
      result.value = { kind: "joined", inviteCode: null };
    }
    if (v3Profile.value) v3Profile.value = { ...v3Profile.value, onboarded: true };
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
  <V3Header />
  <main class="v3-container v3-body">
    <div v-if="loaded" class="hh">
      <div class="v3-stack v3-stack--24 hh__main">
        <StepHeader :step="4" :title="title" :lead="lead" />

        <template v-if="!ready">
          <form class="v3-stack v3-stack--24 w-100" novalidate :aria-busy="busy" @submit.prevent="submit">
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
            <div v-if="mode === 'create'" class="v3-stack v3-stack--24 w-100">
              <V3Field
                id="v3-baby-name"
                v-model="babyName"
                label="Baby's name (optional)"
                autocomplete="off"
                hint="You can change this later."
                :disabled="busy"
              />
              <div class="hh__status" role="radiogroup" aria-label="Baby status" @keydown="onStatusKeydown">
                <button
                  v-for="opt in [{ value: 'born', label: 'Baby is here' }, { value: 'expected', label: 'Baby is on the way' }]"
                  :key="opt.value"
                  type="button"
                  role="radio"
                  class="hh__seg"
                  :class="{ 'hh__seg--on': babyStatus === opt.value }"
                  :data-status="opt.value"
                  :aria-checked="babyStatus === opt.value"
                  :tabindex="babyStatus === opt.value ? 0 : -1"
                  :disabled="busy"
                  @click="babyStatus = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
              <div class="v3-field">
                <label class="v3-field__label" for="v3-baby-date">{{ dateLabel }} (optional)</label>
                <input
                  id="v3-baby-date"
                  v-model="babyDate"
                  class="v3-input"
                  type="date"
                  :min="dateMin"
                  :max="dateMax"
                  :disabled="busy"
                />
              </div>
            </div>
            <V3Field
              v-if="mode === 'join'"
              id="v3-invite-code"
              v-model="code"
              label="Invitation code"
              :placeholder="SAMPLE.inviteCode"
              autocomplete="off"
              hint="Ask your partner for the code on their screen."
              :error="codeError"
              :disabled="busy"
            />
            <div v-if="error" class="alert alert-danger v3-alert" role="alert">{{ error }}</div>
            <button type="submit" class="v3-btn v3-btn--primary" :disabled="busy">
              {{ busy ? "Setting up..." : "Continue setup" }}
            </button>
          </form>
          <AppLink :to="V3_ROUTES.ACCOUNT" class="v3-text-link">Back</AppLink>
        </template>

        <template v-else>
          <div v-if="!joined && inviteCode" class="hh__code" aria-label="Invitation code">
            <p class="hh__code-text">{{ inviteCode }}</p>
          </div>
          <div class="hh__actions">
            <RouterLink :to="V3_ROUTES.HOME" class="v3-btn v3-btn--primary">Go to home</RouterLink>
            <button
              v-if="!joined && inviteCode"
              type="button"
              class="v3-btn v3-btn--outline"
              aria-live="polite"
              @click="copyCode"
            >
              {{ copied ? "Copied" : "Copy code" }}
            </button>
          </div>
        </template>
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
.hh { display: grid; grid-template-columns: 640px 384px; gap: 96px; align-items: start; }
.hh__main { min-width: 0; }
.hh__options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; width: 100%; }
.hh__status { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%; }
.hh__seg { padding: 12px 16px; background: #fff; border: 1px solid var(--nt-line); border-radius: 8px; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-ink); cursor: pointer; }
.hh__seg:hover { border-color: var(--nt-muted); }
.hh__seg--on, .hh__seg--on:hover { border-color: var(--nt-plum); box-shadow: 0 0 0 1px var(--nt-plum); }
.hh__seg:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.hh__code { display: flex; align-items: center; justify-content: center; width: 100%; padding: 28px 48px; background: var(--nt-gray); border-radius: 12px; }
.hh__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.hh__code-text { margin: 0; font-family: var(--nt-serif); font-size: 40px; line-height: normal; letter-spacing: 0.8px; color: var(--nt-plum); }

.hh__aside { display: flex; flex-direction: column; gap: 20px; padding: 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.hh__aside-title { margin: 0; font-family: var(--nt-serif); font-weight: 400; font-size: 22px; line-height: normal; color: var(--nt-ink); }
.hh__shared { display: flex; flex-direction: column; gap: 4px; }
.hh__shared-label { margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--nt-ink); }
.hh__shared-text { margin: 0; font-size: 0.875rem; line-height: 21px; color: var(--nt-muted); }
.hh__private { display: flex; flex-direction: column; gap: 6px; padding: 16px 16px 18px; background: var(--nt-butter); border: 1.5px dashed var(--nt-butter-d); border-radius: 8px; font-size: 0.875rem; }
.hh__private-label { margin: 0; font-weight: 600; color: var(--nt-butter-d); }
.hh__private-text { margin: 0; line-height: 21px; color: var(--nt-ink); }

@media (max-width: 1099px) {
  .hh { grid-template-columns: minmax(0, 1fr); gap: 32px; }
}
@media (max-width: 575px) {
  .hh__options { grid-template-columns: minmax(0, 1fr); }
  .hh__code { padding: 24px; }
  .hh__code-text { font-size: 32px; }
}
</style>
