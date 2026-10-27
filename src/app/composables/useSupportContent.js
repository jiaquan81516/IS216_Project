import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { subscribeSupportList } from "@/api/supportContent";
import { SUPPORT_GUIDES, TRUSTED_RESOURCES, contactHref } from "@/app/data/support";

// Support page text: what an administrator saved, or the built-in defaults when nothing is
// saved yet (or the read fails). Each list is live, so edits show without a refresh.
export function useSupportContent() {
  const savedGuides = ref(null);
  const savedContacts = ref(null);
  const stops = [];
  onMounted(() => {
    stops.push(
      subscribeSupportList("guides", (items) => (savedGuides.value = items), () => (savedGuides.value = null)),
      subscribeSupportList("contacts", (items) => (savedContacts.value = items), () => (savedContacts.value = null)),
    );
  });
  onBeforeUnmount(() => stops.forEach((stop) => stop()));
  const guides = computed(() => savedGuides.value ?? SUPPORT_GUIDES);
  const contacts = computed(() =>
    (savedContacts.value ?? TRUSTED_RESOURCES).map((c) => ({ ...c, tel: contactHref(c) })),
  );
  return { guides, contacts, savedGuides, savedContacts };
}
