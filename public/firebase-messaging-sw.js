// Receives web push from Firebase Cloud Messaging while the browser is running, even when no
// NurtureTrack tab is in front. The server sends data only messages (api/push/notify.js), so
// this file decides what to show. It has no Firebase code in it on purpose: a push is just
// the standard Web Push event, and nothing here needs to match the SDK version.
//
// If a NurtureTrack tab is visible, the page already shows its own pop up, so this hands the
// message to that tab instead of showing a system notification as well. Only Chrome and Edge
// allow that. Safari (iPhone, iPad, Mac) and Firefox expect every push to show a notification,
// and Safari removes the subscription after a few pushes that show nothing, so on those
// browsers a notification is always shown.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function readMessage(event) {
  const fallback = { title: "NurtureTrack", body: "", url: "/home", tag: "", type: "" };
  try {
    const json = event.data ? event.data.json() : {};
    const data = json.data || {};
    const note = json.notification || {};
    return {
      title: data.title || note.title || fallback.title,
      body: data.body || note.body || fallback.body,
      url: data.url || fallback.url,
      tag: data.tag || "",
      type: data.type || "",
    };
  } catch {
    return fallback;
  }
}

self.addEventListener("push", (event) => {
  const message = readMessage(event);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = windows.filter((client) => client.visibilityState === "visible");
      const ua = self.navigator?.userAgent || "";
      const mayStaySilent = /(Chrome|Edg)\//.test(ua) && !/CriOS/.test(ua);
      if (visible.length && mayStaySilent) {
        visible.forEach((client) => client.postMessage({ source: "nt-push", ...message }));
        return;
      }
      await self.registration.showNotification(message.title, {
        body: message.body,
        icon: "/favicon.ico",
        tag: message.tag || undefined,
        renotify: Boolean(message.tag),
        data: { url: message.url, type: message.type },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/home";
  const type = event.notification.data?.type || "";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const mine = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (mine) {
        await mine.focus();
        mine.postMessage({ source: "nt-push-open", url, type });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
