// Minimal service worker: uygulama kabuğunu önbelleğe alır (PWA kurulabilirliği için).
const CACHE = "duello-v1";
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/icon.svg"]))));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.startsWith("/socket.io")) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then((r) => r ?? caches.match("/"))));
});
