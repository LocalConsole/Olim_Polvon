// Olim Polvon service worker: only notifications (no offline cache, so the site never shows stale pages).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  const scope = self.registration.scope;
  e.waitUntil(self.registration.showNotification(d.title || 'Olim Polvon', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: scope + 'assets/icon-512.png', badge: scope + 'assets/favicon-64.png',
    data: { url: new URL(d.url || './', scope).href },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => c.url.startsWith(self.registration.scope));
    if (w) return w.navigate(url).then(c => (c || w).focus()).catch(() => w.focus());
    return self.clients.openWindow(url);
  }));
});
