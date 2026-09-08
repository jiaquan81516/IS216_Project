import { ref } from "vue";
import { addJournalEntry, getJournalEntriesByUser } from "@/api/wellnessApi";
import { useAuth } from "@/composables/useAuth";

export function useJournal() {
  const { currentUser } = useAuth();
  const text = ref("");
  const entries = ref([]);
  const loading = ref(false);
  const error = ref(null);

  function clear() {
    text.value = "";
  }

  async function loadEntries() {
    loading.value = true;
    error.value = null;
    try {
      entries.value = await getJournalEntriesByUser(currentUser.value?.uid);
    } catch (cause) {
      error.value = cause;
      throw cause;
    } finally {
      loading.value = false;
    }
  }

  async function saveEntry() {
    const result = await addJournalEntry({
      userId: currentUser.value?.uid,
      content: text.value,
    });
    clear();
    return result;
  }

  return { text, entries, loading, error, clear, loadEntries, saveEntry };
}
