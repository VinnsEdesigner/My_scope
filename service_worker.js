const CACHE_NAME = 'scope-v1';
const ASSETS = [
  './',
  './index.html'
];

// Install: Save files to phone storage
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Fetch: Use cached files if offline
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
