<script setup>
import LoadingScreen from "@/app/components/LoadingScreen.vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import SelectField from "@/app/components/SelectField.vue";
import Toggle from "@/app/components/Toggle.vue";
import {
  createCaregiverInvite,
  getCareBrief,
  getHousehold,
  getHouseholdMembers,
  subscribeHouseholdMembers,
  listCaregiverInvites,
  removeCaregiver,
  revokeCaregiverInvite,
  saveCareBrief,
  syncCareBriefChildName,
  updateCaregiverPermissions,
} from "@/api/profile";
import { CAREGIVER_PERMISSIONS, CAREGIVER_ROLES, PERMISSION_GROUPS, PERMISSION_NEEDS, PERMISSION_NEEDS_LABEL, caregiverPermissions, withDependencies, formatPhone, isPhoneComplete, parseContacts, serializeContacts } from "@/app/utils/caregiverHelpers";
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
// Each title with its switches, in the order they appear.
const permissionGroups = PERMISSION_GROUPS.map((g) => ({ ...g, items: g.keys.map((k) => CAREGIVER_PERMISSIONS.find((p) => p.key === k)).filter(Boolean) }));
const form = ref({ name: "", role: "grandparent", permissions: caregiverPermissions("grandparent") });
const brief = ref({ feeding: "", napRoutine: "", allergies: "", medications: "", parentContacts: "" });
const copiedCode = ref("");
// Parent contacts are edited as rows of who and number, and saved into the brief as text.
const contacts = ref([]);
const parentNames = ref([]);
const CONTACT_MAX = 4;
const contactsInvalid = computed(() => contacts.value.some((row) => row.phone && !isPhoneComplete(row.phone)));
function whoOptions(row) {
  const names = [...parentNames.value];
  if (row.who && !names.includes(row.who)) names.push(row.who);
  if (!names.includes("Someone else")) names.push("Someone else");
  return names.map((name) => ({ value: name, label: name }));
}
function addContact() {
  if (contacts.value.length >= CONTACT_MAX) return;
  const used = new Set(contacts.value.map((row) => row.who));
  contacts.value.push({ who: parentNames.value.find((name) => !used.has(name)) ?? "", phone: "" });
}
function removeContact(index) {
  contacts.value.splice(index, 1);
}
function typePhone(row, event) {
  row.phone = formatPhone(event.target.value);
  event.target.value = row.phone;
}
const lastCreatedInvite = ref(null);
const caregiverMembers = computed(() => members.value.filter((member) => member.accessLevel !== "parent"));
const briefBabyLabel = computed(() => {
  const index = babies.value.findIndex((baby) => baby.id === briefBabyId.value);
  const baby = babies.value[index];
  return baby?.babyName || `Baby ${index + 1 || 1}`;
});
// Only one invite is ever open at a time, so this is at most one: the one just made, or the newest.
const pendingInvites = computed(() => {
  const created = lastCreatedInvite.value;
  if (created && !invites.value.some((invite) => invite.code === created.code)) {
    return [{ code: created.code, caregiverName: created.name, caregiverRole: created.role }];
  }
  return invites.value.slice(-1);
});
// The invite stays tucked away until the parent asks for it or has just made one.
const showInvite = ref(false);

function setRole(role) {
  form.value.role = role;
  form.value.permissions = caregiverPermissions(role);
}
function setPermission(target, key, value) {
  target.permissions = withDependencies({ ...target.permissions, [key]: value });
}
// A switch that depends on another stays off and says why, so nothing looks broken.
function lockedBy(permissions, key) {
  const needs = PERMISSION_NEEDS[key];
  return Boolean(needs && !permissions[needs]);
}
function lockHint(permissions, key) {
  return lockedBy(permissions, key) ? `Turn on “${PERMISSION_NEEDS_LABEL[PERMISSION_NEEDS[key]]}” first.` : "";
}
function editRole(member, role) {
  member.role = role;
  member.permissions = caregiverPermissions(role);
}

async function loadBriefForBaby(babyId = briefBabyId.value) {
  if (!props.householdId || !babyId) return;
  briefLoading.value = true;
  brief.value = { feeding: "", napRoutine: "", allergies: "", medications: "", parentContacts: "" };
  contacts.value = [];
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
    contacts.value = parseContacts(brief.value.parentContacts);
    briefError.value = "";
  } catch (cause) {
    if (babyId !== briefBabyId.value) return;
    console.error("[app caregiver brief load]", cause?.code, cause);
    briefError.value = "We couldn’t load this baby’s care brief. Check your connection and try again.";
  } finally {
    if (babyId === briefBabyId.value) briefLoading.value = false;
  }
}

const babyOptions = computed(() => babies.value.map((baby, index) => ({ value: baby.id, label: baby.babyName || `Baby ${index + 1}` })));

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
    if (lastCreatedInvite.value && loadedInvites.some((invite) => invite.code === lastCreatedInvite.value.code)) {
      lastCreatedInvite.value = null;
    }
    parentNames.value = [...new Set(loadedMembers.filter((member) => member.accessLevel === "parent").map((member) => (member.displayName || "").trim()).filter(Boolean))];
    members.value = loadedMembers.filter((member) => member.accessLevel !== "parent").map((member) => ({
      ...member,
      role: CAREGIVER_ROLES.some((role) => role.value === member.role) ? member.role : "trusted-caregiver",
      permissions: caregiverPermissions(member.role, member.permissions),
      dirty: false,
      saving: false,
    }));
    invites.value = loadedInvites.filter((invite) => inviteState(invite) === "valid");
    // The people and invites are on screen now. The care brief, the baby list and the child name
    // sync load side by side behind them instead of one after another, so the panel opens fast.
    loading.value = false;
    await Promise.all([
      syncCareBriefChildName(props.householdId, household?.babyName).catch((cause) => console.error("[app caregivers sync]", cause?.code, cause)),
      loadBabies(props.householdId),
      loadBriefForBaby(briefBabyId.value),
    ]);
    if (!babies.value.some((baby) => baby.id === briefBabyId.value)) {
      briefBabyId.value = "primary";
      await loadBriefForBaby("primary");
    }
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
    // A new invite replaces the open one, so there is only ever one.
    await Promise.allSettled(invites.value.map((invite) => revokeCaregiverInvite(invite.code)));
    const created = await createCaregiverInvite(props.uid, props.householdId, form.value);
    lastCreatedInvite.value = created;
    showInvite.value = true;
    status.value = `Invite ready for ${created.name || CAREGIVER_ROLES.find((role) => role.value === created.role)?.label}. Share the code with them.`;
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

async function copyInvite(code) {
  try {
    await navigator.clipboard.writeText(code);
    copiedCode.value = code;
    status.value = "Invitation code copied.";
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
    showInvite.value = false;
    status.value = "Invitation cancelled.";
  } catch (cause) {
    console.error("[app caregiver revoke]", cause?.code, cause);
    error.value = "We could not cancel this invitation. Try again.";
  }
}

async function saveBrief() {
  if (busy.value) return;
  if (contactsInvalid.value) {
    briefError.value = "Phone numbers need 8 digits.";
    return;
  }
  brief.value.parentContacts = serializeContacts(contacts.value);
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
    contacts.value = parseContacts(brief.value.parentContacts);
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

// Keep the caregiver list live: when somebody joins with a code (or is removed) it changes here at
// once, and the invite they used drops off the open list. Edits still being made are kept as they are.
let stopMembers = null;
let knownCount = null;
function watchMembers() {
  stopMembers?.();
  stopMembers = null;
  knownCount = null;
  if (!props.householdId) return;
  stopMembers = subscribeHouseholdMembers(
    props.householdId,
    async (list) => {
      const caregivers = list.filter((member) => member.accessLevel !== "parent");
      const changed = knownCount !== null && caregivers.length !== knownCount;
      knownCount = caregivers.length;
      if (loading.value || !changed) return;
      members.value = caregivers.map((member) => {
        const open = members.value.find((item) => item.uid === member.uid);
        if (open && (open.dirty || open.saving)) return open;
        return {
          ...member,
          role: CAREGIVER_ROLES.some((role) => role.value === member.role) ? member.role : "trusted-caregiver",
          permissions: caregiverPermissions(member.role, member.permissions),
          dirty: false,
          saving: false,
        };
      });
      try {
        invites.value = (await listCaregiverInvites(props.householdId)).filter((invite) => inviteState(invite) === "valid");
      } catch (cause) {
        console.error("[app caregivers invites]", cause?.code, cause);
      }
    },
    (cause) => console.error("[app caregivers live]", cause?.code, cause),
  );
}
onMounted(watchMembers);
watch(() => props.householdId, watchMembers);
onBeforeUnmount(() => stopMembers?.());
const JUST_JOINED_MS = 3 * 86400000;
const justJoined = (member) => {
  const at = member.joinedAt?.toMillis?.();
  return Boolean(at && Date.now() - at < JUST_JOINED_MS);
};
</script>

<template>
  <div class="caregivers">
    <p class="cg__intro">Invite trusted people with a role-based starting point, then choose exactly what they can see. You can add more or change access later.</p>
    <LoadingScreen v-if="loading" variant="inline" label="Loading caregiver access" />
    <template v-else>
      <p v-if="error" class="app-error-text" role="alert">{{ error }}</p>
      <p v-if="status" class="cg__muted" role="status">{{ status }}</p>

      <form class="cg__card" @submit.prevent="addCaregiver">
        <h3>Add a caregiver</h3>
        <label class="cg__field"><span>Name (optional)</span><input v-model="form.name" class="app-control" maxlength="40" placeholder="Grandma" autocomplete="off" /></label>
        <label class="cg__field"><span>Caregiver role</span><SelectField :model-value="form.role" :options="CAREGIVER_ROLES" @change="setRole" /></label>
        <fieldset class="cg__permissions"><legend>Can access</legend>
          <div v-for="group in permissionGroups" :key="group.key" class="cg__group">
            <h4 class="cg__group-title">{{ group.label }}</h4>
            <Toggle v-for="permission in group.items" :id="`cg-new-${permission.key}`" :key="permission.key" :label="permission.label" :hint="lockHint(form.permissions, permission.key)" :disabled="lockedBy(form.permissions, permission.key)" :model-value="form.permissions[permission.key]" @update:model-value="setPermission(form, permission.key, $event)" />
          </div>
        </fieldset>
        <AppButton type="submit" variant="outline" :disabled="busy">{{ busy ? "Creating invite…" : "Create caregiver invite" }}</AppButton>
        <button v-if="pendingInvites.length && !showInvite" type="button" class="cg__link cg__showinvite" @click="showInvite = true">Show open invite</button>
        <div v-if="pendingInvites.length && showInvite" class="cg__pending">
          <h4>Open caregiver invite</h4>
          <article v-for="invite in pendingInvites" :key="invite.code" class="cg__invite-ready">
            <div class="cg__invite-top">
              <strong class="cg__invite-role">{{ invite.caregiverName || CAREGIVER_ROLES.find((role) => role.value === invite.caregiverRole)?.label || "Caregiver" }}</strong>
              <span v-if="invite.expiresAt" class="cg__invite-exp">{{ expiresInText(invite.expiresAt) }}</span>
            </div>
            <code class="cg__invite-code" aria-label="Invite code">{{ invite.code }}</code>
            <div class="cg__invite-actions">
              <button type="button" class="cg__copy" @click="copyInvite(invite.code)">{{ copiedCode === invite.code ? "Code copied ✓" : "Copy code" }}</button>
              <button class="cg__link" type="button" @click="revokeInvite(invite.code)">Cancel invite</button>
            </div>
          </article>
        </div>
      </form>

      <div v-if="caregiverMembers.length" class="cg__list">
        <h3>Current caregivers</h3>
        <article v-for="member in caregiverMembers" :key="member.uid" class="cg__card">
          <div class="cg__member-head"><div><h4>{{ member.displayName || "Caregiver" }} <span v-if="justJoined(member)" class="cg__new">New</span></h4><p class="cg__muted">Joined {{ member.joinedAt?.toDate?.().toLocaleDateString?.() || "the household" }}</p></div><button class="cg__link cg__link--danger" type="button" @click="removeMember(member)">Remove</button></div>
          <label class="cg__field"><span>Role</span><SelectField v-model="member.role" :options="CAREGIVER_ROLES" @change="editRole(member, $event); member.dirty = true" /></label>
          <fieldset class="cg__permissions"><legend>Can access</legend>
          <div v-for="group in permissionGroups" :key="group.key" class="cg__group">
            <h4 class="cg__group-title">{{ group.label }}</h4>
            <Toggle v-for="permission in group.items" :id="`cg-${member.uid}-${permission.key}`" :key="permission.key" :label="permission.label" :hint="lockHint(member.permissions, permission.key)" :disabled="lockedBy(member.permissions, permission.key)" :model-value="member.permissions[permission.key]" @update:model-value="setPermission(member, permission.key, $event); member.dirty = true" />
          </div>
        </fieldset>
          <AppButton v-if="member.dirty" variant="outline" size="sm" :disabled="member.saving" @click="saveMember(member)">{{ member.saving ? "Saving…" : "Save access" }}</AppButton>
        </article>
      </div>

      <form class="cg__card" @submit.prevent="saveBrief">
        <h3>Care brief for {{ briefBabyLabel }}</h3>
        <p class="cg__muted">Each baby has their own care instructions and contact details. Health instructions appear only for caregivers with health access.</p>
        <label class="cg__field"><span>Baby</span><SelectField :model-value="briefBabyId" :options="babyOptions" :disabled="busy || briefLoading" @change="selectBriefBaby" /></label>
        <p v-if="briefLoading" class="cg__muted" aria-live="polite">Loading this baby’s care brief…</p>
        <label v-for="item in [
  { key: 'feeding', label: 'Feeding instructions' },
          { key: 'napRoutine', label: 'Nap routine' },
          { key: 'allergies', label: 'Allergies' },
          { key: 'medications', label: 'Medication instructions' },
        ]" :key="item.key" class="cg__field"><span>{{ item.label }}</span><textarea v-model="brief[item.key]" class="app-control" rows="2" maxlength="500" :disabled="busy || briefLoading" :placeholder="({ feeding: 'e.g. bottle feed, use expressed milk from the freezer', napRoutine: 'e.g. nap at 3pm', allergies: 'e.g. peanut allergy, or none', medications: 'e.g. medicine name and dosage', parentContacts: 'e.g. phone numbers to call' })[item.key]" /></label>
        <fieldset class="cg__contacts" :disabled="busy || briefLoading">
          <legend>Parent phone numbers for this baby</legend>
          <div v-for="(row, index) in contacts" v-show="!row.note" :key="index" class="cg__contact">
            <SelectField v-model="row.who" class="cg__contact-who" :options="whoOptions(row)" placeholder="Which parent" :aria-label="`Parent for number ${index + 1}`" />
            <div class="cg__phone" :class="{ 'cg__phone--bad': row.phone && !isPhoneComplete(row.phone) }">
              <span class="cg__phone-flag" aria-hidden="true">+65</span>
              <input :value="row.phone" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="9123 4567" maxlength="9" :aria-label="`Phone number ${index + 1}`" @input="typePhone(row, $event)" />
            </div>
            <button type="button" class="cg__contact-x" :aria-label="`Remove number ${index + 1}`" @click="removeContact(index)">×</button>
          </div>
          <p v-if="contactsInvalid" class="cg__contact-hint" role="status">Phone numbers need 8 digits.</p>
          <button v-if="contacts.length < CONTACT_MAX" type="button" class="cg__link cg__addphone" @click="addContact">+ Add a number</button>
        </fieldset>
        <AppButton type="button" variant="outline" :disabled="busy || briefLoading || contactsInvalid" @click="saveBrief">{{ busy ? "Saving…" : "Save care brief" }}</AppButton>
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
.cg__group { display: flex; flex-direction: column; gap: 12px; }
.cg__group + .cg__group { padding-top: 14px; border-top: 1px dashed var(--sand, #e9d9b8); }
.cg__group-title { margin: 0; font-family: var(--nt-serif); font-size: 1.0625rem; font-weight: 700; color: var(--navy, #243560); }
.cg__permissions legend { padding: 0 6px; font-size: .875rem; font-weight: 600; }
.cg__pending { display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
.cg__pending h4 { margin: 0; font-family: var(--nt-serif); font-size: 1.0625rem; font-weight: 700; color: var(--navy, #243560); }
.cg__invite-ready { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 16px 18px 18px; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 18px; background: #fffdf8; }
.cg__invite-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; width: 100%; }
.cg__invite-role { font-family: var(--nt-serif); font-size: 1.125rem; font-weight: 700; color: var(--navy, #243560); }
.cg__invite-exp { padding: 4px 12px; background: #fbe3d3; border-radius: 999px; font-size: .8125rem; font-weight: 600; color: #8a3f14; }
.cg__invite-code { display: block; width: 100%; padding: 12px 16px; background: #fff; border: 1.5px dashed #d9c79d; border-radius: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1.375rem; font-weight: 700; letter-spacing: .14em; text-align: center; color: var(--navy, #243560); user-select: all; }
.cg__invite-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; }
.cg__copy { padding: 10px 20px; background: var(--navy, #243560); border: 0; border-bottom: 3px solid #182246; border-radius: 999px; color: #fff; font: inherit; font-size: .9375rem; font-weight: 700; cursor: pointer; }
.cg__copy:hover { background: #2c4175; }
.cg__copy:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 3px; }
.cg__actions, .cg__member-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.cg__actions { justify-content: flex-end; }
.cg__member-head h4 { margin: 0 0 4px; font-size: 1rem; }
.cg__new { display: inline-block; margin-left: 6px; padding: 2px 10px; background: #cfe3d4; border-radius: 999px; font-size: .8125rem; font-weight: 700; color: #2f5a46; vertical-align: 1px; }
.cg__link { padding: 4px 0; background: none; border: 0; color: var(--nt-plum); font: inherit; font-size: .875rem; text-decoration: underline; cursor: pointer; }
.cg__showinvite { align-self: flex-start; }
.cg__contacts { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; border: 0; }
.cg__contacts legend { float: none; width: auto; margin: 0 0 6px; padding: 0; font-size: .875rem; font-weight: 600; }
.cg__contact { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(150px, 1.2fr) auto; align-items: center; gap: 8px; }
.cg__phone { display: flex; align-items: center; min-height: 48px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 14px; overflow: hidden; }
.cg__phone:focus-within { border-color: var(--navy, #243560); box-shadow: 0 0 0 3px rgb(36 53 96 / 15%); }
.cg__phone--bad { border-color: #d78251; }
.cg__phone-flag { align-self: stretch; display: grid; place-items: center; padding: 0 12px; background: #fbf3e6; border-right: 1.5px solid var(--sand, #e9d9b8); font-size: .9375rem; font-weight: 700; color: var(--navy, #243560); }
.cg__phone input { flex: 1; min-width: 0; padding: 10px 14px; background: transparent; border: 0; outline: 0; font: inherit; font-size: 1rem; font-variant-numeric: tabular-nums; letter-spacing: .04em; color: var(--navy, #243560); }
.cg__contact-x { width: 36px; height: 36px; background: transparent; border: 0; border-radius: 50%; font-size: 1.25rem; line-height: 1; color: #a4541f; cursor: pointer; }
.cg__contact-x:hover { background: #fbe3d3; }
.cg__contact-hint { margin: 0; font-size: .8125rem; color: #a4541f; }
.cg__addphone { align-self: flex-start; }
@media (max-width: 560px) { .cg__contact { grid-template-columns: minmax(0, 1fr) auto; } .cg__contact-who { grid-column: 1 / -1; } }
.cg__link--danger { color: var(--nt-coral); }
.cg__invite-actions .cg__link { color: #a4541f; }
</style>
