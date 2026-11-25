const CACHE_NAME = "ricicla-bene-tn-v0.2.0-1";

const DATA_URLS = [
  "/assets/dictionary_trento.json",
  "/assets/embeddings_trento_fp16.bin",
];

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./theme-init.js",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./vendor/ort/ort.min.js",
  "./icons/favicon.svg",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/dictionary_trento.json",
  "./assets/embeddings_trento_fp16.bin",
  "./assets/model_image.onnx",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
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

function isDataAsset(url) {
  return DATA_URLS.some((suffix) => url.pathname.endsWith(suffix));
}

async function notifyClientsDataUpdated() {
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "DATA_UPDATED" });
  }
}

// Stale-While-Revalidate for lightweight dictionary/embeddings (~758 KB);
// Cache-First for the 67 MiB ONNX model, app shell, and self-hosted WASM binaries.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const reqUrl = new URL(event.request.url);

  if (reqUrl.origin === self.location.origin && isDataAsset(reqUrl)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkPromise = fetch(event.request, { cache: "no-cache" })
          .then(async (response) => {
            if (response && response.status === 200) {
              const oldTag = cached?.headers.get("etag") || cached?.headers.get("last-modified");
              const newTag = response.headers.get("etag") || response.headers.get("last-modified");
              await cache.put(event.request, response.clone());
              if (cached && oldTag !== newTag && reqUrl.pathname.endsWith("dictionary_trento.json")) {
                notifyClientsDataUpdated();
              }
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkPromise;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && (response.status === 200 || response.type === "opaque")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
