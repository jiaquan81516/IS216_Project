import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/api/db";
import { SUPPORT_GUIDES } from "@/app/data/support";

export function useSupportGuides() {
  const added = ref([]);
  const error = ref("");
  let stop;
  onMounted(() => {
    stop = onSnapshot(collection(db, "supportGuides"), (snapshot) => {
      added.value = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id, slug: doc.id.startsWith("seed-") ? doc.id.slice(5) : `custom-${doc.id}` }));
      error.value = "";
    }, () => { error.value = "Additional guides could not be loaded. Please try again."; });
  });
  onBeforeUnmount(() => stop?.());
  return { guides: computed(() => {
    const merged = new Map(SUPPORT_GUIDES.map((guide) => [guide.slug, guide]));
    for (const guide of added.value) {
      if (guide.deleted) merged.delete(guide.slug);
      else merged.set(guide.slug, guide);
    }
    return [...merged.values()];
  }), guidesError: error };
}
