import { computed, getCurrentScope, onScopeDispose, ref, watch } from "vue";
import { subscribeEntries } from "@/api/entries";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";

// Key used by the layout to share one entries listener with its child pages.
export const ENTRIES_KEY = Symbol("app-entries");

export const ENTRIES_PAGE_SIZE = 50;
const LOAD_TIMEOUT_MS = 15000;

// One live listener on the household's newest entries. `householdId` is a ref that may be
// empty at first (the layout loads it asynchronously); until it has a value `loading` stays
// true and `error` stays null, so the page never shows an error for a missing id.
export function useEntries(householdId, { max = ENTRIES_PAGE_SIZE } = {}) {
  const allEntries = ref([]); // everything the listener returns
  const { selectedBaby } = useSelectedBaby();
  // What pages see: only the selected baby's entries. Entries saved before babies existed
  // have no babyId, so they count as the first baby ("primary").
  const entries = computed(() => {
    const id = selectedBaby.value?.id ?? "primary";
    return allEntries.value.filter((e) => (e.babyId ?? "primary") === id);
  });
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
    allEntries.value = [];
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
          allEntries.value = list;
          loading.value = false;
          error.value = null;
        },
        (cause) => {
          if (current === run) fail(cause);
        },
        { max },
      );
    } catch (cause) {
      console.error("[app care log]", cause?.code, cause);
      fail(cause);
    }
  }

  watch(householdId, start, { immediate: true });
  if (getCurrentScope()) onScopeDispose(stop);

  return { entries, raw: allEntries, loading, error, retry: start, stop };
}
