import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";

const STORAGE_KEY = "nt.app.draft";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return {
      journey: data.journey ?? null,
      role: data.role ?? null,
      name: data.name ?? "",
    };
  } catch {
    return { journey: null, role: null, name: "" };
  }
}

function save(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be blocked; the draft then lives in memory only.
  }
}

export const useOnboarding = defineStore("app-onboarding", () => {
  const initial = load();
  const journey = ref(initial.journey);
  const role = ref(initial.role);
  const name = ref(initial.name);
  // The email and password are held in memory only, never written to storage, and only until the
  // account is created at the last setup step.
  const email = ref("");
  const password = ref("");
  const hasAccount = computed(() => Boolean(email.value && password.value));

  watch([journey, role, name], () => {
    save({ journey: journey.value, role: role.value, name: name.value });
  });

  function setJourney(value) {
    journey.value = value;
  }

  function setRole(value) {
    role.value = value;
  }

  function clearAccount() {
    email.value = "";
    password.value = "";
  }

  function reset() {
    clearAccount();
    journey.value = null;
    role.value = null;
    name.value = "";
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore blocked storage.
    }
  }

  return { journey, role, name, email, password, hasAccount, setJourney, setRole, clearAccount, reset };
});
