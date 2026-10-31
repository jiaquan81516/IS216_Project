import { ref } from "vue";

// Small confirmation pop ups ("Room saved"). One shared list, shown by AppToast in the app
// shell, so any page can call showToast without wiring anything up.
const toasts = ref([]);
let next = 1;

export function useToast() {
  function showToast({ title, text = "", kind = "success", ms = 5000 }) {
    const id = `toast-${next++}`;
    toasts.value = [...toasts.value, { id, title, text, kind, ms }].slice(-3);
    return id;
  }
  function closeToast(id) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }
  return { toasts, showToast, closeToast };
}
