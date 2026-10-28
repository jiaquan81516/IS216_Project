// Web push for the signed in parent's own devices, through Firebase Cloud Messaging.
//
//   users/{uid}/devices/{deviceId}  { fcmToken, platform, addedAt, lastUsedAt }
//
// One document per browser, so a dead token is removed on its own. Only this device ever
// writes its document; the Vercel function reads the partner's devices with the Admin SDK
// (api/push/notify.js) and sends. The browser cannot send to another user, by design.
//
// The service worker is public/firebase-messaging-sw.js. firebase/messaging is imported on
// demand, so the chat and the task list never load it unless push is being turned on.
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import app from "./firebase";
import { db } from "./db";
import { callServer, isServerUnreachable } from "./server";

const TAG = "[app push]";
export const SW_URL = "/firebase-messaging-sw.js";
export const DEVICE_KEY = "nt.app.device-id";

// Codes the Settings page turns into a sentence.
export const PUSH_CODES = Object.freeze({
  unsupported: "push/unsupported",
  notConfigured: "push/not-configured",
  denied: "push/denied",
  noToken: "push/no-token",
});

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// The public web push key from the Firebase console. A placeholder counts as missing.
export function vapidKey() {
  const value = String(import.meta.env.VITE_FIREBASE_VAPID_KEY ?? "").trim();
  return value && !/^your-/i.test(value) ? value : "";
}

export function browserCanPush() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

// "default" (not asked yet), "granted" or "denied". "unsupported" when the browser cannot.
export function permissionState() {
  return browserCanPush() ? Notification.permission : "unsupported";
}

function deviceId() {
  try {
    let value = localStorage.getItem(DEVICE_KEY);
    if (!value) {
      value = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, value);
    }
    return value;
  } catch {
    return "this-browser";
  }
}

function platformName() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios-web";
  if (/Android/i.test(ua)) return "android-web";
  return "desktop-web";
}

const deviceRef = (uid) => doc(db, "users", uid, "devices", deviceId());

async function readyMessaging() {
  const { getMessaging, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw fail(PUSH_CODES.unsupported, "This browser cannot receive push notifications.");
  return { messaging: getMessaging(app) };
}

async function currentToken(messaging) {
  const key = vapidKey();
  if (!key) throw fail(PUSH_CODES.notConfigured, "Web push is not set up yet.");
  const { getToken } = await import("firebase/messaging");
  const registration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  await navigator.serviceWorker.ready;
  const token = await getToken(messaging, { vapidKey: key, serviceWorkerRegistration: registration });
  if (!token) throw fail(PUSH_CODES.noToken, "We could not get a push token for this device.");
  return token;
}

async function saveDevice(uid, token, { isNew }) {
  await setDoc(
    deviceRef(uid),
    {
      fcmToken: token,
      platform: platformName(),
      lastUsedAt: serverTimestamp(),
      ...(isNew ? { addedAt: serverTimestamp() } : {}),
    },
    { merge: true },
  );
}

// Asks for permission (call it from a tap), gets this device's token and saves it.
export async function enablePush(uid) {
  if (!uid) throw fail("push/no-user", "Sign in first.");
  if (!browserCanPush()) throw fail(PUSH_CODES.unsupported, "This browser cannot receive push notifications.");
  if (!vapidKey()) throw fail(PUSH_CODES.notConfigured, "Web push is not set up yet.");
  const answer = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (answer !== "granted") throw fail(PUSH_CODES.denied, "Notifications are blocked for this site.");
  const { messaging } = await readyMessaging();
  const token = await currentToken(messaging);
  await saveDevice(uid, token, { isNew: true });
  return token;
}

// Quiet refresh on app load: tokens can change, so keep the saved one current. Never asks.
export async function refreshPush(uid) {
  if (!uid || !browserCanPush() || !vapidKey() || Notification.permission !== "granted") return false;
  try {
    const { messaging } = await readyMessaging();
    const token = await currentToken(messaging);
    await saveDevice(uid, token, { isNew: false });
    return true;
  } catch (cause) {
    console.error(TAG, cause?.code, cause);
    return false;
  }
}

// Forgets this device: removes its document and the browser's push subscription.
export async function disablePush(uid) {
  try {
    if (uid) await deleteDoc(deviceRef(uid));
  } catch (cause) {
    console.error(TAG, cause?.code, cause);
  }
  try {
    if (!browserCanPush() || !vapidKey()) return;
    const { messaging } = await readyMessaging();
    const { deleteToken } = await import("firebase/messaging");
    await deleteToken(messaging);
  } catch (cause) {
    console.error(TAG, cause?.code, cause);
  }
}

// Tells the server a message or task is ready to announce. It re-reads the document itself,
// so this carries only ids, never text. Fire and forget: a missing server is not an error the
// sender needs to see, the partner simply gets no system notification.
export async function notifyPartner(householdId, type, id) {
  if (!householdId || !id) return false;
  try {
    await callServer("push/notify", { body: { householdId, type, id } });
    return true;
  } catch (cause) {
    if (!isServerUnreachable(cause)) console.error(TAG, cause?.code, cause);
    return false;
  }
}

// Administrator side: tells the server a room was just rejected so it can notify whoever
// suggested it. Carries only the room id. Fire and forget, like notifyPartner.
export async function notifyRoomRejected(roomId) {
  if (!roomId) return false;
  try {
    await callServer("rooms/notify", { body: { roomId } });
    return true;
  } catch (cause) {
    if (!isServerUnreachable(cause)) console.error(TAG, cause?.code, cause);
    return false;
  }
}

// Messages the service worker hands to a visible tab: { source: "nt-push", title, body, url,
// type } when a push arrives, { source: "nt-push-open", url, type } after a tap on a system
// notification. Returns a function that stops listening.
export function listenPush(handler) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => {};
  const onMessage = (event) => {
    const source = event.data?.source;
    if (source === "nt-push" || source === "nt-push-open") handler(event.data);
  };
  navigator.serviceWorker.addEventListener("message", onMessage);
  return () => navigator.serviceWorker.removeEventListener("message", onMessage);
}

// One sentence for a failed enable, for the Settings page.
export function describePushError(error) {
  switch (error?.code) {
    case PUSH_CODES.unsupported:
      return "This browser cannot receive push notifications. On iPhone, add NurtureTrack to the Home Screen first.";
    case PUSH_CODES.notConfigured:
      return "Web push is not set up yet. Add VITE_FIREBASE_VAPID_KEY to .env and restart the dev server.";
    case PUSH_CODES.denied:
      return "Notifications are blocked for this site. Allow them in the browser's site settings, then try again.";
    case "permission-denied":
      return "Your database rules do not allow saving this device. Publish the latest firestore.rules, then try again.";
    default:
      return "We could not turn notifications on. Check your connection and try again.";
  }
}
