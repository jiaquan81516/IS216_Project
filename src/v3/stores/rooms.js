import { defineStore } from "pinia";
import { ref, watch } from "vue";

export const ROOMS_KEY = "nt.v3.rooms";

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(ROOMS_KEY) || "null");
    if (!Array.isArray(data)) return [];
    return data
      .filter((r) => r && typeof r.name === "string" && typeof r.address === "string")
      .map((r) => ({
        id: String(r.id),
        name: r.name,
        address: r.address,
        features: Array.isArray(r.features) ? r.features.map(String) : [],
        status: "needs verification",
        verifiedDaysAgo: null,
      }));
  } catch {
    return [];
  }
}

// Rooms added on this device. Local only until the database is connected.
export const useRoomsStore = defineStore("v3-rooms", () => {
  const rooms = ref(load());

  watch(
    rooms,
    (value) => {
      try {
        localStorage.setItem(ROOMS_KEY, JSON.stringify(value));
      } catch {
        // Storage can be blocked; added rooms then live in memory only.
      }
    },
    { deep: true, flush: "sync" },
  );

  function addRoom({ name, address, features = [] }) {
    const room = {
      id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      address: address.trim(),
      features: [...features],
      status: "needs verification",
      verifiedDaysAgo: null,
    };
    rooms.value = [...rooms.value, room];
    return room;
  }

  return { rooms, addRoom };
});
