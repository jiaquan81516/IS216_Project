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

export function useSelectedBaby() {
  const selectedBaby = computed(
    () => babies.value.find((b) => b.id === selectedBabyId.value) ?? babies.value[0] ?? null,
  );

  async function loadBabies(householdId) {
    try {
      babies.value = await getHouseholdBabies(householdId);
    } catch {
      babies.value = [];
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

  return { babies, selectedBaby, selectedBabyId, loadBabies, selectBaby };
}