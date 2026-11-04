import { computed, onBeforeUnmount, ref, watch } from "vue";
import { subscribeHouseholdMembers } from "@/api/profile";
import { CAREGIVER_ROLES } from "@/app/utils/caregiverHelpers";

// Key used by the layout to share the list of new caregivers with the pages.
export const CAREGIVER_JOINS_KEY = Symbol("app-caregiver-joins");

// Tells a parent when somebody joins as a caregiver. Which caregivers they have already been told
// about is kept on this device, per account and household. The first time a household is seen, the
// caregivers who are already there count as known, so only people who arrive later are announced.
const storeKey = (uid, hid) => `nt.app.caregivers-known:${uid}:${hid}`;
function readKnown(uid, hid) {
  try {
    const raw = localStorage.getItem(storeKey(uid, hid));
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}
function writeKnown(uid, hid, ids) {
  try {
    localStorage.setItem(storeKey(uid, hid), JSON.stringify(ids));
  } catch {
    // Without storage the notice simply comes back next visit.
  }
}

export function useCaregiverJoins(householdId, myUid, onJoin = () => {}) {
  const members = ref([]);
  const known = ref([]);
  let stop = null;
  let ready = false;

  function begin(hid, uid) {
    stop?.();
    stop = null;
    ready = false;
    members.value = [];
    if (!hid || !uid) return;
    const saved = readKnown(uid, hid);
    known.value = saved ?? [];
    stop = subscribeHouseholdMembers(
      hid,
      (list) => {
        const caregivers = list.filter((m) => m.accessLevel === "caregiver");
        if (saved === null && !ready) {
          // First visit: everyone already here is known.
          known.value = caregivers.map((m) => m.uid);
          writeKnown(uid, hid, known.value);
        } else if (ready) {
          const fresh = caregivers.filter((m) => !known.value.includes(m.uid) && !members.value.some((old) => old.uid === m.uid));
          fresh.forEach((m) => onJoin(describe(m)));
        }
        members.value = caregivers;
        ready = true;
      },
      (cause) => console.error("[app caregiver joins]", cause?.code, cause),
    );
  }
  watch([householdId, myUid], ([hid, uid]) => begin(hid, uid), { immediate: true });
  onBeforeUnmount(() => stop?.());

  const unseen = computed(() => members.value.filter((m) => !known.value.includes(m.uid)).map(describe));
  function markSeen() {
    known.value = members.value.map((m) => m.uid);
    if (householdId.value && myUid.value) writeKnown(myUid.value, householdId.value, known.value);
  }
  return { unseen, markSeen };
}

function describe(member) {
  const role = CAREGIVER_ROLES.find((r) => r.value === member.role)?.label ?? "Caregiver";
  return { uid: member.uid, name: (member.displayName || "").trim() || "A caregiver", role };
}
