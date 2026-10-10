<script setup>
import "@/v3/v3.css";
import { computed, inject, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import { auth } from "@/api/firebase";
import { cleanDisplayName, DISPLAY_NAME_MAX, PROFILE_ROLES, saveProfile } from "@/v3/api/account";
import { displayName, useV3Home, V3_HOME_KEY } from "@/v3/composables/useV3Home";

defineOptions({ name: "V3ProfilePage" });

const home = inject(V3_HOME_KEY, null) ?? useV3Home();
const { loading, error, reload, me, profile, householdId } = home;

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
    console.error("[v3 profile]", cause?.code, cause);
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
      <section class="pf__section" aria-labelledby="pf-name-h">
        <h2 id="pf-name-h" class="pf__h">Your name</h2>
        <div class="pf__field">
          <label class="pf__label" for="pf-name">Display name</label>
          <input
            id="pf-name"
            v-model="name"
            class="v3-control pf__input"
            :class="{ 'v3-control--invalid': nameError }"
            type="text"
            required
            :maxlength="DISPLAY_NAME_MAX"
            autocomplete="name"
            :aria-invalid="nameError ? 'true' : 'false'"
            :aria-describedby="nameError ? 'pf-name-err pf-name-hint' : 'pf-name-hint'"
            @input="saved = ''"
          />
          <p id="pf-name-hint" class="pf__muted">Up to {{ DISPLAY_NAME_MAX }} characters.</p>
          <p v-if="nameError" id="pf-name-err" class="v3-error-text" role="alert">{{ nameError }}</p>
        </div>
      </section>

      <section class="pf__section" aria-labelledby="pf-role-h">
        <h2 id="pf-role-h" class="pf__h">Your role</h2>
        <div class="pf__chips" role="group" aria-labelledby="pf-role-h">
          <button
            v-for="option in PROFILE_ROLES"
            :key="option.value"
            type="button"
            class="v3-chip"
            :aria-pressed="role === option.value ? 'true' : 'false'"
            @click="pickRole(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <p class="pf__muted">Tap again to clear it.</p>
      </section>

      <section class="pf__section" aria-labelledby="pf-email-h">
        <h2 id="pf-email-h" class="pf__h">Email</h2>
        <p class="pf__text">{{ email || "No email on this account." }}</p>
        <p class="pf__muted">
          This comes from the sign-in method and cannot be changed here. {{ provider }}.
        </p>
      </section>

      <div class="pf__actions">
        <AppButton size="sm" :disabled="busy" @click="save">Save changes</AppButton>
        <p class="pf__status" role="status">{{ saved }}</p>
      </div>
      <p v-if="saveError" class="v3-error-text" role="alert">{{ saveError }}</p>
      <p class="pf__muted">
        Signed in as {{ displayName(me.firstName) }}.
      </p>
    </form>
  </div>
</template>

<style scoped>
.pf { display: flex; flex-direction: column; gap: 24px; max-width: 720px; font-size: 1rem; }
.pf__head { display: flex; flex-direction: column; gap: 8px; }
.pf__title { font-size: 2.5rem; line-height: 1.2; }
.pf__sub { margin: 0; color: var(--nt-muted); }
.pf__form { display: flex; flex-direction: column; gap: 0; }
.pf__section { display: flex; flex-direction: column; gap: 10px; padding: 20px 0; border-bottom: 1px solid var(--nt-line); }
.pf__section:first-of-type { padding-top: 0; }
.pf__h { margin: 0; font-family: var(--nt-serif); font-size: 1.125rem; font-weight: 400; color: var(--nt-ink); }
.pf__field { display: flex; flex-direction: column; gap: 6px; }
.pf__label { font-size: 0.875rem; font-weight: 600; color: var(--nt-ink); }
.pf__input { max-width: 360px; }
.pf__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.pf__text { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.pf__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.pf__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 20px 0 8px; }
.pf__status { margin: 0; font-size: 0.875rem; line-height: 20px; color: var(--nt-muted); }
.pf__alert { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
@media (max-width: 991px) { .pf__title { font-size: 2rem; } }
</style>
