import { computed, getCurrentScope, onScopeDispose, ref, watch } from "vue";
import { subscribeHandovers } from "@/app/api/handovers";
import { toDate } from "@/app/api/entryHelpers";

// Key used by the layout to share one handovers listener with its child pages.
export const HANDOVERS_KEY = Symbol("app-handovers");

export const HANDOVERS_PAGE_SIZE = 30;
const LOAD_TIMEOUT_MS = 15000;

// One live listener on the household's newest handovers, built like useEntries. The same
// list feeds the handover page, the Home line and the care log dividers, so there is only
// ever one query. `householdId` may be empty at first, and until it has a value `loading`
// stays true and `error` stays null.
export function useHandovers(householdId, meUid, { max = HANDOVERS_PAGE_SIZE } = {}) {
  const handovers = ref([]);
  const loading = ref(true);
  const error = ref(null); // { code } or null
  let unsubscribe = null;
  let timer = null;
  let run = 0;

  function stop() {
    run += 1;
    clearTimeout(timer);
    timer = null;
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  }

  function fail(cause) {
    clearTimeout(timer);
    loading.value = false;
    error.value = { code: cause?.code ?? "unknown" };
  }

  function start() {
    stop();
    const current = run;
    const id = householdId?.value ?? "";
    error.value = null;
    handovers.value = [];
    loading.value = true;
    if (!id) return;
    timer = setTimeout(() => {
      if (current === run && loading.value) fail({ code: "timeout" });
    }, LOAD_TIMEOUT_MS);
    try {
      unsubscribe = subscribeHandovers(
        id,
        (list) => {
          if (current !== run) return;
          clearTimeout(timer);
          handovers.value = list;
          loading.value = false;
          error.value = null;
        },
        (cause) => {
          if (current === run) fail(cause);
        },
        { max },
      );
    } catch (cause) {
      console.error("[app handover]", cause?.code, cause);
      fail(cause);
    }
  }

  // The newest handover of all, whoever sent it.
  const latest = computed(() => handovers.value[0] ?? null);

  // The newest handover sent to me that I have not accepted yet.
  const waitingForMe = computed(() => {
    const uid = meUid?.value ?? "";
    if (!uid) return null;
    return handovers.value.find((h) => h.to === uid && !toDate(h.acceptedAt)) ?? null;
  });

  const waitingCount = computed(() => {
    const uid = meUid?.value ?? "";
    if (!uid) return 0;
    return handovers.value.filter((h) => h.to === uid && !toDate(h.acceptedAt)).length;
  });

  watch(() => householdId?.value, start, { immediate: true });
  if (getCurrentScope()) onScopeDispose(stop);

  return { handovers, loading, error, latest, waitingForMe, waitingCount, retry: start, stop };
}
