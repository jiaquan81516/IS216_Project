import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { ackPost, addPost, deletePost, POST_TEXT_MAX, subscribePosts } from "@/app/api/posts";
import { describeSharedError } from "@/app/api/sharedHelpers";

// One post a second at most. A courtesy guard against a double tap, like api/limits.js.
export const SEND_GAP_MS = 1000;

function writeMessage(cause, fallback) {
  if (cause?.code === "permission-denied") {
    return "Your database rules do not allow messages yet. Publish the latest firestore.rules in the Firebase console, then try again.";
  }
  return fallback;
}

// The household's plain messages, live. Firestore is the only store.
export const usePostsStore = defineStore("app-posts", () => {
  const posts = ref([]);
  const loading = ref(true);
  const error = ref(null); // { code } or null
  const writeError = ref("");
  const householdId = ref("");
  const meUid = ref("");

  let stop = null;
  let run = 0;
  let lastSentAt = 0;

  const errorInfo = computed(() => (error.value ? describeSharedError(error.value.code, "messages") : null));

  function unbind() {
    run += 1;
    if (stop) stop();
    stop = null;
    posts.value = [];
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
    if (!id) return;
    householdId.value = id;
    try {
      stop = subscribePosts(
        id,
        (list) => {
          if (current !== run) return;
          posts.value = list;
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
      console.error("[app posts]", cause?.code, cause);
      loading.value = false;
      error.value = { code: cause?.code ?? "unknown" };
    }
  }

  // Posts have no partner dependent state. Present so the shared binder can treat every
  // store the same way.
  function setPartnerUid() {}

  // Returns true when the message was written.
  async function send(text) {
    const clean = String(text ?? "").trim();
    if (!clean || !householdId.value || !meUid.value) return false;
    if (clean.length > POST_TEXT_MAX) {
      writeError.value = `Messages can be up to ${POST_TEXT_MAX} characters.`;
      return false;
    }
    const now = Date.now();
    if (now - lastSentAt < SEND_GAP_MS) {
      writeError.value = "Give it a second before sending another.";
      return false;
    }
    lastSentAt = now;
    writeError.value = "";
    try {
      await addPost(householdId.value, meUid.value, clean);
      return true;
    } catch (cause) {
      console.error("[app posts]", cause?.code, cause);
      writeError.value = writeMessage(cause, "We could not send that. Check your connection and try again.");
      return false;
    }
  }

  async function ack(id) {
    if (!householdId.value || !meUid.value || !id) return false;
    writeError.value = "";
    try {
      await ackPost(householdId.value, id, meUid.value);
      return true;
    } catch (cause) {
      console.error("[app posts]", cause?.code, cause);
      writeError.value = writeMessage(cause, "We could not save that. Check your connection and try again.");
      return false;
    }
  }

  async function remove(id) {
    if (!householdId.value || !id) return false;
    writeError.value = "";
    try {
      await deletePost(householdId.value, id);
      return true;
    } catch (cause) {
      console.error("[app posts]", cause?.code, cause);
      writeError.value = writeMessage(cause, "We could not delete that. Check your connection and try again.");
      return false;
    }
  }

  return { posts, loading, error, errorInfo, writeError, householdId, meUid, bind, unbind, setPartnerUid, send, ack, remove };
});
