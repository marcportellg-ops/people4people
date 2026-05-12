// People4People Service Worker — push notifications + offline shell
const CACHE = "p4p-v1";

// ── Install: cache the app shell ──────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Push: show notification ───────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "People4People", body: event.data.text(), url: "/" };
  }

  const { title = "People4People", body = "", url = "/", icon = "/icons/icon-192.png" } = payload;

  const options = {
    body,
    icon,
    badge: "/icons/icon-192.png",
    data: { url },
    requireInteraction: false,
    vibrate: [100, 50, 100],
    tag: url, // collapse duplicate notifications for the same URL
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click: open or focus the app ─────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, navigate it and focus
        for (const client of clientList) {
          if ("navigate" in client && "focus" in client) {
            return client.navigate(targetUrl).then(() => client.focus());
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
