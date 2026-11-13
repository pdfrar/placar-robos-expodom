// Service worker: guarda tudo no primeiro acesso e funciona sem internet.
const CACHE = 'placar-robos-v2';
const FILES = [
  './',
  './index.html',
  './controle.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/placar.css',
  './css/painel.css',
  './js/store.js',
  './js/painel.js',
  './js/placar.js',
  './assets/escola.jpg',
  './assets/expodom.jpg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/fonts/russo-one.woff2',
  './assets/fonts/chakra-500.woff2',
  './assets/fonts/chakra-700.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Responde do cache na hora (não trava sem internet) e atualiza o cache em segundo plano.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) {
      e.waitUntil(network);
      return cached;
    }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
