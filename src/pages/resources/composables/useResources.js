import { computed, ref } from "vue";
import { getResources } from "@/api/resourceApi";
import { filterResources } from "@/pages/resources/shared/functions/resourceFilterFunctions";

export function useResources() {
  const resources = ref([]);
  const searchTerm = ref("");
  const filteredResources = computed(() =>
    filterResources(resources.value, searchTerm.value),
  );
  async function loadResources() {
    resources.value = await getResources();
  }
  return { resources, searchTerm, filteredResources, loadResources };
}
