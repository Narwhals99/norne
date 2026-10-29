/* Norne's service worker. It shows notifications and brings Norne to the front when one is tapped.
   It caches nothing, and it asks GitHub Pages whether the site's own files changed on every load,
   so an update shows after one reload instead of up to 10 minutes later (Pages lets browsers keep a copy that long). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !(r.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(u.pathname))) return;
  e.respondWith(fetch(r.url, {cache:'no-cache', credentials:'same-origin'}).catch(() => fetch(r)));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const ch = e.notification.data && e.notification.data.ch;
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    const c = list[0];
    if (c) { c.postMessage({open:ch}); return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
