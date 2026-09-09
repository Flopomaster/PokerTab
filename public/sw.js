/*
 * Service Worker של PokerTab — משמש אך ורק להתראות פוש.
 * אין כאן טיפול ב-fetch בכוונה: מטמון של קבצים היה מתנגש במנגנון
 * זיהוי הגרסה החדשה, ומקשה על עדכונים.
 */

const base = () => new URL(self.registration.scope).pathname;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'PokerTab';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: `${base()}icons/icon-192.png`,
      badge: `${base()}icons/icon-192.png`,
      dir: 'rtl',
      lang: 'he',
      tag: data.tag || 'pokertab',
      renotify: true,
      data: { url: data.url || base() },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || base();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(base()) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
