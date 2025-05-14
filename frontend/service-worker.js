// Versión del cache
const CACHE_VERSION = 'v1';
const CACHE_NAME = `geobuild-fleet-${CACHE_VERSION}`;

// Recursos que queremos cachear
/* const CACHED_RESOURCES = [
  '/',
  '/frontend/index.html',
  '/frontend/templates/seguimiento.html',
  '/frontend/css/bootstrap.css',
  '/frontend/css/costume.css',
  '/frontend/css/cruds.css',
  '/frontend/js/bootstrap.js',
  '/frontend/img/iconoSF.png',
  '/frontend/manifest.json'
]; */

// Recursos que queremos cachear
const CACHED_RESOURCES = [
  '/',
  '/index.html',
  '/templates/logueo.html',
  '/templates/monitoreo.html',
  '/templates/personal.html',
  '/templates/vehiculos.html',
  '/templates/seguimiento.html',
  '/css/bootstrap.css',
  '/css/costume.css',
  '/css/cruds.css',
  '/js/bootstrap.js',
  '/img/iconoSF.png',
  '/manifest.json'
];


// Instalar el Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker instalándose');
  
  // Saltar la espera para que el service worker se active inmediatamente
  self.skipWaiting();
  
  // Cachear archivos esenciales
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(CACHED_RESOURCES);
      })
      .catch(error => {
        console.error('Error en la instalación del Service Worker:', error);
      })
  );
});

// Activar el Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker activado');
  
  // Eliminar caches antiguos
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Tomar el control inmediatamente
  return self.clients.claim();
});

// Interceptar peticiones fetch
self.addEventListener('fetch', event => {
  // Estrategia: Network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, clonarla y guardarla en cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            // Solo cachear recursos de nuestra aplicación
            if (event.request.url.includes(self.location.origin)) {
              cache.put(event.request, responseClone);
            }
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar con el cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Si es una solicitud API, devolver una respuesta offline personalizada
            if (event.request.url.includes('api.')) {
              return new Response(
                JSON.stringify({ 
                  offline: true, 
                  message: 'No hay conexión a internet. La app está funcionando en modo offline.' 
                }),
                { headers: { 'Content-Type': 'application/json' } }
              );
            }
            
            // Si no está en cache, devolver una página de error
            return caches.match('/frontend/templates/offline.html');
          });
      })
  );
});

// Escuchar mensajes desde la aplicación
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Mantener el service worker activo con solicitudes periódicas
setInterval(() => {
  self.registration.update();
}, 60 * 60 * 1000); // Actualizar cada hora