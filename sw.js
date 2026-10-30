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
    return self.clients.openWindow(ch ? './?open=' + encodeURIComponent(ch) : './');
  }));
});
/* a push from the Worker (push/worker.js): someone wrote in a chat this device can read.
   Skipped while Norne is in front, except on Apple devices, which turn push off for a site that skips one. */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch(x) { d = {body:e.data ? e.data.text() : ''}; }
  const apple = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Android/.test(navigator.userAgent);
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    if (!apple && list.some(c => c.focused && c.visibilityState === 'visible')) return;
    return self.registration.showNotification(d.title || 'Norne', {body:d.body || '', icon:'img/icon-192.png', badge:'img/icon-192.png', data:{ch:d.ch}});
  }));
});
