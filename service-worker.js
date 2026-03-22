const CACHE_VERSION = "lab-scope-v1.1.7";

const ASSETS = [
    "./", "./index.html", "./manifest.json",
    "./css/base.css", "./css/header.css", "./css/tabs.css",
    "./css/measurements.css", "./css/canvas.css",
    "./css/controls.css", "./css/menu.css", "./css/splash.css",
    "./css/simulator.css", "./css/simset.css",
    "./js/state.js", "./js/grid.js", "./js/signal-detect.js",
    "./js/measurements.js", "./js/trigger.js", "./js/oscilloscope.js",
    "./js/fft.js", "./js/calibration.js", "./js/audio.js",
    "./js/simulator.js", "./js/artifacts.js", "./js/audio-loader.js",
    "./js/persist.js",
    "./js/ui.js", "./js/app.js",
    "./js/worker.js",
    "./js/dsp/simulator.js",
    "./js/dsp/artifacts.js",
    "./js/dsp/measurements.js",
    "./js/dsp/classifier.js",
    "./js/dsp/analyser.js",
    "./js/dsp/bode.js",
    "./js/dsp/correction.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;
    event.respondWith(
        fetch(event.request)
            .then(res => {
                const clone = res.clone();
                caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
                return res;
            })
            .catch(() =>
                caches.match(event.request).then(cached => cached ||
                    new Response(
                        `<html><body style="background:#000;color:#00e5ff;font-family:monospace;padding:20px;text-align:center">
                            <h2>LAB SCOPE PRO</h2>
                            <p>Offline — reload once connected to cache the app.</p>
                            <button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;background:#00e5ff;color:#000;border:none;font-family:monospace;cursor:pointer;font-weight:bold">RETRY</button>
                        </body></html>`,
                        { headers: { "Content-Type": "text/html" } }
                    )
                )
            )
    );
});
