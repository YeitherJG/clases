const CACHE = "clases-cache-v1";
const BASE = "/clases";
const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/style.css`,
  `${BASE}/app.js`,
  `${BASE}/manifest.json`,
  `${BASE}/sql-wasm.js`,
  `${BASE}/sql-wasm.wasm`,
  `${BASE}/icon-192.png`,
  `${BASE}/icon-512.png`
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)))
    )
  );
  clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request;

  // Navegación: devolver index.html del caché como fallback
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match(`${BASE}/index.html`).then(cached => {
        return cached || fetch(req).catch(() => caches.match(`${BASE}/index.html`));
      })
    );
    return;
  }

  // Recursos: offline-first con actualización en segundo plano
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        const copy = res.clone();
        if (res.ok && (res.type === "basic" || res.type === "cors")) {
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
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
