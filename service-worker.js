const CACHE_NAME = "lab-scope-v1.2-pro"; // Incremented version
const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.json"
];

// Install: Forces the new service worker to take over immediately
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Caching assets...");
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting(); 
});

// Activate: Cleans up old caches (The "Ex-Exterminator")
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Immediate control
});

// Fetch: "Network Falling Back to Cache" - Best for PWAs
self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
