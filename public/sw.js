// public/sw.js

// Activate immediately without waiting for existing tabs to close
self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", function (event) {
  if (event.data) {
    let data;
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "New Update", body: event.data.text() };
    }

    const title = data.title || "SurplusLink Notification";
    const options = {
      body: data.body,
      icon: data.icon || "/favicon.ico",
      badge: data.badge || "/favicon.ico",
      data: data.data || { url: "/" },
      vibrate: [100, 50, 100],
      requireInteraction: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});
