import { computed, ref } from "vue";

const currentUser = ref(null);
export function useAuth() {
  const isAuthenticated = computed(() => currentUser.value !== null);
  return { currentUser, isAuthenticated };
}
