self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : null;
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data?.title ?? 'push', { body: data?.body }),
      fetch('/received', { method: 'POST', body: JSON.stringify(data) }),
    ]),
  );
});
