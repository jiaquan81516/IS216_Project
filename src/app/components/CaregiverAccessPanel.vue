<script setup>
import { computed, onMounted, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import Toggle from "@/app/components/Toggle.vue";
import {
  createCaregiverInvite,
  getCareBrief,
  getHousehold,
  getHouseholdMembers,
  listCaregiverInvites,
  removeCaregiver,
  revokeCaregiverInvite,
  saveCareBrief,
  syncCareBriefChildName,
  updateCaregiverPermissions,
} from "@/api/profile";
import { CAREGIVER_PERMISSIONS, CAREGIVER_ROLES, caregiverPermissions } from "@/app/utils/caregiverHelpers";
import { expiresInText, inviteState } from "@/app/utils/inviteHelpers";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";

const props = defineProps({ householdId: { type: String, required: true }, uid: { type: String, required: true } });
const loading = ref(true);
const busy = ref(false);
const briefLoading = ref(false);
const error = ref("");
const status = ref("");
const briefStatus = ref("");
const briefError = ref("");
const members = ref([]);
const invites = ref([]);
const { babies, loadBabies } = useSelectedBaby();
const briefBabyId = ref("primary");
const form = ref({ name: "", role: "grandparent", permissions: caregiverPermissions("grandparent") });
const brief = ref({ feeding: "", napRoutine: "", allergies: "", medications: "", parentContacts: "" });
const copiedCode = ref("");
const lastCreatedInvite = ref(null);
const caregiverMembers = computed(() => members.value.filter((member) => member.accessLevel !== "parent"));
const briefBabyLabel = computed(() => {
  const index = babies.value.findIndex((baby) => baby.id === briefBabyId.value);
  const baby = babies.value[index];
  return baby?.babyName || `Baby ${index + 1 || 1}`;
});
const pendingInvites = computed(() => {
  if (!lastCreatedInvite.value || invites.value.some((invite) => invite.code === lastCreatedInvite.value.code)) return invites.value;
  return [...invites.value, {
    code: lastCreatedInvite.value.code,
    caregiverName: lastCreatedInvite.value.name,
    caregiverRole: lastCreatedInvite.value.role,
  }];
});

function setRole(role) {
  form.value.role = role;
  form.value.permissions = caregiverPermissions(role);
}
function setPermission(target, key, value) {
  target.permissions = { ...target.permissions, [key]: value };
}
function editRole(member, role) {
  member.role = role;
  member.permissions = caregiverPermissions(role);
}

async function loadBriefForBaby(babyId = briefBabyId.value) {
  if (!props.householdId || !babyId) return;
  briefLoading.value = true;
  brief.value = { feeding: "", napRoutine: "", allergies: "", medications: "", parentContacts: "" };
  try {
    const loaded = await getCareBrief(props.householdId, { babyId, child: false });
    if (babyId !== briefBabyId.value) return;
    brief.value = {
      feeding: loaded.feeding ?? "",
      napRoutine: loaded.napRoutine ?? "",
      allergies: loaded.allergies ?? "",
      medications: loaded.medications ?? "",
      parentContacts: loaded.parentContacts ?? "",
    };
    briefError.value = "";
  } catch (cause) {
    if (babyId !== briefBabyId.value) return;
    console.error("[app caregiver brief load]", cause?.code, cause);
    briefError.value = "We couldn’t load this baby’s care brief. Check your connection and try again.";
  } finally {
    if (babyId === briefBabyId.value) briefLoading.value = false;
  }
}

function selectBriefBaby(babyId) {
  if (!babies.value.some((baby) => baby.id === babyId)) return;
  briefBabyId.value = babyId;
  briefError.value = "";
  briefStatus.value = "";
  void loadBriefForBaby(babyId);
}

async function refresh() {
  loading.value = true;
  error.value = "";
  try {
    const [loadedMembers, loadedInvites, household] = await Promise.all([
      getHouseholdMembers(props.householdId),
      listCaregiverInvites(props.householdId),
      getHousehold(props.householdId),
    ]);
    await syncCareBriefChildName(props.householdId, household?.babyName);
    await loadBabies(props.householdId);
    if (!babies.value.some((baby) => baby.id === briefBabyId.value)) briefBabyId.value = "primary";
    await loadBriefForBaby(briefBabyId.value);
    if (lastCreatedInvite.value && loadedInvites.some((invite) => invite.code === lastCreatedInvite.value.code)) {
      lastCreatedInvite.value = null;
    }
    members.value = loadedMembers.filter((member) => member.accessLevel !== "parent").map((member) => ({
      ...member,
      role: CAREGIVER_ROLES.some((role) => role.value === member.role) ? member.role : "trusted-caregiver",
      permissions: caregiverPermissions(member.role, member.permissions),
      dirty: false,
      saving: false,
    }));
    invites.value = loadedInvites.filter((invite) => inviteState(invite) === "valid");
  } catch (cause) {
    console.error("[app caregivers]", cause?.code, cause);
    error.value = cause?.code === "permission-denied"
      ? "Caregiver access is not enabled in the shared database yet. Ask your app administrator for help."
      : "We could not load caregiver access. Check your connection and try again.";
  } finally {
    loading.value = false;
  }
}

async function addCaregiver() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  status.value = "";
  try {
    const created = await createCaregiverInvite(props.uid, props.householdId, form.value);
    lastCreatedInvite.value = created;
    status.value = `Invite ready for ${created.name || CAREGIVER_ROLES.find((role) => role.value === created.role)?.label}. Share the link or code with them.`;
    form.value = { name: "", role: "grandparent", permissions: caregiverPermissions("grandparent") };
    await refresh();
    copiedCode.value = created.code;
  } catch (cause) {
    console.error("[app caregiver invite]", cause?.code, cause);
    error.value = cause?.code === "permission-denied"
      ? "Caregiver invitations are not enabled in the shared database yet. Ask your app administrator for help."
      : "We could not create the invitation. Check your connection and try again.";
  } finally {
    busy.value = false;
  }
}

async function saveMember(member) {
  member.saving = true;
  error.value = "";
  try {
    await updateCaregiverPermissions(props.householdId, member.uid, member.role, member.permissions);
    member.dirty = false;
    status.value = "Caregiver access saved.";
  } catch (cause) {
    console.error("[app caregiver permissions]", cause?.code, cause);
    error.value = cause?.code === "permission-denied"
      ? "These permission changes are not enabled in the shared database yet. Ask your app administrator for help."
      : "We could not save these permissions. Try again.";
  } finally {
    member.saving = false;
  }
}

async function removeMember(member) {
  if (!window.confirm(`Remove ${member.displayName || "this caregiver"} from the household?`)) return;
  try {
    await removeCaregiver(props.householdId, member.uid);
    members.value = members.value.filter((item) => item.uid !== member.uid);
    status.value = "Caregiver removed.";
  } catch (cause) {
    console.error("[app caregiver remove]", cause?.code, cause);
    error.value = "We could not remove this caregiver. Check your connection and try again.";
  }
}

function inviteUrl(code) {
  return `${window.location.origin}/join/${encodeURIComponent(code)}`;
}
async function copyInvite(code) {
  try {
    await navigator.clipboard.writeText(inviteUrl(code));
    copiedCode.value = code;
    status.value = "Invitation link copied.";
  } catch {
    copiedCode.value = "";
    error.value = `Copy was blocked. Share this code instead: ${code}`;
  }
}
async function revokeInvite(code) {
  try {
    await revokeCaregiverInvite(code);
    invites.value = invites.value.filter((invite) => invite.code !== code);
    if (lastCreatedInvite.value?.code === code) lastCreatedInvite.value = null;
    status.value = "Invitation cancelled.";
  } catch (cause) {
    console.error("[app caregiver revoke]", cause?.code, cause);
    error.value = "We could not cancel this invitation. Try again.";
  }
}

async function saveBrief() {
  if (busy.value) return;
  busy.value = true;
  briefError.value = "";
  briefStatus.value = "Saving care brief…";
  const babyId = briefBabyId.value;
  try {
    const savedBrief = await saveCareBrief(props.householdId, brief.value, babyId);
    const confirmedBrief = await getCareBrief(props.householdId, { babyId, child: false });
    const fields = ["feeding", "napRoutine", "allergies", "medications", "parentContacts"];
    const verified = fields.every((field) => (confirmedBrief[field] ?? "") === (savedBrief[field] ?? ""));
    if (!verified) throw new Error("The saved care brief could not be read back from this household.");
    brief.value = { ...savedBrief };
    briefStatus.value = `Care brief for ${briefBabyLabel.value} saved successfully.`;
  } catch (cause) {
    console.error("[app caregiver brief]", cause?.code, cause);
    briefStatus.value = "";
    briefError.value = "We couldn’t save this baby’s care brief. Check your connection and try again.";
  } finally {
    busy.value = false;
  }
}

watch(() => [props.householdId, props.uid], refresh);
onMounted(refresh);
</script>

<template>
  <div class="caregivers">
    <p class="cg__intro">Invite trusted people with a role-based starting point, then choose exactly what they can see. You can add more or change access later.</p>
    <p v-if="loading" class="cg__muted" aria-live="polite">Loading caregiver access…</p>
    <template v-else>
      <p v-if="error" class="app-error-text" role="alert">{{ error }}</p>
      <p v-if="status" class="cg__muted" role="status">{{ status }}</p>

      <form class="cg__card" @submit.prevent="addCaregiver">
        <h3>Add a caregiver</h3>
        <label class="cg__field"><span>Name (optional)</span><input v-model="form.name" class="app-control" maxlength="40" placeholder="Grandma" autocomplete="off" /></label>
        <label class="cg__field"><span>Caregiver role</span><select :value="form.role" class="app-control" @change="setRole($event.target.value)"><option v-for="role in CAREGIVER_ROLES" :key="role.value" :value="role.value">{{ role.label }}</option></select></label>
        <fieldset class="cg__permissions"><legend>Can access</legend><Toggle v-for="permission in CAREGIVER_PERMISSIONS" :id="`cg-new-${permission.key}`" :key="permission.key" :label="permission.label" :model-value="form.permissions[permission.key]" @update:model-value="setPermission(form, permission.key, $event)" /></fieldset>
        <AppButton type="submit" variant="outline" :disabled="busy">{{ busy ? "Creating invite…" : "Create caregiver invite" }}</AppButton>
        <div v-if="pendingInvites.length" class="cg__pending">
          <h4>Pending caregiver invites</h4>
          <article v-for="invite in pendingInvites" :key="invite.code" class="cg__invite-ready">
            <strong>{{ invite.caregiverName || CAREGIVER_ROLES.find((role) => role.value === invite.caregiverRole)?.label || "Caregiver" }}</strong>
            <div class="cg__invite-details"><span>Invite code</span><code>{{ invite.code }}</code><span v-if="invite.expiresAt" class="cg__muted">{{ expiresInText(invite.expiresAt) }}</span></div>
            <div class="cg__invite-details"><span>Invite link</span><a class="cg__invite-url" :href="inviteUrl(invite.code)">{{ inviteUrl(invite.code) }}</a></div>
            <div class="cg__actions"><AppButton variant="outline" size="sm" @click="copyInvite(invite.code)">{{ copiedCode === invite.code ? "Link copied" : "Copy invite link" }}</AppButton><button class="cg__link" type="button" @click="revokeInvite(invite.code)">Cancel invite</button></div>
          </article>
        </div>
      </form>

      <div v-if="caregiverMembers.length" class="cg__list">
        <h3>Current caregivers</h3>
        <article v-for="member in caregiverMembers" :key="member.uid" class="cg__card">
          <div class="cg__member-head"><div><h4>{{ member.displayName || "Caregiver" }}</h4><p class="cg__muted">Joined {{ member.joinedAt?.toDate?.().toLocaleDateString?.() || "the household" }}</p></div><button class="cg__link cg__link--danger" type="button" @click="removeMember(member)">Remove</button></div>
          <label class="cg__field"><span>Role</span><select v-model="member.role" class="app-control" @change="editRole(member, member.role); member.dirty = true"><option v-for="role in CAREGIVER_ROLES" :key="role.value" :value="role.value">{{ role.label }}</option></select></label>
          <fieldset class="cg__permissions"><legend>Can access</legend><Toggle v-for="permission in CAREGIVER_PERMISSIONS" :id="`cg-${member.uid}-${permission.key}`" :key="permission.key" :label="permission.label" :model-value="member.permissions[permission.key]" @update:model-value="setPermission(member, permission.key, $event); member.dirty = true" /></fieldset>
          <AppButton v-if="member.dirty" variant="outline" size="sm" :disabled="member.saving" @click="saveMember(member)">{{ member.saving ? "Saving…" : "Save access" }}</AppButton>
        </article>
      </div>

      <form class="cg__card" @submit.prevent="saveBrief">
        <h3>Care brief for {{ briefBabyLabel }}</h3>
        <p class="cg__muted">Each baby has their own care instructions and contact details. Health instructions appear only for caregivers with health access.</p>
        <label class="cg__field"><span>Baby</span><select class="app-control" :value="briefBabyId" :disabled="busy || briefLoading" @change="selectBriefBaby($event.target.value)"><option v-for="(baby, index) in babies" :key="baby.id" :value="baby.id">{{ baby.babyName || `Baby ${index + 1}` }}</option></select></label>
        <p v-if="briefLoading" class="cg__muted" aria-live="polite">Loading this baby’s care brief…</p>
        <label v-for="item in [
  { key: 'feeding', label: 'Usual feeding method' },
          { key: 'napRoutine', label: 'Nap routine' },
          { key: 'allergies', label: 'Allergies' },
          { key: 'medications', label: 'Medication instructions' },
          { key: 'parentContacts', label: 'Parent contact details for this baby' },
        ]" :key="item.key" class="cg__field"><span>{{ item.label }}</span><textarea v-model="brief[item.key]" class="app-control" rows="2" maxlength="500" :disabled="busy || briefLoading" :placeholder="({ feeding: 'e.g. bottle feed, breastfeeding', napRoutine: 'e.g. nap at 3pm', allergies: 'e.g. peanut allergy, or none', medications: 'e.g. medicine name and dosage', parentContacts: 'e.g. phone numbers to call' })[item.key]" /></label>
        <AppButton type="button" variant="outline" :disabled="busy || briefLoading" @click="saveBrief">{{ busy ? "Saving…" : "Save care brief" }}</AppButton>
        <p v-if="briefStatus" class="cg__muted" role="status" aria-live="polite">{{ briefStatus }}</p>
        <p v-if="briefError" class="app-error-text" role="alert">{{ briefError }}</p>
      </form>
    </template>
  </div>
</template>

<style scoped>
.caregivers { display: flex; flex-direction: column; gap: 16px; }
.cg__intro, .cg__muted { margin: 0; color: var(--nt-muted); font-size: .875rem; line-height: 1.5; }
.cg__list { display: flex; flex-direction: column; gap: 10px; }
.cg__list > h3, .cg__card > h3 { margin: 0; font-size: 1rem; font-weight: 600; }
.cg__card { display: flex; flex-direction: column; gap: 14px; padding: 18px; border: 1px solid var(--nt-line); border-radius: 10px; }
.cg__field { display: flex; flex-direction: column; gap: 6px; font-size: .875rem; font-weight: 600; }
.cg__field :deep(textarea) { resize: vertical; font-weight: 400; }
.cg__permissions { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 14px; border: 1px solid var(--nt-line); border-radius: 8px; }
.cg__permissions legend { padding: 0 6px; font-size: .875rem; font-weight: 600; }
.cg__row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; border: 1px solid var(--nt-line); border-radius: 8px; }
.cg__pending { display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
.cg__pending h4 { margin: 0; font-size: .9375rem; font-weight: 600; }
.cg__invite-ready { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 16px; border: 1px solid var(--nt-plum); border-radius: 8px; background: var(--nt-surface, #fff); }
.cg__invite-details { display: flex; flex-direction: column; gap: 4px; width: 100%; font-size: .875rem; }
.cg__invite-url { display: block; max-width: 100%; margin-top: 4px; overflow-wrap: anywhere; font-size: .875rem; }
.cg__row > div:first-child { display: flex; flex-direction: column; gap: 4px; }
.cg__actions, .cg__member-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.cg__actions { justify-content: flex-end; }
.cg__member-head h4 { margin: 0 0 4px; font-size: 1rem; }
.cg__link { padding: 4px 0; background: none; border: 0; color: var(--nt-plum); font: inherit; font-size: .875rem; text-decoration: underline; cursor: pointer; }
.cg__link--danger { color: var(--nt-coral); }
</style>
