import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { clearFeeling, setFeeling, subscribeFeelings } from "@/api/team";
import { notifyPartner } from "@/api/push";

export const SHARE_KEY = "nt.app.share-feeling";
export const NUDGES_KEY = "nt.app.nudges";
// These choices belong to a person, not to the browser, so each account has its own copy. Two
// parents signed in on the same device then never share or hide each other's prompts.
export const keyFor = (base, uid) => (uid ? `${base}:${uid}` : base);

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked. The choice then only lasts for this page view.
  }
}

function writeMessage(cause, fallback) {
  if (cause?.code === "permission-denied") {
    return "Your database rules do not allow this yet. Publish the latest firestore.rules in the Firebase console, then try again.";
  }
  return fallback;
}

// What a partner can choose to share: an optional "how I feel" word.
// The private check-in itself never leaves the device. Only the one word is written, and only
// when this person turned sharing on.
export const useTeamStore = defineStore("app-team", () => {
  const feelings = ref({}); // uid -> { level, date }
  const loading = ref(true);
  const error = ref(null); // { code } or null
  const writeError = ref("");
  const householdId = ref("");
  const meUid = ref("");
  const partnerUid = ref("");
  const shareOn = ref(false);
  const dismissed = ref({});

  let stops = [];
  let run = 0;

  const partnerFeeling = computed(() => (partnerUid.value ? feelings.value[partnerUid.value] ?? null : null));

  function unbind() {
    run += 1;
    for (const stop of stops) stop();
    stops = [];
    feelings.value = {};
    loading.value = true;
    error.value = null;
    writeError.value = "";
    householdId.value = "";
  }

  function fail(cause) {
    loading.value = false;
    error.value = { code: cause?.code ?? "unknown" };
  }

  function bind(id, uid = "", partner = "") {
    unbind();
    const current = run;
    meUid.value = uid;
    partnerUid.value = partner;
    shareOn.value = readJson(keyFor(SHARE_KEY, uid), false) === true;
    dismissed.value = readJson(keyFor(NUDGES_KEY, uid), {});
    if (!id) return;
    householdId.value = id;
    try {
      stops.push(
        subscribeFeelings(
          id,
          (map) => {
            if (current !== run) return;
            feelings.value = map;
            loading.value = false;
            error.value = null;
          },
          (cause) => current === run && fail(cause),
        ),
      );
    } catch (cause) {
      console.error("[app team]", cause?.code, cause);
      fail(cause);
    }
  }

  function setPartnerUid(uid) {
    partnerUid.value = uid || "";
  }

  // Share or stop sharing "how I feel". Turning it off removes what was shared.
  async function setSharing(on) {
    shareOn.value = Boolean(on);
    writeJson(keyFor(SHARE_KEY, meUid.value), shareOn.value);
    if (shareOn.value || !householdId.value || !meUid.value) return true;
    try {
      await clearFeeling(householdId.value, meUid.value);
      return true;
    } catch (cause) {
      console.error("[app team]", cause?.code, cause);
      writeError.value = writeMessage(cause, "We could not stop sharing just now. Try again.");
      return false;
    }
  }

  // Called after a private check-in is saved. Writes the one word only when sharing is on.
  async function shareFeeling(level, date) {
    if (!shareOn.value || !householdId.value || !meUid.value) return false;
    writeError.value = "";
    try {
      await setFeeling(householdId.value, meUid.value, { level, date });
      // A hard day also goes to the partner's phone. The server sends it once a day.
      if (level === "hard") notifyPartner(householdId.value, "feeling", meUid.value);
      return true;
    } catch (cause) {
      console.error("[app team]", cause?.code, cause);
      writeError.value = writeMessage(cause, "We could not share that just now. Your check-in is still saved.");
      return false;
    }
  }

  function dismiss(id, dayKey) {
    dismissed.value = { ...dismissed.value, [id]: dayKey };
    writeJson(keyFor(NUDGES_KEY, meUid.value), dismissed.value);
  }

  return {
    feelings,
    loading,
    error,
    writeError,
    householdId,
    meUid,
    partnerUid,
    shareOn,
    dismissed,
    partnerFeeling,
    bind,
    unbind,
    setPartnerUid,
    setSharing,
    shareFeeling,
    dismiss,
  };
});
