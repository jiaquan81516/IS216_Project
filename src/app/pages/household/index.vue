<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AuthShell from "@/app/components/AuthShell.vue";
import StepHeader from "@/app/components/StepHeader.vue";
import OptionCard from "@/app/components/OptionCard.vue";
import Field from "@/app/components/Field.vue";
import BabyFields from "@/app/components/BabyFields.vue";
import AddBabyForm from "@/app/components/AddBabyForm.vue";
import BabyCard from "@/app/components/BabyCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import LoadingScreen from "@/app/components/LoadingScreen.vue";
import { useDelayedFlag } from "@/app/composables/useDelayedFlag";
import { SAMPLE } from "@/shared/constants/appConstants";
import { ROUTES } from "@/app/routes";
import { SETUP_MESSAGES, WELCOME_MS, wait } from "@/app/utils/pause";
import { useAuth } from "@/app/composables/useAuth";
import { useOnboarding } from "@/app/stores/onboarding";
import { describeAuthError } from "@/api/emailAuth";
import {
  createHousehold,
  getHouseholdBabies,
  getHouseholdInviteCode,
  joinHousehold,
  getMember,
} from "@/api/profile";
import "@/app/app.css";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";

defineOptions({ name: "HouseholdPage" });

const { currentUser, authProfile, loadProfile, commitAccount } = useAuth();
const draft = useOnboarding();

const JOURNEY_LABELS = { preparing: "Preparing for baby", newborn: "Caring for a newborn" };
const ROLE_LABELS = { parent: "Parent", caregiver: "Caregiver" };
// "form" collects the household choice; "review" shows everything before it is saved.
const phase = ref("form");
// Each card on the review can be changed where it stands, so there is no trip back to an earlier page.
const editing = ref("");
function edit(key) {
  editing.value = key;
  nextTick(() => document.querySelector(".rv .rv__in")?.focus());
}
function done() {
  editing.value = "";
}
const nameText = computed(() => (draft.name || currentUser.value?.displayName || "").trim());
const emailText = computed(() => draft.email || currentUser.value?.email || "");
const stageLabel = computed(() => JOURNEY_LABELS[draft.journey] ?? "Not chosen");
const roleLabel = computed(() => ROLE_LABELS[draft.role] ?? "Not chosen");
const dateText = computed(() => (baby.value.date ? new Date(`${baby.value.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""));
// Only an email and password sign up has an email to change here.
const emailEditable = computed(() => draft.hasAccount);
const reviewProblem = computed(() => {
  if (!nameText.value) return "Add your name to finish.";
  if (draft.hasAccount && !/^\S+@\S+\.\S+$/.test(String(draft.email).trim())) return "Check your email address.";
  if (mode.value === "join" && !code.value.trim()) return "Add the invitation code to finish.";
  return "";
});
const route = useRoute();
const router = useRouter();

const { loadBabies: refreshSidebarBabies } = useSelectedBaby();

const loaded = ref(false);
// An invite link (/join/NT-XXXX) lands here with ?code= and opens the join form.
const linkCode = typeof route?.query?.code === "string" ? route.query.code : "";
const mode = ref(linkCode ? "join" : "create"); // create | join
const code = ref(linkCode);
const householdLabel = ref("");
const codeError = ref("");
const error = ref("");
const busy = ref(false);
const showLoader = useDelayedFlag(busy);
const finishing = ref(false); // the longer "getting ready" screen on the way to home
async function goHome() {
  if (finishing.value) return;
  finishing.value = true;
  try {
    await wait(WELCOME_MS);
    await router.push(ROUTES.HOME);
  } finally {
    finishing.value = false;
  }
}
const result = ref(null); // { kind: "created" | "joined", inviteCode }
const copied = ref(false);
const baby = ref({ name: "", status: "born", date: "" }); // the first baby, asked while creating
const extraBabies = ref([]); // babies 2, 3, ...
function addFormBaby() {
  extraBabies.value.push({ name: "", status: "born", date: "" });
}
function removeFormBaby(i) {
  extraBabies.value.splice(i, 1);
}
const fmtDate = (d) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

let copiedTimer = null;

const householdId = ref("");
const babies = ref([]);
const babyListError = ref(false);
const canManageBabies = ref(false);
const showAddBaby = ref(false);
const babyAdded = ref("");

async function loadBabies() {
  try {
    babies.value = await getHouseholdBabies(householdId.value);
    babyListError.value = false;
  } catch {
    babies.value = [];
    babyListError.value = true;
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
  if (!ready.value) return phase.value === "review" ? "Check your details" : "Set up your shared space";
  return joined.value ? "You have joined the household" : "Your household is ready";
});
const lead = computed(() => {
  if (!ready.value) {
    if (phase.value === "review") return "Nothing is saved until you finish setup. Tap Edit on any card to change it.";
    return `A household connects care logs, tasks and appointments for the people supporting ${baby.value.name.trim() || "your baby"}.`;
  }
  if (joined.value) return "You can now see what the household’s parents share.";
  return inviteCode.value
    ? "Share this code with your partner. They enter it after creating their account."
    : "Your household is set up.";
});

onMounted(async () => {
  try {
    const profile = await loadProfile();
    if (profile?.householdId) {
      const membership = await getMember(profile.householdId, currentUser.value?.uid);
      if (membership?.accessLevel === "caregiver" && linkCode) {
        // Existing caregivers can accept additional caregiver invitations from their link.
        mode.value = "join";
      } else if (membership) {
        canManageBabies.value = membership.accessLevel === "parent";
        let existingInviteCode = null;
        if (canManageBabies.value) {
          try {
            existingInviteCode = await getHouseholdInviteCode(profile.householdId);
          } catch {
            existingInviteCode = null;
          }
        }
        result.value = { kind: "created", inviteCode: existingInviteCode };
        householdId.value = profile.householdId;
        await loadBabies();
      }
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

// The form step only checks the choice and moves on to the review. Nothing is saved yet.
function toReview() {
  error.value = "";
  codeError.value = "";
  if (mode.value === "join" && !code.value.trim()) {
    codeError.value = "Enter an invitation code from a parent in that household.";
    return;
  }
  phase.value = "review";
}

// The last step: create the account, then the household (or join one). This is the first time
// anything about the person is saved.
async function submit() {
  if (busy.value) return;
  error.value = "";
  codeError.value = "";
  busy.value = true;
  try {
    const user = await commitAccount();
    if (mode.value === "create") {
      const created = await createHousehold(user, {
        babies: [baby.value, ...extraBabies.value].map((b) => ({
        babyName: b.name,
        babyStatus: b.status,
        babyDate: b.date,
        })),
    });
      result.value = { kind: "created", inviteCode: created.inviteCode };
      householdId.value = created.householdId;
      canManageBabies.value = true;
    } else {
      const joinedHousehold = await joinHousehold(user, code.value, { householdLabel: householdLabel.value });
      householdId.value = joinedHousehold.householdId;
      const membership = await getMember(joinedHousehold.householdId, user.uid);
      canManageBabies.value = membership?.accessLevel === "parent";
      result.value = { kind: "joined", inviteCode: null };
    }
    await loadBabies();
    await refreshSidebarBabies(householdId.value);
    if (authProfile.value) authProfile.value = { ...authProfile.value, onboarded: true };
  } catch (cause) {
    console.error("[app household]", cause?.code, cause);
    // Invite errors already carry a sentence for the user (see inviteHelpers.js).
    const code = String(cause?.code ?? "");
    error.value = code.startsWith("invite/")
      ? cause.message
      : code === "auth/missing-details"
        ? cause.message
        : code.startsWith("auth/")
          ? describeAuthError(cause)
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
  <LoadingScreen v-if="finishing" variant="overlay" label="Setting things up" :messages="SETUP_MESSAGES" subtext="This only takes a moment." />
  <LoadingScreen v-else-if="showLoader" variant="overlay" :label="mode === 'join' ? 'Joining the household' : 'Setting up your household'" subtext="This only takes a moment." />
  <AuthShell wide>
    <LoadingScreen v-if="!loaded" variant="inline" label="Loading your household" />
    <div v-if="loaded" class="hh">
      <div class="app-stack app-stack--24 hh__main">
        <StepHeader :step="4" :title="title" :lead="lead" />

        <div class="hh__card app-stack app-stack--24" :class="{ 'hh__card--flat': phase === 'review' && !ready }">
        <template v-if="!ready">
          <form v-if="phase === 'form'" class="app-stack app-stack--24 w-100" novalidate @submit.prevent="toReview">
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
                description="Join a household with an invitation code."
                :selected="mode === 'join'"
                :tabindex="mode === 'join' ? 0 : -1"
                @select="selectMode('join')"
              />
            </div>
            <div v-if="mode === 'create'" class="app-stack app-stack--24 w-100">
              <div class="hh__baby app-stack app-stack--24">
              <h3 class="hh__baby-title">Baby 1</h3>
              <BabyFields v-model="baby" id-prefix="app-baby" hint="You can change this later." :disabled="busy" />
            </div>
            <div v-for="(b, i) in extraBabies" :key="i" class="hh__baby app-stack app-stack--24">
              <h3 class="hh__baby-title">Baby {{ i + 2 }}</h3>
              <BabyFields v-model="extraBabies[i]" :id-prefix="`app-baby-${i + 2}`" :disabled="busy" />
              <button type="button" class="app-btn app-btn--outline" @click="removeFormBaby(i)">Remove baby</button>
            </div>
  <button type="button" class="app-btn app-btn--outline" @click="addFormBaby">Add another baby</button>
</div>
            <Field
              v-if="mode === 'join'"
              id="app-invite-code"
              v-model="code"
              label="Invitation code"
              :placeholder="SAMPLE.inviteCode"
              autocomplete="off"
              hint="Ask a parent in that household for an invitation code."
              :error="codeError"
              :disabled="busy"
            />
            <Field
              v-if="mode === 'join'"
              id="app-household-label"
              v-model="householdLabel"
              label="Name this household (optional)"
              placeholder="e.g. Lee Family"
              hint="Only you can see this name."
              :disabled="busy"
            />
            <button type="submit" class="app-btn app-btn--primary">Continue</button>
          </form>
          <AppLink v-if="phase === 'form'" :to="route.query.code ? { path: ROUTES.ACCOUNT, query: { code: route.query.code } } : ROUTES.ACCOUNT" class="app-text-link">Back</AppLink>

          <div v-if="phase === 'review'" class="rv" :aria-busy="busy">
            <ul class="rv__grid" aria-label="Your details">
              <li class="rv__tile">
                <div class="rv__top">
                  <span class="rv__lab">Name</span>
                  <button v-if="editing !== 'name'" type="button" class="rv__edit" @click="edit('name')">Edit<span class="visually-hidden"> name</span></button>
                  <button v-else type="button" class="rv__edit" @click="done">Done</button>
                </div>
                <p v-if="editing !== 'name'" class="rv__val">{{ nameText || "Not added" }}</p>
                <input v-else v-model="draft.name" class="app-control rv__in" maxlength="60" autocomplete="given-name" aria-label="Your name" @keydown.enter.prevent="done" @keydown.esc.stop.prevent="done" />
              </li>

              <li class="rv__tile">
                <div class="rv__top">
                  <span class="rv__lab">Email</span>
                  <template v-if="emailEditable">
                    <button v-if="editing !== 'email'" type="button" class="rv__edit" @click="edit('email')">Edit<span class="visually-hidden"> email</span></button>
                    <button v-else type="button" class="rv__edit" @click="done">Done</button>
                  </template>
                </div>
                <p v-if="editing !== 'email'" class="rv__val">{{ emailText || "Not added" }}</p>
                <input v-else v-model="draft.email" type="email" class="app-control rv__in" maxlength="120" autocomplete="email" aria-label="Your email" @keydown.enter.prevent="done" @keydown.esc.stop.prevent="done" />
                <p v-if="!emailEditable && emailText" class="rv__sub">Signed in with Google</p>
              </li>

              <li class="rv__tile">
                <div class="rv__top">
                  <span class="rv__lab">Role</span>
                  <button v-if="editing !== 'role'" type="button" class="rv__edit" @click="edit('role')">Edit<span class="visually-hidden"> role</span></button>
                  <button v-else type="button" class="rv__edit" @click="done">Done</button>
                </div>
                <p v-if="editing !== 'role'" class="rv__val">{{ roleLabel }}</p>
                <select v-else v-model="draft.role" class="app-control rv__in" aria-label="Your role" @change="done" @keydown.esc.stop.prevent="done">
                  <option v-for="(label, value) in ROLE_LABELS" :key="value" :value="value">{{ label }}</option>
                </select>
              </li>

              <li class="rv__tile">
                <div class="rv__top">
                  <span class="rv__lab">Stage</span>
                  <button v-if="editing !== 'stage'" type="button" class="rv__edit" @click="edit('stage')">Edit<span class="visually-hidden"> stage</span></button>
                  <button v-else type="button" class="rv__edit" @click="done">Done</button>
                </div>
                <p v-if="editing !== 'stage'" class="rv__val">{{ stageLabel }}</p>
                <select v-else v-model="draft.journey" class="app-control rv__in" aria-label="Your stage" @change="done" @keydown.esc.stop.prevent="done">
                  <option v-for="(label, value) in JOURNEY_LABELS" :key="value" :value="value">{{ label }}</option>
                </select>
              </li>

              <li class="rv__tile" :class="{ 'rv__tile--wide': mode === 'join' }">
                <div class="rv__top">
                  <span class="rv__lab">Household</span>
                  <button v-if="editing !== 'house'" type="button" class="rv__edit" @click="edit('house')">Edit<span class="visually-hidden"> household</span></button>
                  <button v-else type="button" class="rv__edit" @click="done">Done</button>
                </div>
                <template v-if="editing !== 'house'">
                  <p class="rv__val">{{ mode === "join" ? "Join a household" : "New household" }}</p>
                  <p class="rv__sub">{{ mode === "join" ? `Invite code ${code.trim() || "not added"}` : "Created when you finish" }}</p>
                </template>
                <template v-else>
                  <div class="rv__seg" role="radiogroup" aria-label="Household">
                    <button type="button" role="radio" class="rv__segbtn" :aria-checked="mode === 'create'" @click="selectMode('create')">New</button>
                    <button type="button" role="radio" class="rv__segbtn" :aria-checked="mode === 'join'" @click="selectMode('join')">Join with a code</button>
                  </div>
                  <input v-if="mode === 'join'" v-model="code" class="app-control rv__in" placeholder="Invitation code" maxlength="40" autocomplete="off" aria-label="Invitation code" @keydown.enter.prevent="done" @keydown.esc.stop.prevent="done" />
                </template>
              </li>

              <li v-if="mode === 'create'" class="rv__tile">
                <div class="rv__top">
                  <span class="rv__lab">Baby 1</span>
                  <button v-if="editing !== 'baby'" type="button" class="rv__edit" @click="edit('baby')">Edit<span class="visually-hidden"> baby details</span></button>
                  <button v-else type="button" class="rv__edit" @click="done">Done</button>
                </div>
                <template v-if="editing !== 'baby'">
                  <p class="rv__val" :class="{ 'rv__val--empty': !baby.name.trim() }">{{ baby.name.trim() || "Name not added yet" }}</p>
                  <p class="rv__sub">{{ baby.status === "expected" ? "Expected" : "Born" }}<template v-if="dateText"> · {{ dateText }}</template></p>
                </template>
                <div v-else class="rv__stack" @keydown.esc.stop.prevent="done">
                  <input v-model="baby.name" class="app-control rv__in" maxlength="60" placeholder="Baby’s name" aria-label="Baby’s name" />
                  <select v-model="baby.status" class="app-control rv__in" aria-label="Born or expected">
                    <option value="born">Born</option>
                    <option value="expected">Expected</option>
                  </select>
                  <input v-model="baby.date" type="date" class="app-control rv__in" aria-label="Baby’s date" />
                </div>
              </li>

              <template v-if="mode === 'create'">
                <li v-for="(b, i) in extraBabies" :key="`x${i}`" class="rv__tile">
                <div class="rv__top">
                  <span class="rv__lab">Baby {{ i + 2 }}</span>
                  <button v-if="editing !== `baby${i}`" type="button" class="rv__edit" @click="edit(`baby${i}`)">Edit</button>
                  <button v-else type="button" class="rv__edit" @click="done">Done</button>
                </div>
              <template v-if="editing !== `baby${i}`">
                <p class="rv__val" :class="{ 'rv__val--empty': !b.name.trim() }">{{ b.name.trim() || "Name not added yet" }}</p>
                <p class="rv__sub">{{ b.status === "expected" ? "Expected" : "Born" }}<template v-if="b.date"> · {{ fmtDate(b.date) }}</template></p>
              </template>
              <div v-else class="rv__stack" @keydown.esc.stop.prevent="done">
                <input v-model="b.name" class="app-control rv__in" maxlength="60" placeholder="Baby’s name" aria-label="Baby’s name" />
                <select v-model="b.status" class="app-control rv__in" aria-label="Born or expected">
        <option value="born">Born</option>
        <option value="expected">Expected</option>
      </select>
      <input v-model="b.date" type="date" class="app-control rv__in" aria-label="Baby’s date" />
    </div>
  </li>
</template>

            </ul>

            <div v-if="error" class="alert alert-danger app-alert" role="alert">{{ error }}</div>
            <p v-if="reviewProblem" class="rv__problem" role="status">{{ reviewProblem }}</p>
            <div class="rv__actions">
              <button type="button" class="app-btn app-btn--outline" :disabled="busy" @click="phase = 'form'">Back</button>
              <button type="button" class="app-btn app-btn--primary" :disabled="busy || !!reviewProblem" @click="submit">{{ busy ? "Setting up..." : "Finish setup" }}</button>
            </div>
          </div>
        </template>

        <template v-else>
          <div v-if="babies.length" class="hh__babies">
            <h3 class="hh__babies-title">{{ babies.length }} {{ babies.length === 1 ? "baby" : "babies" }} in this household</h3>
            <BabyCard v-for="(baby, i) in babies" :key="baby.id" :baby="baby" :number="i + 1" />
          </div>
          <p v-else-if="joined && babyListError" class="hh__hint">We couldn’t load the household’s baby details. Ask a parent to check your caregiver access and that the latest Firestore rules are published.</p>
          <p v-else-if="joined" class="hh__hint">The household’s baby details have not been shared with this caregiver account.</p>

          <p v-if="babyAdded" class="app-text-link" role="status">{{ babyAdded }} was added.</p>

          <button v-if="canManageBabies && !showAddBaby" type="button" class="app-btn app-btn--outline" @click="showAddBaby = true">
            Add another baby
          </button>
          <AddBabyForm v-else-if="canManageBabies" :household-id="householdId" :number="babies.length + 1" @added="onBabyAdded" @cancel="showAddBaby = false" />
          <div v-if="!joined && inviteCode" class="hh__code" aria-label="Invitation code">
            <p class="hh__code-text">{{ inviteCode }}</p>
          </div>
          <div class="hh__actions">
            <button type="button" class="app-btn" :class="showAddBaby ? 'app-btn--outline' : 'app-btn--primary'" :disabled="finishing" @click="goHome">Go to home</button>
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

    </div>
  </AuthShell>
</template>

<style scoped>
.hh { width: 100%; }
.hh__card { width: 100%; padding: 22px; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 24px; }
.hh__main { min-width: 0; }
.hh__options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; width: 100%; }
.hh__code { display: flex; align-items: center; justify-content: center; width: 100%; padding: 32px 48px; background: #fbe3d3; border-radius: 20px; }
.hh__card--flat { padding: 0; background: transparent; border: 0; }
.rv { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 720px; }
.rv__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(104px, auto); gap: 12px; margin: 0; padding: 0; list-style: none; }
.rv__tile { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 16px 20px 18px; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 20px; transition: border-color 0.15s ease; }
.rv__tile:focus-within { border-color: var(--navy, #243560); }
.rv__tile--wide { grid-column: 1 / -1; }
.rv__top { display: flex; align-items: center; justify-content: space-between; min-height: 28px; }
.rv__lab { font-size: 0.8125rem; font-weight: 500; color: var(--nt-muted); }
.rv__edit { padding: 4px 10px; margin: -4px -10px -4px 0; background: transparent; border: 0; border-radius: 8px; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--navy, #243560); font-weight: 700; cursor: pointer; }
.rv__edit:hover { background: #f3ecd9; }
.rv__edit:focus-visible, .rv__segbtn:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.rv__val { margin: 0; font-size: 1.0625rem; font-weight: 600; line-height: 1.35; color: var(--nt-ink); overflow-wrap: anywhere; }
.rv__val--empty { font-weight: 400; color: var(--nt-muted); }
.rv__sub { margin: 0; font-size: 0.875rem; line-height: 1.4; color: var(--nt-muted); overflow-wrap: anywhere; }
.rv__in { width: 100%; }
.rv__stack { display: flex; flex-direction: column; gap: 8px; }
.rv__seg { display: flex; padding: 3px; background: #f3ecd9; border-radius: 999px; }
.rv__segbtn { flex: 1 1 0; padding: 6px 10px; background: transparent; border: 0; border-radius: 999px; font: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-muted); white-space: nowrap; cursor: pointer; }
.rv__segbtn[aria-checked="true"] { background: var(--navy, #243560); color: #fff; }
.rv__problem { margin: 0; font-size: 0.875rem; color: var(--nt-red-t, #b4372b); }
.rv__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
@media (max-width: 575px) {
  .rv__grid { grid-template-columns: minmax(0, 1fr); grid-auto-rows: auto; }
  .rv__actions > * { flex: 1 1 auto; }
}
@media (prefers-reduced-motion: reduce) { .rv__tile { transition: none; } }
.hh__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.hh__code-text { margin: 0; font-family: var(--nt-serif); font-size: 40px; font-weight: 700; line-height: normal; letter-spacing: 0.1em; color: var(--navy, #243560); }

.hh__baby { width: 100%; padding: 18px 20px; background: #fff; border: 1.5px dashed #f2a477; border-radius: 20px; }
.hh__baby-title { margin: 0; font-family: var(--nt-serif); font-size: 1.1875rem; font-weight: 700; line-height: 1.3; color: var(--ink, #1f2a52); }
@media (max-width: 575px) { .hh__baby { padding: 16px; } }
.hh__hint { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.hh__babies { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.hh__babies-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }

@media (max-width: 575px) {
  .hh__options { grid-template-columns: minmax(0, 1fr); }
  .hh__code { padding: 24px; }
  .hh__code-text { font-size: 32px; }
}
</style>
