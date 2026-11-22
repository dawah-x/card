/* DAWAH X AI — Progressive Web App Service Worker (v13.0 — Cache-first fonts + Network-first shell) */
'use strict';

const CACHE_NAME = 'dawahx-ai-v13';
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/api/')) return;

  // Cache-first for immutable self-hosted WOFF2 fonts & icons
  if (/\.(?:woff2|webp|png|svg)$/i.test(url.pathname) && url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(
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

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && (url.origin === self.location.origin || url.hostname.includes('github.io'))) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('index.html')))
  );
});
