const CACHE_VERSION = "lab-scope-v1.0.5";

const ASSETS = [
    "./", "./index.html", "./manifest.json",
    "./css/base.css", "./css/header.css", "./css/tabs.css",
    "./css/measurements.css", "./css/canvas.css",
    "./css/controls.css", "./css/menu.css", "./css/splash.css",
    "./js/state.js", "./js/grid.js", "./js/signal-detect.js",
    "./js/measurements.js", "./js/trigger.js", "./js/oscilloscope.js",
    "./js/fft.js", "./js/calibration.js", "./js/audio.js",
    "./js/ui.js", "./js/app.js"
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
                    .map(key => caches.delete(key))
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
                const clone = networkResponse.clone();
                caches.open(CACHE_VERSION).then(cache => {
                    cache.put(event.request, clone);
                });
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then(cached => {
                    if (cached) return cached;
                    return new Response(
                        `<html><body style="background:#000;color:#00ff41;font-family:monospace;padding:20px;text-align:center">
                            <h2>LAB SCOPE v1.0.5</h2>
                            <p>Offline — reload once connected to cache the app.</p>
                            <button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;background:#00ff41;color:#000;border:none;font-family:monospace;cursor:pointer">RETRY</button>
                        </body></html>`,
                        { headers: { "Content-Type": "text/html" } }
                    );
                });
            })
    );
});
