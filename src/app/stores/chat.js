import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { CHAT_TEXT_MAX, sendChat, subscribeChat } from "@/api/chat";
import { notifyPartner } from "@/api/push";
import { toDate } from "@/app/utils/entryHelpers";

export const READ_KEY = "nt.app.chat-read";
// A courtesy guard against a double tap.
export const SEND_GAP_MS = 600;

const readKey = (uid) => `${READ_KEY}:${uid}`;

function readStored(uid) {
  try {
    const value = Number(localStorage.getItem(readKey(uid)));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeMessage(cause, fallback) {
  if (cause?.code === "permission-denied") {
    return "Your database rules do not allow chat yet. Publish the latest firestore.rules in the Firebase console, then try again.";
  }
  return fallback;
}

// The chat between the two parents, live. Oldest message first. What each person has read is
// kept on their own device, per account.
export const useChatStore = defineStore("app-chat", () => {
  const messages = ref([]);
  const loading = ref(true);
  const error = ref(null); // { code } or null
  const writeError = ref("");
  const householdId = ref("");
  const meUid = ref("");
  const readAt = ref(0);

  let stop = null;
  let run = 0;
  let lastSentAt = 0;

  const timeOf = (message) => (toDate(message.createdAt) ?? new Date()).getTime();
  const unread = computed(
    () => messages.value.filter((m) => m.from !== meUid.value && timeOf(m) > readAt.value).length,
  );

  function unbind() {
    run += 1;
    if (stop) stop();
    stop = null;
    messages.value = [];
    loading.value = true;
    error.value = null;
    writeError.value = "";
    householdId.value = "";
    lastSentAt = 0;
  }

  function bind(id, uid = "") {
    unbind();
    const current = run;
    meUid.value = uid;
    // The first time on this device, what is already in the chat counts as read.
    const stored = readStored(uid);
    readAt.value = stored || Date.now();
    if (!stored) markRead(readAt.value);
    if (!id) return;
    householdId.value = id;
    try {
      stop = subscribeChat(
        id,
        (list) => {
          if (current !== run) return;
          messages.value = [...list].reverse();
          loading.value = false;
          error.value = null;
        },
        (cause) => {
          if (current !== run) return;
          loading.value = false;
          error.value = { code: cause?.code ?? "unknown" };
        },
      );
    } catch (cause) {
      console.error("[app chat]", cause?.code, cause);
      loading.value = false;
      error.value = { code: cause?.code ?? "unknown" };
    }
  }

  // Chat has nothing that depends on the partner's uid. Present so the shared binder can
  // treat every store the same way.
  function setPartnerUid() {}

  function markRead(at = 0) {
    const newest = messages.value.reduce((max, m) => Math.max(max, timeOf(m)), 0);
    readAt.value = Math.max(readAt.value, at, newest);
    try {
      localStorage.setItem(readKey(meUid.value), String(readAt.value));
    } catch {
      // Storage can be blocked. The dot then comes back next visit.
    }
  }

  // Returns true when the message was written.
  async function send(text, kind = "text") {
    const clean = String(text ?? "").trim();
    if (!clean || !householdId.value || !meUid.value) return false;
    if (clean.length > CHAT_TEXT_MAX) {
      writeError.value = `Messages can be up to ${CHAT_TEXT_MAX} characters.`;
      return false;
    }
    const now = Date.now();
    if (now - lastSentAt < SEND_GAP_MS) return false;
    lastSentAt = now;
    writeError.value = "";
    try {
      const id = await sendChat(householdId.value, { from: meUid.value, text: clean, kind });
      // A system notification for the partner's device. Fire and forget.
      notifyPartner(householdId.value, "chat", id);
      return true;
    } catch (cause) {
      console.error("[app chat]", cause?.code, cause);
      writeError.value = writeMessage(cause, "We could not send that. Check your connection and try again.");
      return false;
    }
  }

  return { messages, loading, error, writeError, householdId, meUid, unread, bind, unbind, setPartnerUid, markRead, send };
});
