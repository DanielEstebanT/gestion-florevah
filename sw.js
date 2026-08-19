/* Service worker de florevah.
   Estrategia: "red primero, caché de respaldo" — SIEMPRE intenta traer la versión más nueva
   de internet, y solo usa lo guardado si no hay conexión. Así nunca se quedan atascados
   viendo una versión vieja de la app sin darse cuenta (el error más común en PWAs).
   NUNCA cachea nada de Firestore/Firebase — esos datos siempre van directo a la red. */

const CACHE_NAME = 'florevah-v1'; // sube este número cada vez que quieras forzar que se
                                   // borre la caché vieja (por ejemplo, tras un cambio grande)

const ARCHIVOS_APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/01-estado.js',
  './js/02-ui.js',
  './js/03-helpers.js',
  './js/04-insumos.js',
  './js/05-productos.js',
  './js/06-pedidos.js',
  './js/07-balance.js',
  './js/08-analisis.js',
  './js/09-historial.js',
  './js/10-actividad.js',
  './js/11-resumen.js',
  './js/12-inicio.js',
  './js/13-app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_APP_SHELL))
  );
  self.skipWaiting(); // activa la nueva versión de una vez, sin esperar a que se cierren todas las pestañas
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Nunca intervenir en llamadas a Firebase/Firestore/Google — siempre van directo a la red.
  if (url.includes('firestore.googleapis.com') || url.includes('googleapis.com') || url.includes('gstatic.com/firebasejs')) {
    return;
  }
  // Solo interesa cachear peticiones GET del propio sitio.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((respuestaRed) => {
        // Si trajo algo bueno de internet, se guarda una copia fresca en caché para offline.
        const copia = respuestaRed.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return respuestaRed;
      })
      .catch(() => {
        // Sin conexión: se usa lo que haya en caché, si existe.
        return caches.match(event.request);
      })
  );
});
