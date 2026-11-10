const CACHE_NAME = "afterschool-shell-v2";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/afterschool.svg?v=2",
  "/icons/apple-touch-icon.png?v=2",
  "/icons/icon-192.png?v=2",
  "/icons/icon-512.png?v=2",
  "/icons/icon-maskable-512.png?v=2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    fetch("/")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load the AfterSchool app shell");
        const html = await response.text();
        const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
          .map((match) => match[1]);
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll([...APP_SHELL, ...assetUrls]);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("afterschool-shell-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            return caches.open(CACHE_NAME)
              .then((cache) => cache.put("/", response.clone()))
              .then(() => response);
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/")) || Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
