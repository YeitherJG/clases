const CACHE_NAME = 'clases-app-v1';
const urlsToCache = [
  './', // Cachea la carpeta raíz (importante para el index.html)
  './index.html',
  './style.css',
  './app.js',
  './sql-wasm.js',
  './sql-wasm.wasm', // ¡Crucial! El motor de la DB
  // Aquí puedes añadir rutas a tus iconos si los tienes en manifest.json
];

// 1. Instalar y Cachear todos los recursos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Servir los recursos desde la caché si están disponibles
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve el recurso desde la caché si lo encuentra
        if (response) {
          return response;
        }
        // Si no está en caché, va a la red (necesita internet)
        return fetch(event.request);
      })
  );
});

// 3. Limpiar cachés antiguas (Opcional, pero recomendado)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
