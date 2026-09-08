import { ref } from "vue";
import { getCaregivers, inviteCaregiver } from "@/api/sharedCareApi";

export function useSharedCare() {
  const caregivers = ref([]);
  async function loadCaregivers() {
    caregivers.value = await getCaregivers();
  }
  return { caregivers, loadCaregivers, inviteCaregiver };
}
