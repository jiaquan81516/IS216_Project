import { ref } from "vue";

export function useNotifications() {
  const notifications = ref([]);
  function notify(message) {
    notifications.value.push({ id: crypto.randomUUID(), message });
  }
  function dismiss(id) {
    notifications.value = notifications.value.filter((item) => item.id !== id);
  }
  return { notifications, notify, dismiss };
}
