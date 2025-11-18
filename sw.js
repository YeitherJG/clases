const CACHE_NAME = "clases-cache-v2";
const ASSETS = [
  "/",              // importante para navegación
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/sql-wasm.js",   // local, no CDN
  "/sql-wasm.wasm"  // local, no CDN
];

// Instalación: cachea todo y activa de inmediato
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Activación: limpia versiones viejas y toma control
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  clients.claim();
});

// Fetch: estrategia offline-first con fallback de navegación
self.addEventListener("fetch", event => {
  const req = event.request;

  // Si es navegación (HTML), intenta caché y usa index.html como fallback
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("/index.html").then(cached => {
        return cached || fetch(req).catch(() => caches.match("/index.html"));
      })
    );
    return;
  }

  // Para otros recursos: sirve desde caché, si no existe, intenta red
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req)
        .then(res => {
          // Clona y guarda en caché si es una respuesta válida (status 200, basic)
          const copy = res.clone();
          if (res.ok && res.type === "basic") {
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached); // fallback a caché si la red falla
    })
  );
});
