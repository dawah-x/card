/* DAWAH X AI — Progressive Web App Service Worker (v23.0 — Offline Shell + LRU Data Cache for DAWAH X Quran, Hadith, Books & Fatwas) */
'use strict';

const CACHE_NAME = 'dawahx-ai-v23';
const DATA_CACHE_NAME = 'dawahx-data-v23';
const MAX_DATA_ENTRIES = 90;

const SHELL_ASSETS = [
  './',
  'index.html',
  'styles.css',
  'browser-ai.js',
  'app.js',
  'favicon.svg',
  'logo.webp',
  'logo-icon.webp',
  'icon-192.png',
  'manifest.webmanifest',
  'fonts/hind-siliguri-bengali-400-normal.woff2',
  'fonts/hind-siliguri-bengali-600-normal.woff2',
  'fonts/hind-siliguri-bengali-700-normal.woff2',
  'fonts/noto-naskh-arabic-arabic-400-normal.woff2',
];

async function trimDataCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const excess = keys.length - maxItems;
      for (let i = 0; i < excess; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (_) {}
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const validCaches = new Set([CACHE_NAME, DATA_CACHE_NAME]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !validCaches.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.destination === 'audio' || req.headers.has('range') || /\.mp3$/i.test(url.pathname)) return;

  // 1. Cross-origin DAWAH X static data (Quran, Hadith shards, Books catalog, Fatwa text buckets) — Cache for offline reading
  if (
    url.hostname === 'ebrahim-ead.github.io' &&
    url.pathname.startsWith('/DAWAH-X/') &&
    /\.(?:json|js|gz)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const networkFetch = fetch(req)
            .then((res) => {
              if (res && res.ok) {
                cache.put(req, res.clone()).then(() => trimDataCache(DATA_CACHE_NAME, MAX_DATA_ENTRIES)).catch(() => {});
              }
              return res;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Only handle same-origin non-API requests beyond this point
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;

  // 2. Cache-first for immutable self-hosted WOFF2 fonts & icons
  if (/\.(?:woff2|webp|png|svg)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
            }
            return res;
          })
      )
    );
    return;
  }

  // 3. Network-first with offline ignoreSearch shell fallback for HTML/CSS/JS
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req, { ignoreSearch: true })
          .then((cached) => cached || caches.match('index.html', { ignoreSearch: true }))
      )
  );
});
