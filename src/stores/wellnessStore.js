import { defineStore } from "pinia";
import { ref } from "vue";

export const useWellnessStore = defineStore("wellness", () => {
  const entries = ref([]);
  return { entries };
});
