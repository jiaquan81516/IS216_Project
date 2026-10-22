import { computed, ref } from "vue";
import { useAuth } from "@/composables/useAuth";
import { babySummary, getHousehold, getHouseholdMembers, getUserProfile } from "@/api/profile";
import { normaliseSettings } from "@/app/utils/settingsHelpers";
import { withTimeout } from "@/app/utils/timeout";
import { setDisplay } from "@/app/composables/usePrefs";
import { isPrimaryParent } from "@/app/utils/caregiverHelpers";
import { hasAdminClaim } from "@/api/adminAccess";

// Key used by the layout to share one household load with its child pages.
export const HOME_KEY = Symbol("app-home");

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

export function useHome() {
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
      if (!loadedProfile?.householdId && await hasAdminClaim(user)) {
        if (id !== run) return;
        profile.value = loadedProfile;
        householdData.value = null;
        members.value = [];
        setDisplay(normaliseSettings(loadedProfile?.settings).display);
        return;
      }
      if (!loadedProfile?.householdId) throw new Error("No household");
      const [loadedHousehold, loadedMembers] = await Promise.all([
        withTimeout(getHousehold(loadedProfile.householdId)),
        withTimeout(getHouseholdMembers(loadedProfile.householdId)),
      ]);
      if (!loadedHousehold) throw new Error("Household not found");
      if (id !== run) return;
      profile.value = loadedProfile;
      // The display preferences travel with the profile, so every App page can read them.
      setDisplay(normaliseSettings(loadedProfile.settings).display);
      householdData.value = loadedHousehold;
      members.value = loadedMembers;
    } catch (cause) {
      if (id !== run) return;
      console.error("[app home]", cause);
      error.value = cause?.code === "permission-denied"
        ? "Your account does not have permission to view this household. Parent accounts need household access; caregivers should use the Care Brief."
        : "We could not load your household. Check your connection and try again.";
    } finally {
      if (id === run) loading.value = false;
    }
  }

  const me = computed(() => {
    const user = currentUser.value;
    const displayName = profile.value?.displayName || user?.displayName || "";
    const email = profile.value?.email || user?.email || "";
    return { uid: user?.uid ?? "", firstName: firstNameOf(displayName, email), displayName, email };
  });

  const partner = computed(() => {
    // Caregivers share the household too, but they are not the other parent.
    // Keep them out of every UI and shared-data path that consumes `partner`.
    const other = members.value.find((m) => m.uid !== me.value.uid && isPrimaryParent(m));
    return other ? { ...other, firstName: firstNameOf(other.displayName, "") } : null;
  });

  const baby = computed(() => babySummary(householdData.value ?? {}));
  const householdId = computed(() => profile.value?.householdId ?? "");
  const inviteCode = computed(() => householdData.value?.inviteCode ?? "");
  const settings = computed(() => normaliseSettings(profile.value?.settings));

  reload();

  return {
    loading,
    error,
    reload,
    me,
    partner,
    profile,
    settings,
    household: householdData,
    householdId,
    baby,
    inviteCode,
  };
}
