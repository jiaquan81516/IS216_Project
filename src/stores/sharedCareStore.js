import { defineStore } from "pinia";
import { ref } from "vue";

export const useSharedCareStore = defineStore("shared-care", () => {
  const caregivers = ref([]);
  return { caregivers };
});
