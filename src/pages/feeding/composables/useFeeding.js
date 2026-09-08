import { onUnmounted, ref, toValue, watch } from "vue";
import {
  addFeeding,
  getFeedingsByBaby,
  subscribeToFeedings,
} from "@/api/feedingApi";
import { useAuth } from "@/composables/useAuth";

export function useFeeding(babyId) {
  const { currentUser } = useAuth();
  const feedings = ref([]);
  const loading = ref(true);
  const error = ref(null);
  let unsubscribe;

  function stopSubscription() {
    unsubscribe?.();
    unsubscribe = undefined;
  }

  function subscribe(id) {
    stopSubscription();
    feedings.value = [];

    if (!id) {
      loading.value = false;
      return;
    }

    loading.value = true;
    error.value = null;
    unsubscribe = subscribeToFeedings(
      id,
      (records) => {
        feedings.value = records;
        loading.value = false;
      },
      (cause) => {
        error.value = cause;
        loading.value = false;
      },
    );
  }

  watch(() => toValue(babyId), subscribe, { immediate: true });
  onUnmounted(stopSubscription);

  async function loadFeedings() {
    const id = toValue(babyId);
    loading.value = true;
    error.value = null;
    try {
      feedings.value = await getFeedingsByBaby(id);
    } catch (cause) {
      error.value = cause;
      throw cause;
    } finally {
      loading.value = false;
    }
  }
  async function saveFeeding(feeding) {
    if (!currentUser.value?.uid) {
      throw new Error("You must be signed in to add a feeding.");
    }
    return addFeeding({
      ...feeding,
      babyId: feeding.babyId ?? toValue(babyId),
      caregiverId: currentUser.value.uid,
    });
  }
  return {
    feedings,
    loading,
    error,
    loadFeedings,
    saveFeeding,
    stopSubscription,
  };
}
