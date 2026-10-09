import { computed, ref } from "vue";
import { useAuth } from "@/composables/useAuth";
import { babySummary, getHousehold, getHouseholdMembers, getUserProfile } from "@/v3/api/profile";
import { withTimeout } from "@/v3/api/timeout";

// Key used by the layout to share one household load with its child pages.
export const V3_HOME_KEY = Symbol("v3-home");

export function firstNameOf(displayName, email) {
  const fromName = String(displayName ?? "").trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const fromEmail = String(email ?? "").split("@")[0].trim();
  return fromEmail || "there";
}

// Display helper: capitalises the first letter only. Stored data is never changed.
export function displayName(name) {
  const text = String(name ?? "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Turns a babySummary into a sentence such as "Aria is 6 weeks old". Empty when no line exists.
export function babySentence(baby) {
  const line = baby?.line ?? "";
  if (!line) return "";
  const subject = baby.name || "Baby";
  if (line === "Born today") return `${subject} was born today`;
  if (line === "Past due date") return `${subject} is past the due date`;
  return `${subject} is ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
}

export function useV3Home() {
  const { currentUser } = useAuth();
  const loading = ref(true);
  const error = ref("");
  const profile = ref(null);
  const householdData = ref(null);
  const members = ref([]);
  let run = 0;

  async function reload() {
    const id = ++run;
    loading.value = true;
    error.value = "";
    try {
      const user = currentUser.value;
      if (!user) throw new Error("Not signed in");
      const loadedProfile = await withTimeout(getUserProfile(user.uid));
      if (!loadedProfile?.householdId) throw new Error("No household");
      const [loadedHousehold, loadedMembers] = await Promise.all([
        withTimeout(getHousehold(loadedProfile.householdId)),
        withTimeout(getHouseholdMembers(loadedProfile.householdId)),
      ]);
      if (!loadedHousehold) throw new Error("Household not found");
      if (id !== run) return;
      profile.value = loadedProfile;
      householdData.value = loadedHousehold;
      members.value = loadedMembers;
    } catch (cause) {
      if (id !== run) return;
      console.error("[v3 home]", cause);
      error.value = "We could not load your household. Check your connection and try again.";
    } finally {
      if (id === run) loading.value = false;
    }
  }

  const me = computed(() => {
    const user = currentUser.value;
    const displayName = profile.value?.displayName || user?.displayName || "";
    const email = profile.value?.email || user?.email || "";
    return { uid: user?.uid ?? "", firstName: firstNameOf(displayName, email), displayName };
  });

  const partner = computed(() => {
    const other = members.value.find((m) => m.uid !== me.value.uid);
    return other ? { ...other, firstName: firstNameOf(other.displayName, "") } : null;
  });

  const baby = computed(() => babySummary(householdData.value ?? {}));
  const householdId = computed(() => profile.value?.householdId ?? "");
  const inviteCode = computed(() => householdData.value?.inviteCode ?? "");

  reload();

  return { loading, error, reload, me, partner, household: householdData, householdId, baby, inviteCode };
}
