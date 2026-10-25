import { getCurrentScope, onScopeDispose, watch } from "vue";
import { useCalendarStore } from "@/app/stores/calendar";
import { useCheckinsStore } from "@/app/stores/checkins";
import { useChatStore } from "@/app/stores/chat";
import { usePostsStore } from "@/app/stores/posts";
import { useReturnToWorkStore } from "@/app/stores/returnToWork";
import { useRotaStore } from "@/app/stores/rota";
import { useTeamStore } from "@/app/stores/team";

// Key used by the layout to share the bound shared stores with its child pages.
export const SHARED_KEY = Symbol("app-shared");

// Binds the shared stores (sleep rota, calendar, return to work, household messages, shared feelings
// and the chat) to one household,
// the way useEntries binds the care log. `householdId`, `meUid` and `partnerUid` are refs
// that may be empty at first, so the pages show loading, never an error, until the id exists.
export function useShared(householdId, meUid, partnerUid) {
  const rota = useRotaStore();
  const calendar = useCalendarStore();
  const rtw = useReturnToWorkStore();
  const posts = usePostsStore();
  const team = useTeamStore();
  const chat = useChatStore();
  const checkins = useCheckinsStore();
  const stores = [rota, calendar, rtw, posts, team, chat, checkins];

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

  return { rota, calendar, rtw, posts, team, chat, checkins, retry: start, stop };
}
