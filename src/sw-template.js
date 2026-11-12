/* Service worker RIFT RUNNER. Генерируется при сборке (vite.config.ts → плагин pwa):
 * __VERSION__ — уникальная версия сборки, __FILES__ — список всех файлов для офлайна.
 * Стратегия: всё заранее кладётся в кеш версии; ассеты с хешем — cache-first,
 * навигация — network-first с откатом на кеш (обновления приходят при следующем запуске). */
const VERSION = '__VERSION__';
const CACHE = `rr-${VERSION}`;
const FILES = __FILES__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rr-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
});
