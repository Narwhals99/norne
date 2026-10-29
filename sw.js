/* Norne's service worker. It only shows notifications and brings Norne to the front when one is tapped;
   it caches nothing, so the site always loads fresh. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const ch = e.notification.data && e.notification.data.ch;
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    const c = list[0];
    if (c) { c.postMessage({open:ch}); return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
