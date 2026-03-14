// ── LAB SCOPE SERVICE WORKER v2.0 ──
const CACHE_VERSION = "lab-scope-v2.1";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_VERSION).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          return new Response(
            `<html><body style="background:#000;color:#00ff41;font-family:monospace;padding:20px">
              <h2>LAB SCOPE</h2>
              <p>Offline — reload once connected to cache the app.</p>
            </body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        });
      })
  );
});
