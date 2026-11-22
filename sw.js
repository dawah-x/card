/* DAWAH X AI — Progressive Web App Service Worker (Network-first with instant offline cache fallback) */
'use strict';

const CACHE_NAME = 'dawahx-ai-v6';
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
