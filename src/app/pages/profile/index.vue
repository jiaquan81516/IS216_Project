<script setup>
import LoadingScreen from "@/app/components/LoadingScreen.vue";
import "@/app/app.css";
import { computed, inject, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageHero from "@/app/components/PageHero.vue";
import Icon from "@/app/components/Icon.vue";
import { auth } from "@/api/firebase";
import { cleanDisplayName, DISPLAY_NAME_MAX, PROFILE_ROLES, saveProfile } from "@/api/account";
import { useHome, HOME_KEY } from "@/app/composables/useHome";
import AddBabyForm from "@/app/components/AddBabyForm.vue";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";
import BabyCard from "@/app/components/BabyCard.vue";

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
  babyAdded.value = `${added} was added.`;
  showAddBaby.value = false;
  await loadBabies(householdId.value);
}

async function onBabyChanged(name) {
  babyAdded.value = `${name} was updated.`;
  await loadBabies(householdId.value);
}

async function onBabyDeleted(name) {
  babyAdded.value = `${name} was removed from active care.`;
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

const email = computed(() => auth?.currentUser?.email || profile?.value?.email || me.value.email || "");

// Which sign in method this account uses, read from Firebase rather than stored by us.
const provider = computed(() => {
  const list = auth?.currentUser?.providerData ?? [];
  if (list.some((item) => item?.providerId === "google.com")) {
    return { label: "Google account", hint: "This email comes from your Google account." };
  }
  if (list.some((item) => item?.providerId === "password")) {
    return { label: "Email and password", hint: "This is the email you use to sign in." };
  }
  return { label: "Account email", hint: "This email comes from your sign-in account." };
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
    <PageHero eyebrow="Your account" title="Profile" lead="The name and role your partner sees." />

    <LoadingScreen v-if="loading" variant="inline" label="Loading" />

    <div v-else-if="error" role="alert" class="pf__alert">
      <p class="pf__text">{{ error }}</p>
      <button type="button" class="pf__btn pf__btn--ghost" @click="reload">Try again</button>
    </div>

    <form v-else class="pf__card" novalidate :aria-busy="busy" @submit.prevent="save">
      <div class="pf__top">
        <h2 class="pf__h">About you</h2>
      </div>

      <div class="pf__field">
        <label class="pf__label" for="pf-name">Display name</label>
        <input
          id="pf-name"
          v-model="name"
          class="pf__input"
          :class="{ 'pf__input--bad': nameError }"
          type="text"
          required
          :maxlength="DISPLAY_NAME_MAX"
          autocomplete="name"
          :aria-invalid="nameError ? 'true' : 'false'"
          :aria-describedby="nameError ? 'pf-name-err pf-name-hint' : 'pf-name-hint'"
          @input="saved = ''"
        />
        <p id="pf-name-hint" class="pf__muted">Shown on shared logs and tasks. Up to {{ DISPLAY_NAME_MAX }} characters.</p>
        <p v-if="nameError" id="pf-name-err" class="pf__err" role="alert">{{ nameError }}</p>
      </div>

      <div class="pf__field">
        <div class="pf__label-row">
          <label class="pf__label" for="pf-email">Email address</label>
          <span class="pf__provider"><Icon name="check" :size="13" /> {{ provider.label }}</span>
        </div>
        <input
          id="pf-email"
          class="pf__input pf__input--readonly"
          type="email"
          :value="email"
          readonly
          autocomplete="email"
          aria-describedby="pf-email-hint"
        />
        <p id="pf-email-hint" class="pf__muted">{{ provider.hint }}</p>
      </div>

      <div class="pf__field">
        <span id="pf-role-h" class="pf__label">Your role</span>
        <div class="pf__chips" role="group" aria-labelledby="pf-role-h">
          <button
            v-for="option in PROFILE_ROLES"
            :key="option.value"
            type="button"
            class="pf__chip"
            :aria-pressed="role === option.value ? 'true' : 'false'"
            @click="pickRole(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <p class="pf__muted">How you help with the baby. Tap again to clear it.</p>
      </div>

      <div class="pf__actions">
        <button type="submit" class="pf__btn" :disabled="busy">{{ busy ? "Saving..." : "Save changes" }}</button>
        <p class="pf__status" role="status">{{ saved }}</p>
      </div>
      <p v-if="saveError" class="pf__err" role="alert">{{ saveError }}</p>
    </form>

    <section v-if="!loading && !error && householdId" id="pf-babies" ref="babiesEl" class="pf__card" aria-labelledby="pf-babies-h">
      <div class="pf__top">
        <div>
          <h2 id="pf-babies-h" class="pf__h">Babies</h2>
          <p class="pf__muted">Twins or a new arrival? Add each baby here.</p>
        </div>
        <button v-if="!showAddBaby" type="button" class="pf__btn pf__btn--ghost" @click="openAddBaby"><Icon name="plus" :size="16" /> Add a baby</button>
      </div>
      <div class="pf__stack">
        <BabyCard
          v-for="(b, i) in babies"
          :key="b.id"
          :baby="b"
          :number="i + 1"
          editable
          :household-id="householdId"
          can-delete
          @changed="onBabyChanged"
          @deleted="onBabyDeleted"
        />
        <p v-if="babyAdded" class="pf__status pf__ok" role="status"><Icon name="check" :size="14" /> {{ babyAdded }}</p>
        <AddBabyForm v-if="showAddBaby" :household-id="householdId" :number="babies.length + 1" id-prefix="pf-add-baby" @added="onBabyAdded" @cancel="showAddBaby = false" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.pf { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 53.75rem; margin: 0 auto; font-size: 1rem; color: var(--ink, #1f2a52); }
.pf__card { display: flex; flex-direction: column; gap: 18px; padding: 22px 24px 26px; background: var(--cream, #fdf9f0); border: 1px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 24px; }
.pf__top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
.pf__h { margin: 0; font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 700; line-height: 1.25; }
.pf__field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.pf__label { font-size: 0.9375rem; font-weight: 600; }
.pf__label-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; }
.pf__input { width: 100%; min-width: 0; min-height: 52px; padding: 13px 16px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 14px; font: inherit; font-size: 1rem; color: var(--ink, #1f2a52); }
.pf__input:focus { outline: 3px solid var(--navy, #243560); outline-offset: 1px; border-color: var(--navy, #243560); }
.pf__input--bad { border-color: #c4642f; }
.pf__input--readonly { background: #f7f3eb; color: #536184; cursor: default; }
.pf__input--readonly:focus { outline-color: #8fa3c2; border-color: #8fa3c2; }
.pf__muted { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--mut, #5b6692); }
.pf__provider { display: inline-flex; align-items: center; gap: 5px; color: #536184; font-size: 0.8125rem; font-weight: 600; }
.pf__text { margin: 0; }
.pf__err { margin: 0; font-size: 0.875rem; font-weight: 600; color: #a4541f; }
.pf__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.pf__chip { padding: 9px 18px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 999px; color: var(--navy, #243560); font: inherit; font-size: 0.9375rem; font-weight: 600; cursor: pointer; transition: background 0.15s, color 0.15s; }
.pf__chip:hover { border-color: var(--navy, #243560); }
.pf__chip[aria-pressed="true"] { background: var(--navy, #243560); border-color: var(--navy, #243560); color: #fff; }
.pf__chip:focus-visible, .pf__btn:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.pf__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; }
.pf__btn { display: inline-flex; align-items: center; gap: 6px; padding: 11px 22px; background: var(--navy, #243560); border: 0; border-bottom: 3px solid #182246; border-radius: 14px; color: #fff; font: inherit; font-size: 0.9375rem; font-weight: 600; cursor: pointer; }
.pf__btn:hover:not(:disabled) { background: #1b2a4f; }
.pf__btn:disabled { opacity: 0.6; cursor: not-allowed; }
.pf__btn--ghost { background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 3px; color: var(--navy, #243560); }
.pf__btn--ghost:hover:not(:disabled) { background: #fffdf8; border-color: var(--navy, #243560); }
.pf__status { display: inline-flex; align-items: center; gap: 6px; margin: 0; font-size: 0.875rem; color: var(--mut, #5b6692); }
.pf__ok { color: var(--sagei, #2f5d43); font-weight: 600; }
.pf__stack { display: flex; flex-direction: column; gap: 12px; }
.pf__alert { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 18px 20px; background: #fdeee6; border: 1.5px solid #f4a98c; border-radius: 18px; color: #7a2e12; }
@media (max-width: 575px) {
  .pf__card { gap: 16px; padding: 18px 16px 22px; border-radius: 20px; }
  .pf__top { align-items: flex-start; }
  .pf__label-row { align-items: flex-start; }
  .pf__provider { flex-basis: 100%; }
  .pf__input { min-height: 50px; padding: 12px 14px; font-size: 1rem; }
  .pf__actions, .pf__actions .pf__btn { width: 100%; }
  .pf__actions .pf__btn { justify-content: center; }
}
</style>
