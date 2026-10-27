import { ref } from "vue";
import { useAuth } from "@/composables/useAuth";
import { SUPPORT_MAX_ITEMS, saveSupportList } from "@/api/supportContent";

const clone = (value) => JSON.parse(JSON.stringify(value));
const uid = () => Math.random().toString(36).slice(2, 8);

// Add, edit, delete and reorder for one Support list ("guides" or "contacts") on the
// Support page itself. `items` is what the page shows now; every change saves the whole list.
export function useSupportEditor(kind, items) {
  const isGuides = kind === "guides";
  const { currentUser } = useAuth();
  const editing = ref(null); // { index, draft }; index -1 is a new item
  const confirming = ref(-1);
  const busy = ref(false);
  const error = ref("");

  const blank = () =>
    isGuides
      ? { slug: `guide-${uid()}`, title: "", blurb: "", intro: "", steps: [{ title: "", body: "" }], callIfText: "" }
      : { id: `contact-${uid()}`, name: "", purpose: "", telLabel: "" };

  function start(index) {
    const draft = index < 0 ? blank() : clone(items.value[index]);
    if (isGuides && index >= 0) draft.callIfText = (draft.callIf ?? []).join("\n");
    editing.value = { index, draft };
    confirming.value = -1;
    error.value = "";
  }

  function cancel() {
    editing.value = null;
    error.value = "";
  }

  function clean(draft) {
    if (isGuides) {
      return {
        slug: draft.slug,
        title: draft.title.trim(),
        blurb: draft.blurb.trim(),
        intro: draft.intro.trim(),
        steps: draft.steps.map((s) => ({ title: s.title.trim(), body: s.body.trim() })).filter((s) => s.title || s.body),
        callIf: draft.callIfText.split("\n").map((line) => line.trim()).filter(Boolean),
      };
    }
    return { id: draft.id, name: draft.name.trim(), purpose: draft.purpose.trim(), telLabel: draft.telLabel.trim() };
  }

  // Saved contacts keep only their number as typed; the page builds the call link.
  const strip = (list) =>
    isGuides ? list : list.map((c) => ({ id: c.id, name: c.name, purpose: c.purpose, telLabel: c.telLabel ?? "" }));

  async function persist(next, after) {
    if (busy.value) return;
    busy.value = true;
    error.value = "";
    try {
      await saveSupportList(currentUser.value?.uid, kind, strip(next));
      after?.();
    } catch (cause) {
      console.error("[app support content]", cause?.code, cause);
      error.value =
        cause?.code === "permission-denied"
          ? "The database refused that. Publish the latest firestore.rules and check this account has the admin claim."
          : "We could not save that. Try again.";
    } finally {
      busy.value = false;
    }
  }

  function save() {
    const item = clean(editing.value.draft);
    if (!(isGuides ? item.title : item.name)) {
      error.value = isGuides ? "Enter a title." : "Enter a name.";
      return;
    }
    const next = clone(items.value);
    if (editing.value.index < 0) next.push(item);
    else next[editing.value.index] = item;
    persist(next, () => (editing.value = null));
  }

  function remove(index) {
    const next = clone(items.value);
    next.splice(index, 1);
    persist(next, () => (confirming.value = -1));
  }

  const atLimit = () => items.value.length >= SUPPORT_MAX_ITEMS;
  return { editing, confirming, busy, error, start, cancel, save, remove, atLimit };
}
