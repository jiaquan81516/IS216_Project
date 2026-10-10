import { defineStore } from "pinia";
import { reactive, toRefs, watch } from "vue";
import { SAMPLE } from "@/shared/constants/appConstants";

const KEY = "nt.household.v1";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

// Onboarding answers and household settings. Local only for now.
// When Firestore is connected, replace load/save with reads and writes to the household document.
export const useHouseholdStore = defineStore("household", () => {
  const state = reactive({
    onboarded: false,
    displayName: SAMPLE.me,
    role: "dad", // mum | dad | carer
    confidence: null, // 0 to 4, private to this parent
    baby: { name: SAMPLE.baby, born: true, dob: "2026-09-15", weightKg: "", feeding: ["breast", "formula"] },
    partnerInvited: false,
    nights: { first: "M", start: "6:00 PM", end: "6:00 AM", mode: "alternate" },
    alerts: { feeds: true, partnerLogs: true, handovers: true, checkIn: true },
    ...load(),
  });

  watch(state, (v) => localStorage.setItem(KEY, JSON.stringify(v)), { deep: true });

  function completeOnboarding() {
    state.onboarded = true;
  }
  function reset() {
    localStorage.removeItem(KEY);
    location.reload();
  }

  return { ...toRefs(state), completeOnboarding, reset };
});
