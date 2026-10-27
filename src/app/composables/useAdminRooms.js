import { onBeforeUnmount, onMounted, ref } from "vue";
import { subscribePendingRooms, subscribeReviewedRooms } from "@/api/roomApproval";

// One live list for the admin page: its items, whether it is still loading and any error.
function track(subscribe, failure) {
  const list = ref([]);
  const loading = ref(true);
  const error = ref("");
  let stop = null;
  function start() {
    stop = subscribe(
      (items) => {
        list.value = items;
        loading.value = false;
        error.value = "";
      },
      () => {
        loading.value = false;
        error.value = failure;
      },
    );
  }
  return { list, loading, error, start, end: () => stop?.() };
}

export function useAdminRooms() {
  const pending = track(subscribePendingRooms, "Pending rooms could not be loaded. Refresh and try again.");
  const reviewed = track(subscribeReviewedRooms, "Reviewed rooms could not be loaded. Refresh and try again.");
  const all = [pending, reviewed];
  onMounted(() => all.forEach((item) => item.start()));
  onBeforeUnmount(() => all.forEach((item) => item.end()));
  return { pending, reviewed };
}
