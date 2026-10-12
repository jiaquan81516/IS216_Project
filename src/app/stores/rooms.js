import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useAuth } from "@/composables/useAuth";
import { addRoom as addRoomDoc, reportRoom as reportRoomDoc, subscribeRooms } from "@/api/rooms";
import { roomView } from "@/app/utils/roomHelpers";
import { SEED_ROOMS } from "@/app/data/pumpingRooms";
import { takeLimit } from "@/app/utils/limits";

// The pumping room directory lives in Firestore (pumpingRooms), shared by every household.
// Until somebody adds the first real room the list falls back to the seed rooms in
// src/app/data/pumpingRooms.js, which are clearly marked as seed data and cannot be reported.
export const useRoomsStore = defineStore("app-rooms", () => {
  const docs = ref([]);
  const loading = ref(true);
  const error = ref(null);
  const writeError = ref("");
  let stop = null;

  const fromFirestore = computed(() => docs.value.map((d) => roomView(d.id, d)));
  const usingSeed = computed(() => fromFirestore.value.length === 0);
  const rooms = computed(() => (usingSeed.value ? SEED_ROOMS : fromFirestore.value));

  function bind() {
    if (stop) return;
    loading.value = true;
    error.value = null;
    stop = subscribeRooms(
      (list) => {
        docs.value = list;
        loading.value = false;
        error.value = null;
      },
      (cause) => {
        loading.value = false;
        error.value = cause;
      },
    );
  }

  function unbind() {
    stop?.();
    stop = null;
    docs.value = [];
    loading.value = true;
  }

  function uid() {
    const { currentUser } = useAuth();
    return currentUser.value?.uid ?? "";
  }

  async function addRoom({ name, address, details = "", placeId = "", lat = null, lng = null, features = [] }) {
    writeError.value = "";
    try {
      const id = await addRoomDoc(uid(), { name, address, details, placeId, lat, lng, features });
      return { id, name: String(name).trim() };
    } catch (cause) {
      writeError.value =
        cause?.code === "permission-denied"
          ? "Your database rules do not allow adding a room yet. Publish the latest firestore.rules, then try again."
          : "We could not save that room. Check your connection and try again.";
      return null;
    }
  }

  // kind is "confirm" or "gone". Rate limited on this device, see src/app/utils/limits.js.
  async function reportRoom(roomId, kind) {
    writeError.value = "";
    const gate = takeLimit("roomReport");
    if (!gate.allowed) {
      writeError.value = gate.message;
      return false;
    }
    try {
      await reportRoomDoc(uid(), roomId, kind);
      return true;
    } catch (cause) {
      writeError.value =
        cause?.code === "permission-denied"
          ? "Your database rules do not allow reporting a room yet. Publish the latest firestore.rules, then try again."
          : "We could not save that report. Check your connection and try again.";
      return false;
    }
  }

  return { rooms, docs, usingSeed, loading, error, writeError, bind, unbind, addRoom, reportRoom };
});
