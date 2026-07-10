const CACHE_NAME = "lockbox-static-v2";

const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API, HTML pages, or sensitive routes
  if (
    url.pathname.startsWith("/api/") ||
    event.request.method !== "GET" ||
    event.request.mode === "navigate"
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache only static icons/manifest
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith("manifest.webmanifest") ||
    url.pathname.endsWith("favicon.svg")
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached || fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
