import { getCurrentScope, onScopeDispose, ref, watch } from "vue";
import { subscribeEntries } from "@/v3/api/entries";

// Key used by the layout to share one entries listener with its child pages.
export const V3_ENTRIES_KEY = Symbol("v3-entries");

export const ENTRIES_PAGE_SIZE = 50;
const LOAD_TIMEOUT_MS = 15000;

// One live listener on the household's newest entries. `householdId` is a ref that may be
// empty at first (the layout loads it asynchronously); until it has a value `loading` stays
// true and `error` stays null, so the page never shows an error for a missing id.
export function useV3Entries(householdId, { max = ENTRIES_PAGE_SIZE } = {}) {
  const entries = ref([]);
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
    const id = householdId.value;
    error.value = null;
    entries.value = [];
    loading.value = true;
    if (!id) return;
    timer = setTimeout(() => {
      if (current === run && loading.value) fail({ code: "timeout" });
    }, LOAD_TIMEOUT_MS);
    try {
      unsubscribe = subscribeEntries(
        id,
        (list) => {
          if (current !== run) return;
          clearTimeout(timer);
          entries.value = list;
          loading.value = false;
          error.value = null;
        },
        (cause) => {
          if (current === run) fail(cause);
        },
        { max },
      );
    } catch (cause) {
      console.error("[v3 care log]", cause?.code, cause);
      fail(cause);
    }
  }

  watch(householdId, start, { immediate: true });
  if (getCurrentScope()) onScopeDispose(stop);

  return { entries, loading, error, retry: start, stop };
}
