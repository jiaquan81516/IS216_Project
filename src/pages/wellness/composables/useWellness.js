import { ref } from "vue";
import { addWellnessEntry, getWellnessEntries } from "@/api/wellnessApi";

export function useWellness() {
  const entries = ref([]);
  async function loadEntries() {
    entries.value = await getWellnessEntries();
  }
  async function saveEntry(entry) {
    return addWellnessEntry(entry);
  }
  return { entries, loadEntries, saveEntry };
}
