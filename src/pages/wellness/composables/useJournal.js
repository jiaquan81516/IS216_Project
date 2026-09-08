import { ref } from "vue";

export function useJournal() {
  const text = ref("");
  function clear() {
    text.value = "";
  }
  return { text, clear };
}
