import { ref } from "vue";
import { getCalendarEntries } from "@/api/calendarApi";

export function useCalendar() {
  const entries = ref([]);
  async function loadEntries() {
    entries.value = await getCalendarEntries();
  }
  return { entries, loadEntries };
}
