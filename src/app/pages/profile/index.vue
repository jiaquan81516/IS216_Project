<script setup>
import "@/app/app.css";
import { computed, inject, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import { auth } from "@/api/firebase";
import { cleanDisplayName, DISPLAY_NAME_MAX, PROFILE_ROLES, saveProfile } from "@/api/account";
import { displayName, useHome, HOME_KEY } from "@/app/composables/useHome";
import AddBabyForm from "@/app/components/AddBabyForm.vue";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";
import { babySummary } from "@/api/profile";

defineOptions({ name: "ProfilePage" });

const home = inject(HOME_KEY, null) ?? useHome();
const { loading, error, reload, me, profile, householdId } = home;

const route = useRoute();
const router = useRouter();
const { babies, loadBabies } = useSelectedBaby();
const showAddBaby = ref(false);
const babyAdded = ref("");
const babiesEl = ref(null);

async function openAddBaby() {
  showAddBaby.value = true;
  await nextTick();
  babiesEl.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function onBabyAdded(added) {
  babyAdded.value = added;
  showAddBaby.value = false;
  await loadBabies(householdId.value);
}

// The sidebar "Add a baby" link lands here with ?addBaby=1.
onMounted(async () => {
  if (route.query.addBaby !== "1") return;
  router.replace({ query: {} });
  const stop = watch(
    () => loading.value || !householdId.value,
    async (waiting) => {
      if (waiting) return;
      stop();
      await openAddBaby();
    },
    { immediate: true },
  );
});

const name = ref("");
const role = ref(null);
const nameError = ref("");
const saveError = ref("");
const saved = ref("");
const busy = ref(false);

watch(
  () => profile?.value,
  (value) => {
    if (!value) return;
    name.value = value.displayName || me.value.displayName || "";
    role.value = PROFILE_ROLES.some((r) => r.value === value.role) ? value.role : null;
  },
  { immediate: true },
);

const email = computed(() => profile?.value?.email || me.value.email || "");

// Which sign in method this account uses, read from Firebase rather than stored by us.
const provider = computed(() => {
  const list = auth?.currentUser?.providerData ?? [];
  const google = list.some((p) => p?.providerId === "google.com");
  return google ? "Signed in with Google" : "Signed in with email and password";
});

function pickRole(value) {
  role.value = role.value === value ? null : value;
  saved.value = "";
}

async function save() {
  saved.value = "";
  saveError.value = "";
  const clean = cleanDisplayName(name.value);
  if (!clean) {
    nameError.value = "Enter the name your partner will see.";
    return;
  }
  nameError.value = "";
  busy.value = true;
  try {
    await saveProfile(me.value.uid, householdId.value, { displayName: clean, role: role.value });
    name.value = clean;
    saved.value = "Saved. Your partner sees this name.";
    await reload();
  } catch (cause) {
    console.error("[app profile]", cause?.code, cause);
    saveError.value =
      cause?.code === "permission-denied"
        ? "Your database rules do not allow saving your profile yet. Publish the latest firestore.rules, then try again."
        : "We could not save your profile. Check your connection and try again.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="pf">
    <header class="pf__head">
      <h1 class="nt-title pf__title">Profile</h1>
      <p class="pf__sub">The name and role your partner sees.</p>
    </header>

    <p v-if="loading" class="pf__muted" aria-live="polite">Loading...</p>

    <div v-else-if="error" role="alert" class="pf__alert">
      <p class="pf__text">{{ error }}</p>
      <AppButton variant="outline" size="sm" @click="reload">Try again</AppButton>
    </div>

    <form v-else class="pf__form" novalidate :aria-busy="busy" @submit.prevent="save">
      <section class="pf__row" aria-labelledby="pf-name-h">
        <div class="pf__side">
          <h2 id="pf-name-h" class="pf__h">Your name</h2>
          <p class="pf__muted">Shown on shared logs and tasks.</p>
        </div>
        <div class="pf__card">
          <div class="pf__field">
            <label class="pf__label" for="pf-name">Display name</label>
            <input
              id="pf-name"
              v-model="name"
              class="app-control pf__input"
              :class="{ 'app-control--invalid': nameError }"
              type="text"
              required
              :maxlength="DISPLAY_NAME_MAX"
              autocomplete="name"
              :aria-invalid="nameError ? 'true' : 'false'"
              :aria-describedby="nameError ? 'pf-name-err pf-name-hint' : 'pf-name-hint'"
              @input="saved = ''"
            />
            <p id="pf-name-hint" class="pf__muted">Up to {{ DISPLAY_NAME_MAX }} characters.</p>
            <p v-if="nameError" id="pf-name-err" class="app-error-text" role="alert">{{ nameError }}</p>
          </div>
        </div>
      </section>

      <section class="pf__row" aria-labelledby="pf-role-h">
        <div class="pf__side">
          <h2 id="pf-role-h" class="pf__h">Your role</h2>
          <p class="pf__muted">How you help with the baby.</p>
        </div>
        <div class="pf__card">
          <div class="pf__chips" role="group" aria-labelledby="pf-role-h">
            <button
              v-for="option in PROFILE_ROLES"
              :key="option.value"
              type="button"
              class="app-chip"
              :aria-pressed="role === option.value ? 'true' : 'false'"
              @click="pickRole(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <p class="pf__muted">Tap again to clear it.</p>
        </div>
      </section>

      <section class="pf__row" aria-labelledby="pf-email-h">
        <div class="pf__side">
          <h2 id="pf-email-h" class="pf__h">Email</h2>
          <p class="pf__muted">Used to sign in.</p>
        </div>
        <div class="pf__card">
          <p class="pf__text">{{ email || "No email on this account." }}</p>
          <p class="pf__muted">
            This comes from the sign-in method and cannot be changed here. {{ provider }}.
          </p>
        </div>
      </section>

      <div class="pf__row pf__row--end">
        <div class="pf__actions">
          <AppButton size="sm" :disabled="busy" @click="save">Save changes</AppButton>
          <p class="pf__status" role="status">{{ saved }}</p>
        </div>
        <p v-if="saveError" class="app-error-text" role="alert">{{ saveError }}</p>
        <p class="pf__muted">
          Signed in as {{ displayName(me.firstName) }}.
        </p>
      </div>
    </form>

    <section v-if="!loading && !error && householdId" id="pf-babies" ref="babiesEl" class="pf__row" aria-labelledby="pf-babies-h">
      <div class="pf__side">
        <h2 id="pf-babies-h" class="pf__h">Babies</h2>
        <p class="pf__muted">Twins or a new arrival? Add each baby here.</p>
      </div>
      <div class="pf__card">
        <ul v-if="babies.length" class="pf__babies">
          <li v-for="(b, i) in babies" :key="b.id">
            <strong>{{ b.babyName || `Baby ${i + 1}` }}</strong>
            <span v-if="babySummary(b).line" class="pf__muted">{{ babySummary(b).line }}</span>
          </li>
        </ul>
        <p v-if="babyAdded" class="pf__status" role="status">{{ babyAdded }} was added.</p>
        <AddBabyForm v-if="showAddBaby" :household-id="householdId" :solid="false" id-prefix="pf-add-baby" @added="onBabyAdded" @cancel="showAddBaby = false" />
        <div v-else class="pf__actions">
          <AppButton variant="outline" size="sm" @click="openAddBaby">Add a baby</AppButton>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pf { display: flex; flex-direction: column; gap: 24px; max-width: 960px; font-size: 1rem; }
.pf__head { display: flex; flex-direction: column; gap: 8px; }
.pf__title { font-size: 2.5rem; line-height: 1.2; }
.pf__sub { margin: 0; color: var(--nt-muted); }
.pf__form { display: flex; flex-direction: column; gap: 24px; }
.pf__row { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 16px 40px; align-items: start; }
.pf__row--end { align-items: center; }
.pf__row--end > * { grid-column: 2; }
.pf__side { display: flex; flex-direction: column; gap: 4px; }
.pf__h { margin: 0; font-size: 1.125rem; font-weight: 600; line-height: 1.3; color: var(--nt-ink); }
.pf__card { display: flex; flex-direction: column; gap: 12px; padding: 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.pf__field { display: flex; flex-direction: column; gap: 6px; }
.pf__label { font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.pf__input { max-width: 360px; }
.pf__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.pf__text { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: var(--nt-ink); }
.pf__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.pf__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; }
.pf__status { margin: 0; font-size: 0.875rem; line-height: 20px; color: var(--nt-muted); }
.pf__babies { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.pf__babies li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; font-size: 0.9375rem; color: var(--nt-ink); }
.pf__alert { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
@media (max-width: 991px) {
  .pf__title { font-size: 2rem; }
  .pf__row { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .pf__row--end > * { grid-column: 1; }
}
@media (max-width: 575px) { .pf__card { padding: 20px 16px; } }
</style>
