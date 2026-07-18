/* HYDRO74 Lookbook service worker
   - App shell: cache-first
   - Artwork images: stale-while-revalidate (viewed plates work offline)
   - Sheet data: network-first with cache fallback                       */
const SHELL_CACHE = "h74-shell-v3";
const IMG_CACHE   = "h74-img-v1";
const DATA_CACHE  = "h74-data-v1";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable-192.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./favicon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![SHELL_CACHE, IMG_CACHE, DATA_CACHE].includes(k)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes("docs.google.com")) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(DATA_CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  if (e.request.destination === "image") {
    e.respondWith(
      caches.open(IMG_CACHE).then(async c => {
        const hit = await c.match(e.request);
        const net = fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }
  // App shell: network-first so new deploys are picked up immediately,
  // cached copy only as offline fallback
  if (e.request.mode === "navigate" || e.request.destination === "document" ||
      e.request.url.endsWith("index.html") || e.request.url.endsWith("sw.js") ||
      e.request.url.endsWith("manifest.json")) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
