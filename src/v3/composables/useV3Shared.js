import { getCurrentScope, onScopeDispose, watch } from "vue";
import { useCalendarStore } from "@/v3/stores/calendar";
import { useReturnToWorkStore } from "@/v3/stores/returnToWork";
import { useRotaStore } from "@/v3/stores/rota";

// Key used by the layout to share the bound shared stores with its child pages.
export const V3_SHARED_KEY = Symbol("v3-shared");

// Binds the three shared stores (sleep rota, calendar, return to work) to one household,
// the way useV3Entries binds the care log. `householdId`, `meUid` and `partnerUid` are refs
// that may be empty at first, so the pages show loading, never an error, until the id exists.
export function useV3Shared(householdId, meUid, partnerUid) {
  const rota = useRotaStore();
  const calendar = useCalendarStore();
  const rtw = useReturnToWorkStore();
  const stores = [rota, calendar, rtw];

  function stop() {
    for (const store of stores) store.unbind();
  }

  function start() {
    stop();
    const id = householdId?.value ?? "";
    const uid = meUid?.value ?? "";
    const partner = partnerUid?.value ?? "";
    if (!id) return;
    for (const store of stores) store.bind(id, uid, partner);
  }

  watch([() => householdId?.value, () => meUid?.value], start, { immediate: true });
  // A partner joining later only changes who writes are attributed to, so it never needs
  // the listeners to be set up again.
  watch(
    () => partnerUid?.value,
    (uid) => {
      for (const store of stores) store.setPartnerUid(uid ?? "");
    },
  );
  if (getCurrentScope()) onScopeDispose(stop);

  return { rota, calendar, rtw, retry: start, stop };
}
