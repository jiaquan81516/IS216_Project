import { reactive } from "vue";

// Placeholder rota for the week of Mon 5 to Sun 11 October. D = Daniel, M = Mei.
export const TONIGHT_ID = "tue";

const initialNights = () => [
  { id: "mon", day: "Mon 5", date: "Mon 5 Oct", who: "D", pending: false },
  { id: "tue", day: "Tue 6", date: "Tue 6 Oct", who: "M", pending: false },
  { id: "wed", day: "Wed 7", date: "Wed 7 Oct", who: "D", pending: false },
  { id: "thu", day: "Thu 8", date: "Thu 8 Oct", who: "M", pending: true },
  { id: "fri", day: "Fri 9", date: "Fri 9 Oct", who: "D", pending: true },
  { id: "sat", day: "Sat 10", date: "Sat 10 Oct", who: "M", pending: false },
  { id: "sun", day: "Sun 11", date: "Sun 11 Oct", who: "D", pending: false },
];

export const rota = reactive(initialNights());

// Mei's open request: Daniel takes `youTake`, Mei takes `sheTakes`.
export const swapBanner = reactive({ open: true, youTake: "thu", sheTakes: "fri", sentAt: "9:12 PM" });

export const WHO_NAME = { D: "Daniel", M: "Mei" };

const find = (id) => rota.find((n) => n.id === id);

export function resetRota() {
  rota.splice(0, rota.length, ...initialNights());
  Object.assign(swapBanner, { open: true, youTake: "thu", sheTakes: "fri", sentAt: "9:12 PM" });
}

// Exchange who is on call for two nights and clear their pending flags.
export function swapNights(idA, idB) {
  const a = find(idA);
  const b = find(idB);
  if (!a || !b) return false;
  [a.who, b.who] = [b.who, a.who];
  a.pending = false;
  b.pending = false;
  return true;
}

export function acceptSwap() {
  swapNights(swapBanner.youTake, swapBanner.sheTakes);
  swapBanner.open = false;
}

export function declineSwap() {
  for (const id of [swapBanner.youTake, swapBanner.sheTakes]) {
    const n = find(id);
    if (n) n.pending = false;
  }
  swapBanner.open = false;
}

// Daniel asks Mei to swap one of his nights for one of hers.
export function requestSwap(myId, theirId) {
  const a = find(myId);
  const b = find(theirId);
  if (!a || !b) return false;
  a.pending = true;
  b.pending = true;
  return true;
}

export function takeOverTonight() {
  const n = find(TONIGHT_ID);
  if (n) n.who = "D";
}
