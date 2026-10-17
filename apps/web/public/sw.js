/* EveryDaily service worker: an offline shell, nothing more.
 *  - Pages are always fetched from the network; we never cache them (they hold private data).
 *    When the network is down, navigations get the offline page instead.
 *  - Hashed build assets and icons are cached on first use (they never change at a URL).
 *  - API, realtime and cross-origin requests are not touched.
 */
const VERSION = 'v1';
const SHELL = `ed-shell-${VERSION}`;
const ASSETS = `ed-assets-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      const res = await fetch(OFFLINE_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('offline page unavailable');
      await cache.put(OFFLINE_URL, res.clone());
      // The offline page's own CSS, scripts and fonts, so it renders without the network.
      const html = await res.text();
      const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? [])];
      const assetCache = await caches.open(ASSETS);
      await Promise.all(
        [...assets, '/icons/icon.svg', '/icons/icon-192.png'].map((url) =>
          assetCache.add(url).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/realtime')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) (await caches.open(ASSETS)).put(req, res.clone());
        return res;
      })(),
    );
  }
});
