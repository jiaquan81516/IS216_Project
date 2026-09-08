import { defineStore } from "pinia";
import { ref } from "vue";

export const useFeedingStore = defineStore("feeding", () => {
  const feedings = ref([]);
  const selectedBaby = ref(null);
  return { feedings, selectedBaby };
});
