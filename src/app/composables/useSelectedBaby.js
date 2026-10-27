import { computed, ref } from "vue";
import { getHouseholdBabies } from "@/api/profile";

// Declared outside the function so every page shares the same values.
function readSaved() {
  try {
    return localStorage.getItem("selectedBabyId") || "primary";
  } catch {
    return "primary";
  }
}

const babies = ref([]);
const selectedBabyId = ref(readSaved());
const babyLoadError = ref(null);

export function useSelectedBaby() {
  const selectedBaby = computed(
    () => babies.value.find((b) => b.id === selectedBabyId.value) ?? babies.value[0] ?? null,
  );

  async function loadBabies(householdId) {
    try {
      babies.value = await getHouseholdBabies(householdId);
      babyLoadError.value = null;
      // A saved selection may belong to another household. Keep the selected id valid
      // before any new care entries are created for this household.
      if (!babies.value.some((baby) => baby.id === selectedBabyId.value)) {
        selectBaby(babies.value[0]?.id ?? "primary");
      }
    } catch (cause) {
      babies.value = [];
      babyLoadError.value = cause?.code ?? "unknown";
      selectBaby("primary");
    }
  }

  function selectBaby(id) {
    selectedBabyId.value = id;
    try {
      localStorage.setItem("selectedBabyId", id);
    } catch {
      // Saving is optional; the choice still works for this visit.
    }
  }

  return { babies, selectedBaby, selectedBabyId, babyLoadError, loadBabies, selectBaby };
}
