import { onBeforeUnmount, ref } from "vue";
import {
  browserCanPush,
  describePushError,
  disablePush,
  enablePush,
  listenPush,
  permissionState,
  refreshPush,
  vapidKey,
} from "@/api/push";

// Push for this device: is it possible, is it on, and the two actions. `uid` is a function so
// it always reads the signed in parent. The page decides what to save in the settings.
export function usePush(uid) {
  const permission = ref(permissionState());
  const busy = ref(false);
  const error = ref("");
  const configured = Boolean(vapidKey());
  const supported = browserCanPush();

  async function enable() {
    busy.value = true;
    error.value = "";
    try {
      await enablePush(uid());
      return true;
    } catch (cause) {
      console.error("[app push]", cause?.code, cause);
      error.value = describePushError(cause);
      return false;
    } finally {
      permission.value = permissionState();
      busy.value = false;
    }
  }

  async function disable() {
    busy.value = true;
    error.value = "";
    try {
      await disablePush(uid());
    } finally {
      permission.value = permissionState();
      busy.value = false;
    }
  }

  return { supported, configured, permission, busy, error, enable, disable, refresh: () => refreshPush(uid()) };
}

// Runs `handler` for every message the service worker hands to this tab. Call it from setup.
export function usePushMessages(handler) {
  const stop = listenPush(handler);
  onBeforeUnmount(stop);
}
